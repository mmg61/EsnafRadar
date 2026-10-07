import httpx
from bs4 import BeautifulSoup
import os
import json
from google import genai
from pydantic import BaseModel
from typing import List

class GeminiAuditResult(BaseModel):
    score: int
    ai_summary: str
    opportunities: list[str]

async def run_audit(name: str, website: str | None) -> dict:
    result = {
        "score": 0,
        "ssl_valid": False,
        "mobile_ready": False,
        "has_website": False,
        "ai_summary": "",
        "opportunities": []
    }
    
    if not website:
        result["ai_summary"] = f"{name} işletmesinin bir web sitesi yok. Doğrudan bir kurumsal web sitesi ve Google Haritalar kaydı satılabilir."
        result["opportunities"] = ["Web Sitesi Yapımı", "Google Benim İşletmem SEO", "Dijital Varlık Kurulumu"]
        result["score"] = 90 # Fırsat puanı yüksek, çünkü sıfırdan her şey satılabilir
        return result
        
    result["has_website"] = True
    
    if not website.startswith("http"):
        website = "http://" + website
        
    try:
        # 1. SSL Check
        async with httpx.AsyncClient(verify=True) as client:
            try:
                https_url = website.replace("http://", "https://")
                resp = await client.get(https_url, timeout=10.0, follow_redirects=True)
                result["ssl_valid"] = str(resp.url).startswith("https")
                html_content = resp.text
            except httpx.ConnectError:
                # SSL failed, try http
                resp = await client.get(website, timeout=10.0, follow_redirects=True)
                html_content = resp.text
                
        # 2. Basic Technical Audit
        soup = BeautifulSoup(html_content, "html.parser")
        
        # Mobile Responsive Check (viewport meta)
        viewport = soup.find("meta", {"name": "viewport"})
        if viewport and "width=device-width" in str(viewport).lower():
            result["mobile_ready"] = True
            
        # Get some text context for Gemini
        page_text = " ".join(soup.stripped_strings)[:1500] # İlk 1500 karakter
        
        # 3. Gemini AI Analysis (if API key exists)
        gemini_api_key = os.environ.get("GEMINI_API_KEY")
        if gemini_api_key:
            client = genai.Client(api_key=gemini_api_key)
            prompt = f"""
            Sen uzman bir dijital pazarlama ve B2B satış danışmanısın.
            İşletme Adı: {name}
            Web Sitesi Metni: {page_text}
            SSL Durumu: {'Var' if result['ssl_valid'] else 'Yok'}
            Mobil Uyumluluk: {'Var' if result['mobile_ready'] else 'Yok'}
            
            Bu esnafa hangi dijital hizmetler satılabilir? Bize bir analiz döndür.
            """
            
            ai_response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config={
                    'response_mime_type': 'application/json',
                    'response_schema': GeminiAuditResult,
                },
            )
            ai_data = json.loads(ai_response.text)
            result["score"] = ai_data.get("score", 50)
            result["ai_summary"] = ai_data.get("ai_summary", "")
            result["opportunities"] = ai_data.get("opportunities", [])
        else:
            # Fallback if no AI key
            opps = []
            if not result["ssl_valid"]: opps.append("SSL Sertifikası Satışı")
            if not result["mobile_ready"]: opps.append("Mobil Uyumlu Modern Tasarım")
            opps.append("SEO ve İçerik Güncellemesi")
            
            result["score"] = 60 if result["ssl_valid"] and result["mobile_ready"] else 85
            result["ai_summary"] = "Yapay zeka analizi için GEMINI_API_KEY bekleniyor. Sitenin teknik altyapısı incelendi."
            result["opportunities"] = opps
            
    except Exception as e:
        result["ai_summary"] = f"Web sitesine ulaşılamadı veya hata oluştu. (Belki de site kapalıdır, bu harika bir fırsat!) Hata: {str(e)}"
        result["opportunities"] = ["Web Sitesi Yenileme/Kurtarma", "Hosting Satışı"]
        result["score"] = 95
        
    return result
