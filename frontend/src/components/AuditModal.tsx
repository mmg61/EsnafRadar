import React, { useState, useEffect } from 'react';
import {
  X,
  Globe,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  MessageSquare,
  Mail,
  RefreshCw,
  BookmarkPlus,
  ExternalLink,
  Phone,
  Sparkles,
  Wand2,
  KeyRound,
  SlidersHorizontal,
  PhoneCall,
  Send,
  FileDown,
  FileText,
  ArrowRight,
  LayoutTemplate,
  Monitor,
  Smartphone
} from 'lucide-react';
import { getAiStatus, saveAiConfig, generateCustomPitch, exportAuditPdf, generateDemoSite } from '../api';

interface AuditModalProps {
  auditResult: any;
  token?: string | null;
  isSavingLead: boolean;
  saveLeadSuccess: boolean;
  onClose: () => void;
  onSaveLead: () => void;
  onReAudit?: () => void;
  onAuditResultUpdate?: (updatedAudit: any) => void;
}

type MainModalTab = 'overview' | 'proposal' | 'demo_site';
type PitchChannelTab = 'whatsapp' | 'email' | 'instagram' | 'cold_call';

/**
 * +90, 0090, 90 veya 0 ile başlayan aynı telefon numaralarını tek bir standart
 * Türkiye formatına (0XXX XXX XX XX) dönüştürür ve mükerrer olanları eler.
 */
function normalizeAndDeduplicatePhones(rawPhones: (string | null | undefined)[]): string[] {
  const seenKeys = new Set<string>();
  const result: string[] = [];

  for (const raw of rawPhones) {
    if (!raw || typeof raw !== 'string') continue;
    // Noktalı virgül veya virgülle ayrılmış birden fazla numara varsa parçala
    const parts = raw.split(/[;,]/);
    for (const part of parts) {
      let digits = part.replace(/\D/g, '');
      if (!digits) continue;

      // 444 XX XX (7 haneli çağrı merkezi)
      if (digits.length === 7 && digits.startsWith('444')) {
        const key = digits;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          result.push(`444 ${digits.slice(3, 5)} ${digits.slice(5, 7)}`);
        }
        continue;
      }

      // Uluslararası ülke kodu (+90 / 0090 / 900) temizliği
      if (digits.length === 14 && digits.startsWith('0090')) {
        digits = '0' + digits.slice(4);
      } else if (digits.length === 13 && digits.startsWith('900')) {
        digits = '0' + digits.slice(3);
      } else if (digits.length === 12 && digits.startsWith('90')) {
        digits = '0' + digits.slice(2);
      } else if (digits.length === 10 && ['2', '3', '4', '5', '8'].includes(digits[0])) {
        digits = '0' + digits;
      }

      if (digits.length === 11 && digits.startsWith('0')) {
        if (!seenKeys.has(digits)) {
          seenKeys.add(digits);
          const formatted = `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`;
          result.push(formatted);
        }
      } else if (digits.length >= 7) {
        // Diğer formatlar için son 10 haneyi anahtar olarak kullan
        const fallbackKey = digits.slice(-10);
        if (!seenKeys.has(fallbackKey)) {
          seenKeys.add(fallbackKey);
          result.push(part.trim());
        }
      }
    }
  }

  return result;
}

export const AuditModal: React.FC<AuditModalProps> = ({
  auditResult,
  token,
  isSavingLead,
  saveLeadSuccess,
  onClose,
  onSaveLead,
  onReAudit,
  onAuditResultUpdate
}) => {
  const activeToken = token || localStorage.getItem('token') || '';

  const [mainTab, setMainTab] = useState<MainModalTab>('overview');
  const [pitchTab, setPitchTab] = useState<PitchChannelTab>('whatsapp');
  const [copied, setCopied] = useState(false);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Canlı Örnek Site Önizleme Durumları
  const [demoSiteHtml, setDemoSiteHtml] = useState<string>('');
  const [isGeneratingDemoSite, setIsGeneratingDemoSite] = useState<boolean>(false);
  const [demoPreviewDevice, setDemoPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Teklif Oluşturucu Durumları
  const [tone, setTone] = useState<string>('kurumsal');
  const [focusService, setFocusService] = useState<string>('auto');
  const [senderName, setSenderName] = useState<string>('');
  const [agencyName, setAgencyName] = useState<string>('');
  const [specialOffer, setSpecialOffer] = useState<string>('');
  const [customInstruction, setCustomInstruction] = useState<string>('');
  const [showAdvancedParams, setShowAdvancedParams] = useState<boolean>(false);
  const [isGeneratingPitch, setIsGeneratingPitch] = useState<boolean>(false);
  const [pitchStatusMessage, setPitchStatusMessage] = useState<string | null>(null);

  // Yapay Zeka Anahtarı Durumları
  const [aiStatus, setAiStatus] = useState<{ configured: boolean; masked_key?: string | null; model: string }>({
    configured: false,
    masked_key: null,
    model: 'gemini-2.5-flash'
  });
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [isSavingApiKey, setIsSavingApiKey] = useState<boolean>(false);

  // Düzenlenebilir teklif metinleri
  const [whatsappPitch, setWhatsappPitch] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailPitch, setEmailPitch] = useState<string>('');
  const [instagramPitch, setInstagramPitch] = useState<string>('');
  const [coldCallScript, setColdCallScript] = useState<string>('');
  const [recommendedPackage, setRecommendedPackage] = useState<string>('');
  const [valuePropositions, setValuePropositions] = useState<string[]>([]);


  useEffect(() => {
    if (!auditResult) return;
    setMainTab('overview');
    setDemoSiteHtml('');
    setWhatsappPitch(auditResult.sales_pitch_whatsapp || '');
    setEmailSubject(
      auditResult.email_subject ||
        `${auditResult.merchantName} - Web Sitesi ve Tanıtım İnceleme Notu`
    );
    setEmailPitch(auditResult.sales_pitch_email || '');
    setInstagramPitch(
      auditResult.instagram_dm_pitch ||
        `Merhaba ${auditResult.merchantName}! İşletmenize daha fazla müşteri kazandıracak web sitesi ve harita çalışmamızı paylaşmak isteriz.`
    );
    setColdCallScript(
      auditResult.cold_call_script ||
        `1. AÇILIŞ: Merhaba, ${auditResult.merchantName} yetkilisi ile mi görüşüyorum?\n2. DURUM: Bölgenizdeki işletmelere bakarken internet sitenizi ve Google Harita kaydınızı inceledik.\n3. ÇÖZÜM: Müşterilerin doğrudan size ulaşmasını sağlayan telefon uyumlu web sitesi ve harita paketimiz var.\n4. KAPANIŞ: Hazırladığımız örnek çalışmayı WhatsApp numaranıza gönderebilir miyim?`
    );
    setRecommendedPackage(auditResult.recommended_package || '');
    setValuePropositions(auditResult.value_propositions || []);

  }, [auditResult]);

  useEffect(() => {
    if (!activeToken) return;
    getAiStatus(activeToken)
      .then(status => setAiStatus(status))
      .catch(() => {});
  }, [activeToken]);

  if (!auditResult) return null;

  const merchant = auditResult.merchant || {};
  const effectiveWebsite = auditResult.discovered_website || merchant.website || null;

  // Tüm telefon numaralarını (+90 ve 0 farkını gidererek) tekilleştir
  const allPhones: string[] = normalizeAndDeduplicatePhones([
    merchant.phone,
    auditResult.scraped_whatsapp,
    ...(auditResult.scraped_phones || [])
  ]);

  const allEmails: string[] = Array.from(
    new Set(
      [
        ...(merchant.email ? [merchant.email.trim().toLowerCase()] : []),
        ...((auditResult.scraped_emails || []).map((e: string) => e.trim().toLowerCase()))
      ].filter(Boolean)
    )
  );

  const effectivePhone = allPhones.length > 0 ? allPhones[0] : null;
  const effectiveEmail = allEmails.length > 0 ? allEmails[0] : null;

  const socialLinks: Record<string, string> = {
    ...(merchant.instagram ? { instagram: merchant.instagram } : {}),
    ...(auditResult.social_links || {})
  };

  const getActivePitchText = () => {
    if (pitchTab === 'whatsapp') return whatsappPitch;
    if (pitchTab === 'email') return emailPitch;
    if (pitchTab === 'instagram') return instagramPitch;
    return coldCallScript;
  };

  const setActivePitchText = (val: string) => {
    if (pitchTab === 'whatsapp') setWhatsappPitch(val);
    else if (pitchTab === 'email') setEmailPitch(val);
    else if (pitchTab === 'instagram') setInstagramPitch(val);
    else setColdCallScript(val);
  };

  const handleCopyPitch = async () => {
    const textToCopy = getActivePitchText();
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  const handleCopyValue = async (val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedItem(val);
      setTimeout(() => setCopiedItem(null), 1800);
    } catch (_) {}
  };

  const handleDownloadPdf = async () => {
    if (!activeToken || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      await exportAuditPdf(
        {
          merchant_name: auditResult.merchantName || merchant.name || 'İşletme',
          category: merchant.category_label || merchant.category || 'Yerel İşletme',
          website: effectiveWebsite,
          phone: effectivePhone,
          email: effectiveEmail,
          score: auditResult.score,
          has_website: Boolean(auditResult.has_website),
          ssl_valid: Boolean(auditResult.ssl_valid),
          mobile_ready: Boolean(auditResult.mobile_ready),
          has_title: Boolean(auditResult.has_title),
          has_meta_description: Boolean(auditResult.has_meta_description),
          has_h1: Boolean(auditResult.has_h1),
          has_og_tags: Boolean(auditResult.has_og_tags),
          has_schema: Boolean(auditResult.has_schema),
          has_analytics: Boolean(auditResult.has_analytics),
          has_pixel: Boolean(auditResult.has_pixel),
          ai_summary: auditResult.ai_summary,
          recommended_package: recommendedPackage || auditResult.recommended_package,
          detected_pain_points: auditResult.detected_pain_points || [],
          opportunities: auditResult.opportunities || [],
          value_propositions: valuePropositions,
          whatsapp_pitch: whatsappPitch,
          sales_pitch_whatsapp: whatsappPitch
        },
        activeToken
      );
      setPitchStatusMessage('PDF inceleme raporu bilgisayarınıza indirildi.');
      setTimeout(() => setPitchStatusMessage(null), 3500);
    } catch (err: unknown) {
      setPitchStatusMessage((err instanceof Error ? err.message : "") || 'PDF raporu indirilemedi.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleOpenDemoSite = async () => {
    setMainTab('demo_site');
    if (demoSiteHtml || isGeneratingDemoSite || !activeToken) return;
    setIsGeneratingDemoSite(true);
    try {
      const res = await generateDemoSite(
        {
          merchant_name: auditResult.merchantName || merchant.name || 'Yerel İşletme',
          category: merchant.category_label || merchant.category || 'Yerel İşletme',
          phone: effectivePhone,
          email: effectiveEmail,
          address: merchant.address || null,
          opening_hours: merchant.opening_hours || null,
          instagram: socialLinks.instagram || merchant.instagram || null,
          latitude: merchant.latitude || null,
          longitude: merchant.longitude || null
        },
        activeToken
      );
      setDemoSiteHtml(res.html_content || '');
    } catch (err: unknown) {
      setPitchStatusMessage((err instanceof Error ? err.message : "") || 'Örnek site taslağı oluşturulamadı.');
    } finally {
      setIsGeneratingDemoSite(false);
    }
  };

  const handleOpenDemoInNewTab = () => {
    if (!demoSiteHtml) return;
    const blob = new Blob([demoSiteHtml], { type: 'text/html;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadDemoHtml = () => {
    if (!demoSiteHtml) return;
    const blob = new Blob([demoSiteHtml], { type: 'text/html;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const safeName = (auditResult.merchantName || merchant.name || 'isletme')
      .toLowerCase()
      .replace(/[^a-z0-9ğüşıöç]/gi, '_')
      .replace(/_+/g, '_')
      .slice(0, 40);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}_ornek_web_sitesi.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeToken) return;
    setIsSavingApiKey(true);
    try {
      const updated = await saveAiConfig(apiKeyInput.trim(), activeToken);
      setAiStatus(updated);
      setApiKeyInput('');
      setShowApiKeyModal(false);
      setPitchStatusMessage(
        updated.configured
          ? 'Google Gemini anahtarı kaydedildi.'
          : 'Anahtar kaldırıldı; standart teklif oluşturucu aktif.'
      );
      setTimeout(() => setPitchStatusMessage(null), 4000);
    } catch (err: unknown) {
      setPitchStatusMessage((err instanceof Error ? err.message : "") || 'Anahtar kaydedilemedi.');
    } finally {
      setIsSavingApiKey(false);
    }
  };

  const handleGenerateAiPitch = async () => {
    if (!activeToken || isGeneratingPitch) return;
    setIsGeneratingPitch(true);
    setPitchStatusMessage(null);
    try {
      const res = await generateCustomPitch(
        {
          osm_id: merchant.osm_id,
          merchant_name: auditResult.merchantName || merchant.name,
          category: merchant.category_label || merchant.category || undefined,
          tone,
          focus_service: focusService,
          sender_name: senderName.trim() || undefined,
          agency_name: agencyName.trim() || undefined,
          special_offer: specialOffer.trim() || undefined,
          custom_instruction: customInstruction.trim() || undefined,
          audit_context: auditResult
        },
        activeToken
      );

      setWhatsappPitch(res.whatsapp_pitch || '');
      setEmailSubject(res.email_subject || '');
      setEmailPitch(res.email_pitch || '');
      setInstagramPitch(res.instagram_dm_pitch || '');
      setColdCallScript(res.cold_call_script || '');
      setRecommendedPackage(res.recommended_package || '');
      setValuePropositions(res.value_propositions || []);


      if (onAuditResultUpdate) {
        onAuditResultUpdate({
          ...auditResult,
          ai_engine_used: res.engine_used,
          recommended_package: res.recommended_package,
          detected_pain_points: res.detected_pain_points,
          value_propositions: res.value_propositions,
          sales_pitch_whatsapp: res.whatsapp_pitch,
          email_subject: res.email_subject,
          sales_pitch_email: res.email_pitch,
          instagram_dm_pitch: res.instagram_dm_pitch,
          cold_call_script: res.cold_call_script
        });
      }

      setPitchStatusMessage('Teklif metinleri seçtiğiniz ayarlara göre yenilendi.');
      setTimeout(() => setPitchStatusMessage(null), 4000);
    } catch (err: unknown) {
      setPitchStatusMessage((err instanceof Error ? err.message : "") || 'Teklif oluşturulurken bir hata oluştu.');
    } finally {
      setIsGeneratingPitch(false);
    }
  };

  const formatWhatsAppNumber = (rawPhone: string) => {
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    return cleanPhone.startsWith('90')
      ? cleanPhone
      : cleanPhone.startsWith('0')
        ? '9' + cleanPhone
        : '90' + cleanPhone;
  };

  const getWhatsAppPitchLink = () => {
    if (!effectivePhone) return null;
    const phoneWithCountry = formatWhatsAppNumber(effectivePhone);
    const text = encodeURIComponent(
      whatsappPitch ||
        `Merhaba ${auditResult.merchantName}, işletmenizin internet görünürlüğünü inceledik ve bilgi vermek isteriz.`
    );
    return `https://wa.me/${phoneWithCountry}?text=${text}`;
  };

  const getMailtoLink = () => {
    if (!effectiveEmail) return null;
    const subject = encodeURIComponent(
      emailSubject || `${auditResult.merchantName} - Web Sitesi ve Tanıtım İnceleme Notu`
    );
    const body = encodeURIComponent(emailPitch || auditResult.ai_summary || '');
    return `mailto:${effectiveEmail}?subject=${subject}&body=${body}`;
  };

  const waUrl = getWhatsAppPitchLink();
  const mailUrl = getMailtoLink();

  const checkItems = [
    { label: 'Web Sitesi', ok: Boolean(auditResult.has_website), okText: 'Mevcut', failText: 'Yok' },
    { label: 'Güvenli Bağlantı (Kilit Simgesi)', ok: Boolean(auditResult.ssl_valid), okText: 'Güvenli', failText: 'Yok' },
    { label: 'Telefon ve Tablet Uyumu', ok: Boolean(auditResult.mobile_ready), okText: 'Uyumlu', failText: 'Uyumsuz' },
    { label: 'Google Arama Başlığı', ok: Boolean(auditResult.has_title), okText: 'Mevcut', failText: 'Eksik' },
    { label: 'Google Tanıtım Yazısı', ok: Boolean(auditResult.has_meta_description), okText: 'Mevcut', failText: 'Eksik' },
    { label: 'Ziyaretçi Sayacı', ok: Boolean(auditResult.has_analytics), okText: 'Kurulu', failText: 'Kurulu Değil' },
    { label: 'Instagram / Facebook Reklam Takibi', ok: Boolean(auditResult.has_pixel), okText: 'Kurulu', failText: 'Kurulu Değil' },
    { label: 'WhatsApp / Sosyal Medya Önizlemesi', ok: Boolean(auditResult.has_og_tags), okText: 'Mevcut', failText: 'Eksik' },
  ];

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-[#E8DCC4] w-full max-w-4xl rounded-2xl border border-[#3F5E45] shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Üst Başlık Çubuğu */}
        <div className="bg-[#FFF8E7] px-6 py-5 border-b border-[#3F5E45] flex flex-wrap justify-between items-center gap-4 shrink-0">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-[#6F8F72] text-[#3F5E45] border border-[#3F5E45]">
              İşletme İnceleme Raporu
            </span>
            <h2 className="text-2xl font-bold text-white mt-2">
              {auditResult.merchantName}
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleOpenDemoSite}
              title="İşletmeye Özel Canlı Örnek Web Sitesi Taslağı Oluştur"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-xs font-semibold transition-colors cursor-pointer"
            >
              <LayoutTemplate size={16} />
              <span>Örnek Site Oluştur</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              title="İnceleme Raporunu PDF Olarak İndir"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#6F8F72] hover:bg-[#6F8F72] text-[#3F5E45] border border-[#3F5E45] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <FileDown size={16} />
              <span>{isExportingPdf ? 'PDF Hazırlanıyor...' : 'PDF Rapor İndir'}</span>
            </button>
            {onReAudit && (
              <button
                onClick={onReAudit}
                title="İncelemeyi Yenile"
                className="p-2.5 rounded-xl bg-[#E8DCC4] hover:bg-[#B7C9A8] text-[#3F5E45] hover:text-[#3F5E45] border border-[#3F5E45] transition-colors cursor-pointer"
              >
                <RefreshCw size={17} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-[#E8DCC4] hover:bg-[#B7C9A8] text-[#3F5E45]/80 hover:text-[#3F5E45] border border-[#3F5E45] transition-colors cursor-pointer"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {/* Göz Yormayan 2 Adımlı Sekme Çubuğu */}
        <div className="bg-[#FFF8E7] px-6 py-3 border-b border-[#3F5E45] flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMainTab('overview')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              mainTab === 'overview'
                ? 'bg-[#6F8F72] text-white shadow-md shadow-none'
                : 'bg-[#E8DCC4] text-[#3F5E45] hover:text-[#3F5E45] border border-[#3F5E45]'
            }`}
          >
            <FileText size={16} />
            <span>1. İnceleme Özeti ve İletişim</span>
          </button>

          <button
            type="button"
            onClick={() => setMainTab('proposal')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              mainTab === 'proposal'
                ? 'bg-[#6F8F72] text-white shadow-md shadow-none'
                : 'bg-[#E8DCC4] text-[#3F5E45] hover:text-[#3F5E45] border border-[#3F5E45]'
            }`}
          >
            <Wand2 size={16} />
            <span>2. Hazır Teklif Mesajı Oluştur</span>
          </button>

          <button
            type="button"
            onClick={handleOpenDemoSite}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              mainTab === 'demo_site'
                ? 'bg-[#6F8F72] text-white shadow-md shadow-none'
                : 'bg-[#E8DCC4] text-[#3F5E45] hover:text-[#3F5E45] border border-[#3F5E45]'
            }`}
          >
            <LayoutTemplate size={16} />
            <span>3. Canlı Örnek Site Önizlemesi</span>
          </button>
        </div>

        {/* Kaydırılabilir Ana İçerik */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">
          {pitchStatusMessage && (
            <div className="px-4 py-3 rounded-xl bg-[#6F8F72] border border-[#3F5E45] text-[#3F5E45] text-sm flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{pitchStatusMessage}</span>
            </div>
          )}

          {mainTab === 'overview' ? (
            <div className="space-y-6">
              {/* Bölüm 1: Puan ve Genel Değerlendirme (Ferah Kart) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#FFF8E7] p-6 rounded-2xl border border-[#3F5E45] flex flex-col items-center justify-center text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#3F5E45]/80">
                    İhtiyaç ve Fırsat Puanı
                  </p>
                  <p className="text-5xl font-black text-[#3F5E45] my-3">
                    {auditResult.score}
                    <span className="text-xl text-[#3F5E45]0 font-semibold">/100</span>
                  </p>
                  <span className="text-xs px-3 py-1 rounded-full bg-[#6F8F72] text-[#3F5E45] border border-[#3F5E45]">
                    {auditResult.score >= 80
                      ? 'Çok Yüksek Satış Fırsatı'
                      : auditResult.score >= 55
                        ? 'Orta-Yüksek İyileştirme İhtiyacı'
                        : 'Tanıtım ve Reklam Fırsatı'}
                  </span>

                  {effectiveWebsite ? (
                    <a
                      href={effectiveWebsite.startsWith('http') ? effectiveWebsite : `https://${effectiveWebsite}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-1.5 text-xs text-blue-400 hover:underline truncate max-w-full"
                    >
                      <Globe size={14} />
                      <span className="truncate">{effectiveWebsite.replace(/^https?:\/\//, '')}</span>
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span className="mt-4 text-xs text-amber-400 font-medium">
                      Aktif Web Sitesi Bulunmuyor
                    </span>
                  )}
                </div>

                <div className="md:col-span-2 bg-[#FFF8E7] p-6 rounded-2xl border border-[#3F5E45] flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#3F5E45] mb-2">
                      Genel Değerlendirme
                    </h3>
                    <p className="text-[#3F5E45] text-sm leading-relaxed">
                      {auditResult.ai_summary}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[#3F5E45]/80 mb-2.5">
                      Yapılabilecek İyileştirmeler
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(auditResult.opportunities || []).map((opp: string, i: number) => (
                        <span
                          key={i}
                          className="bg-[#6F8F72] text-[#3F5E45] border border-[#3F5E45] px-3.5 py-1.5 rounded-xl text-xs font-medium"
                        >
                          + {opp}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bölüm 2: Bulunan İletişim ve Sosyal Medya Bilgileri (Tekilleştirilmiş & Ferah) */}
              <div className="bg-[#FFF8E7] p-6 rounded-2xl border border-[#3F5E45] space-y-4">
                <h3 className="text-sm font-bold text-white">
                  Bulunan İletişim ve Sosyal Medya Bilgileri
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Telefon Numaraları */}
                  <div className="bg-[#FFF8E7] p-4 rounded-xl border border-[#3F5E45] space-y-3">
                    <p className="text-xs font-semibold text-[#3F5E45]/80 flex items-center gap-2">
                      <Phone size={14} className="text-[#3F5E45]" />
                      <span>Telefon ({allPhones.length})</span>
                    </p>
                    {allPhones.length === 0 ? (
                      <p className="text-sm text-[#3F5E45]0">Telefon numarası bulunamadı.</p>
                    ) : (
                      <div className="space-y-2">
                        {allPhones.map((ph, i) => (
                          <div
                            key={`ph-${i}`}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#E8DCC4] border border-[#3F5E45] text-sm"
                          >
                            <a href={`tel:${ph}`} className="text-white hover:text-[#3F5E45] font-medium truncate">
                              {ph}
                            </a>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <a
                                href={`https://wa.me/${formatWhatsAppNumber(ph)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-1 rounded bg-[#6F8F72] text-[#3F5E45] hover:bg-[#6F8F72] text-xs font-semibold"
                              >
                                WhatsApp
                              </a>
                              <button
                                type="button"
                                onClick={() => handleCopyValue(ph)}
                                title="Numarayı Kopyala"
                                className="p-1 text-[#3F5E45]/80 hover:text-[#3F5E45] cursor-pointer"
                              >
                                {copiedItem === ph ? <Check size={14} className="text-[#3F5E45]" /> : <Copy size={14} />}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* E-posta Adresleri */}
                  <div className="bg-[#FFF8E7] p-4 rounded-xl border border-[#3F5E45] space-y-3">
                    <p className="text-xs font-semibold text-[#3F5E45]/80 flex items-center gap-2">
                      <Mail size={14} className="text-blue-400" />
                      <span>E-posta ({allEmails.length})</span>
                    </p>
                    {allEmails.length === 0 ? (
                      <p className="text-sm text-[#3F5E45]0">E-posta adresi bulunamadı.</p>
                    ) : (
                      <div className="space-y-2">
                        {allEmails.map((em, i) => (
                          <div
                            key={`em-${i}`}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#E8DCC4] border border-[#3F5E45] text-sm"
                          >
                            <a
                              href={`mailto:${em}`}
                              className="text-white hover:text-blue-400 truncate font-medium"
                              title={em}
                            >
                              {em}
                            </a>
                            <button
                              type="button"
                              onClick={() => handleCopyValue(em)}
                              title="E-postayı Kopyala"
                              className="p-1 text-[#3F5E45]/80 hover:text-[#3F5E45] cursor-pointer shrink-0"
                            >
                              {copiedItem === em ? <Check size={14} className="text-[#3F5E45]" /> : <Copy size={14} />}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sosyal Medya Hesapları */}
                  <div className="bg-[#FFF8E7] p-4 rounded-xl border border-[#3F5E45] space-y-3">
                    <p className="text-xs font-semibold text-[#3F5E45]/80 flex items-center gap-2">
                      <Globe size={14} className="text-purple-400" />
                      <span>Sosyal Medya ({Object.keys(socialLinks).length})</span>
                    </p>
                    {Object.keys(socialLinks).length === 0 ? (
                      <p className="text-sm text-[#3F5E45]0">Sosyal medya hesabı bulunamadı.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(socialLinks).map(([platform, link]) => (
                          <a
                            key={platform}
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#E8DCC4] hover:bg-[#B7C9A8] border border-[#3F5E45] text-sm text-blue-400 hover:underline capitalize"
                          >
                            <ExternalLink size={13} />
                            <span>{platform}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bölüm 3: Web Sitesi Durum Kontrolü (Ferah Satırlar) */}
              <div className="bg-[#FFF8E7] p-6 rounded-2xl border border-[#3F5E45] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">
                    Web Sitesi Durum Kontrolü
                  </h3>
                  {auditResult.cms_platform && (
                    <span className="text-xs text-[#3F5E45]/80">
                      Altyapı: <strong className="text-[#3F5E45]">{auditResult.cms_platform}</strong>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {checkItems.map((item, idx) => (
                    <div
                      key={idx}
                      className={`px-4 py-3 rounded-xl border text-sm flex items-center justify-between ${
                        item.ok
                          ? 'bg-[#6F8F72] border-[#3F5E45] text-[#3F5E45]'
                          : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                      }`}
                    >
                      <span className="font-medium text-[#3F5E45]">{item.label}</span>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-xs">
                        {item.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                        {item.ok ? item.okText : item.failText}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Teklif Sekmesine Geçiş Çağrısı */}
              <div className="bg-[#6F8F72] border border-[#3F5E45] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Bu İşletmeye Gönderilecek Teklif Mesajınız Hazır
                  </h4>
                  <p className="text-xs text-[#3F5E45] mt-0.5">
                    WhatsApp, E-posta, Instagram veya Telefon görüşmesi için hazırlanan teklif metnini inceleyip hemen gönderebilirsiniz.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMainTab('proposal')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6F8F72] hover:bg-[#6F8F72] text-white text-sm font-semibold transition-colors cursor-pointer shadow-lg shadow-none"
                >
                  <span>Teklif Mesajını Aç</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ) : mainTab === 'proposal' ? (
            /* SEKME 2: HAZIR TEKLİF MESAJI OLUŞTURUCU (Ferah Görünüm) */
            <div className="bg-[#FFF8E7] rounded-2xl border border-[#3F5E45] overflow-hidden">
              <div className="px-6 py-4 bg-[#FFF8E7] border-b border-[#3F5E45] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Hazır Teklif Mesajı Oluşturucu
                  </h3>
                  <p className="text-xs text-[#3F5E45]/80 mt-0.5">
                    Konuşma dilini ve önermek istediğiniz hizmeti seçerek mesajı istediğiniz gibi yenileyebilirsiniz.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedParams(!showAdvancedParams)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      showAdvancedParams
                        ? 'bg-[#6F8F72] border-[#3F5E45] text-[#3F5E45]'
                        : 'bg-[#E8DCC4] hover:bg-[#B7C9A8] border-[#3F5E45] text-[#3F5E45]'
                    }`}
                  >
                    <SlidersHorizontal size={14} />
                    <span>Gönderen ve Kampanya Bilgisi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowApiKeyModal(!showApiKeyModal)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#E8DCC4] hover:bg-[#B7C9A8] text-xs font-medium text-[#3F5E45] border border-[#3F5E45] transition-colors cursor-pointer"
                  >
                    <KeyRound size={14} className="text-[#3F5E45]" />
                    <span>{aiStatus.configured ? 'Gemini Ayarlı' : 'Gemini Anahtarı'}</span>
                  </button>
                </div>
              </div>

              {showApiKeyModal && (
                <form
                  onSubmit={handleSaveApiKey}
                  className="p-5 bg-[#FFF8E7] border-b border-[#3F5E45] space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#3F5E45]">
                      Google Gemini Anahtarı (İsteğe Bağlı)
                    </span>
                    <span className="text-[#3F5E45]/80">
                      Anahtar girmezseniz sistem kendi akıllı şablonlarıyla teklif üretmeye devam eder
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={e => setApiKeyInput(e.target.value)}
                      placeholder="Google Gemini anahtarınızı buraya yapıştırın (AIzaSy...)"
                      className="flex-1 bg-[#FFF8E7] border border-[#3F5E45] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#3F5E45]"
                    />
                    <button
                      type="submit"
                      disabled={isSavingApiKey}
                      className="px-5 py-2.5 rounded-xl bg-[#6F8F72] hover:bg-[#6F8F72] text-white font-semibold cursor-pointer disabled:opacity-50"
                    >
                      {isSavingApiKey ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                  </div>
                </form>
              )}

              {/* Ayar Seçicileri */}
              <div className="p-6 bg-[#FFF8E7] border-b border-[#3F5E45] space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-4">
                    <label className="block text-xs font-semibold text-[#3F5E45] mb-1.5">
                      Konuşma Dili
                    </label>
                    <select
                      value={tone}
                      onChange={e => setTone(e.target.value)}
                      className="w-full bg-[#FFF8E7] border border-[#3F5E45] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#3F5E45] cursor-pointer"
                    >
                      <option value="kurumsal">Kurumsal ve Saygılı</option>
                      <option value="samimi">Samimi ve Esnaf Dostu</option>
                      <option value="ikna_edici">İkna Edici ve Kazanç Odaklı</option>
                      <option value="kisa_net">Kısa ve Doğrudan Sonuç Odaklı</option>
                    </select>
                  </div>

                  <div className="md:col-span-5">
                    <label className="block text-xs font-semibold text-[#3F5E45] mb-1.5">
                      Önerilecek Hizmet
                    </label>
                    <select
                      value={focusService}
                      onChange={e => setFocusService(e.target.value)}
                      className="w-full bg-[#FFF8E7] border border-[#3F5E45] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#3F5E45] cursor-pointer"
                    >
                      <option value="auto">Otomatik (Eksiklere Göre En Uygunu)</option>
                      <option value="web_tasarim">Telefon Uyumlu Yeni Web Sitesi</option>
                      <option value="yerel_seo">Google Harita ve Üst Sıra Çalışması</option>
                      <option value="performans_reklam">Instagram ve Google Reklam Yönetimi</option>
                      <option value="e_ticaret">Online Sipariş / Randevu ve WhatsApp Hattı</option>
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <button
                      type="button"
                      onClick={handleGenerateAiPitch}
                      disabled={isGeneratingPitch}
                      className="w-full flex items-center justify-center gap-2 bg-[#6F8F72] hover:bg-[#6F8F72] text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors cursor-pointer disabled:opacity-50 shadow-md shadow-none"
                    >
                      <Sparkles size={16} className={isGeneratingPitch ? 'animate-spin' : ''} />
                      <span>{isGeneratingPitch ? 'Hazırlanıyor...' : 'Teklifi Yenile'}</span>
                    </button>
                  </div>
                </div>

                {showAdvancedParams && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[#3F5E45]">
                    <div>
                      <label className="block text-xs text-[#3F5E45]/80 mb-1">Adınız Soyadınız</label>
                      <input
                        type="text"
                        value={senderName}
                        onChange={e => setSenderName(e.target.value)}
                        placeholder="Örn: Ahmet Yılmaz"
                        className="w-full bg-[#FFF8E7] border border-[#3F5E45] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#3F5E45]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#3F5E45]/80 mb-1">Firma / Ekip Adınız</label>
                      <input
                        type="text"
                        value={agencyName}
                        onChange={e => setAgencyName(e.target.value)}
                        placeholder="Örn: Nova Web Tasarım"
                        className="w-full bg-[#FFF8E7] border border-[#3F5E45] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#3F5E45]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#3F5E45]/80 mb-1">Özel İndirim veya Hediye Notu</label>
                      <input
                        type="text"
                        value={specialOffer}
                        onChange={e => setSpecialOffer(e.target.value)}
                        placeholder="Örn: Bu haftaya özel Google Harita kaydı ücretsiz"
                        className="w-full bg-[#FFF8E7] border border-[#3F5E45] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#3F5E45]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#3F5E45]/80 mb-1">Eklemek İstediğiniz Özel Not</label>
                      <input
                        type="text"
                        value={customInstruction}
                        onChange={e => setCustomInstruction(e.target.value)}
                        placeholder="Örn: Paket servis siparişlerine vurgu yap"
                        className="w-full bg-[#FFF8E7] border border-[#3F5E45] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#3F5E45]"
                      />
                    </div>
                  </div>
                )}

                {recommendedPackage && (
                  <div className="bg-[#FFF8E7] p-4 rounded-xl border border-[#3F5E45] flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#3F5E45]/80">
                      Önerilen Çözüm Paketi:
                    </span>
                    <span className="text-sm font-bold text-[#3F5E45]">
                      {recommendedPackage}
                    </span>
                  </div>
                )}
              </div>

              {/* 4 Kanal Seçici */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-3.5 bg-[#FFF8E7] border-b border-[#3F5E45]">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPitchTab('whatsapp')}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      pitchTab === 'whatsapp'
                        ? 'bg-[#6F8F72] text-white'
                        : 'text-[#3F5E45] hover:text-[#3F5E45] bg-[#E8DCC4]'
                    }`}
                  >
                    <MessageSquare size={14} />
                    <span>WhatsApp Mesajı</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPitchTab('email')}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      pitchTab === 'email'
                        ? 'bg-[#6F8F72] text-white'
                        : 'text-[#3F5E45] hover:text-[#3F5E45] bg-[#E8DCC4]'
                    }`}
                  >
                    <Mail size={14} />
                    <span>E-posta Yazısı</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPitchTab('instagram')}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      pitchTab === 'instagram'
                        ? 'bg-[#6F8F72] text-white'
                        : 'text-[#3F5E45] hover:text-[#3F5E45] bg-[#E8DCC4]'
                    }`}
                  >
                    <Send size={14} />
                    <span>Instagram Mesajı</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPitchTab('cold_call')}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      pitchTab === 'cold_call'
                        ? 'bg-[#6F8F72] text-white'
                        : 'text-[#3F5E45] hover:text-[#3F5E45] bg-[#E8DCC4]'
                    }`}
                  >
                    <PhoneCall size={14} />
                    <span>Telefon Konuşma Metni</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCopyPitch}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E8DCC4] hover:bg-[#B7C9A8] text-xs font-semibold text-[#3F5E45] border border-[#3F5E45] transition-colors cursor-pointer"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Kopyalandı' : 'Yazıyı Kopyala'}</span>
                </button>
              </div>

              {/* Mesaj Alanı ve Gönderim Butonları */}
              <div className="p-6 space-y-4">
                {pitchTab === 'email' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#3F5E45]/80 mb-1.5">
                      E-posta Konusu
                    </label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={e => setEmailSubject(e.target.value)}
                      className="w-full bg-[#FFF8E7] border border-[#3F5E45] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#3F5E45]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#3F5E45]/80 mb-1.5">
                    {pitchTab === 'whatsapp'
                      ? 'WhatsApp Mesajı (Göndermeden önce üzerinde değişiklik yapabilirsiniz)'
                      : pitchTab === 'email'
                        ? 'E-posta Metni (Göndermeden önce üzerinde değişiklik yapabilirsiniz)'
                        : pitchTab === 'instagram'
                          ? 'Instagram Mesajı'
                          : 'Telefonla Aradığınızda Söyleyebileceğiniz Konuşma Metni'}
                  </label>
                  <textarea
                    rows={pitchTab === 'email' || pitchTab === 'cold_call' ? 9 : 6}
                    value={getActivePitchText()}
                    onChange={e => setActivePitchText(e.target.value)}
                    className="w-full text-sm text-[#3F5E45] font-sans leading-relaxed bg-[#FFF8E7] p-4 rounded-xl border border-[#3F5E45] focus:outline-none focus:border-[#3F5E45] resize-y"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#6F8F72] hover:bg-[#6F8F72] text-white text-sm font-semibold transition-colors"
                    >
                      <MessageSquare size={16} />
                      <span>WhatsApp ile Gönder ({effectivePhone})</span>
                    </a>
                  )}
                  {mailUrl && (
                    <a
                      href={mailUrl}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
                    >
                      <Mail size={16} />
                      <span>E-posta Gönder ({effectiveEmail})</span>
                    </a>
                  )}
                  {socialLinks.instagram && (
                    <a
                      href={socialLinks.instagram}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors"
                    >
                      <Send size={16} />
                      <span>Instagram Sayfasını Aç</span>
                    </a>
                  )}
                  {effectivePhone && (
                    <a
                      href={`tel:${effectivePhone}`}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E8DCC4] hover:bg-[#B7C9A8] text-[#3F5E45] border border-[#3F5E45] text-sm font-semibold transition-colors"
                    >
                      <PhoneCall size={16} className="text-[#3F5E45]" />
                      <span>Telefonla Ara ({effectivePhone})</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* SEKME 3: CANLI ÖRNEK SİTE ÖNİZLEMESİ */
            <div className="space-y-4">
              <div className="bg-[#FFF8E7] p-4 rounded-2xl border border-[#3F5E45] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {auditResult.merchantName} — Örnek Web Sitesi Taslağı
                  </h3>
                  <p className="text-xs text-[#3F5E45]/80 mt-0.5">
                    İşletmenin adı, sektörü, telefonu, adresi ve çalışma saatleri kullanılarak otomatik oluşturuldu.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex bg-[#E8DCC4] p-1 rounded-xl border border-[#3F5E45]">
                    <button
                      type="button"
                      onClick={() => setDemoPreviewDevice('desktop')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        demoPreviewDevice === 'desktop'
                          ? 'bg-[#6F8F72] text-white'
                          : 'text-[#3F5E45]/80 hover:text-[#3F5E45]'
                      }`}
                    >
                      <Monitor size={14} />
                      <span>Bilgisayar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDemoPreviewDevice('mobile')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        demoPreviewDevice === 'mobile'
                          ? 'bg-[#6F8F72] text-white'
                          : 'text-[#3F5E45]/80 hover:text-[#3F5E45]'
                      }`}
                    >
                      <Smartphone size={14} />
                      <span>Telefon</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenDemoInNewTab}
                    disabled={!demoSiteHtml}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E8DCC4] hover:bg-[#B7C9A8] text-[#3F5E45] border border-[#3F5E45] text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    <ExternalLink size={14} />
                    <span>Yeni Sekmede Tam Ekran Aç</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadDemoHtml}
                    disabled={!demoSiteHtml}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#6F8F72] hover:bg-[#6F8F72] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    <FileDown size={14} />
                    <span>Taslak Siteyi İndir (.html)</span>
                  </button>
                </div>
              </div>

              {isGeneratingDemoSite ? (
                <div className="bg-[#FFF8E7] border border-[#3F5E45] rounded-2xl p-16 text-center text-[#3F5E45] animate-pulse">
                  İşletmeye özel örnek web sitesi hazırlanıyor...
                </div>
              ) : demoSiteHtml ? (
                <div className="bg-[#FFF8E7] border border-[#3F5E45] rounded-2xl p-4 flex justify-center overflow-hidden">
                  <iframe
                    title={`${auditResult.merchantName} Örnek Web Sitesi`}
                    srcDoc={demoSiteHtml}
                    className={`bg-white rounded-xl border border-[#3F5E45] shadow-2xl transition-all duration-200 ${
                      demoPreviewDevice === 'mobile'
                        ? 'w-[390px] h-[640px]'
                        : 'w-full h-[560px]'
                    }`}
                  />
                </div>
              ) : (
                <div className="bg-[#FFF8E7] border border-[#3F5E45] rounded-2xl p-12 text-center text-[#3F5E45]/80 text-sm">
                  Örnek site önizlemesi yüklenemedi.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Alt Aksiyon Çubuğu */}
        <div className="px-6 py-4 border-t border-[#3F5E45] bg-[#FFF8E7] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="bg-[#E8DCC4] hover:bg-[#B7C9A8] text-[#3F5E45] border border-[#3F5E45] px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
          >
            Kapat
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleOpenDemoSite}
              title="İşletmeye Özel Canlı Örnek Web Sitesi Taslağı Oluştur"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-xs font-semibold transition-colors cursor-pointer"
            >
              <LayoutTemplate size={16} />
              <span>Örnek Site Oluştur</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="px-4 py-2.5 rounded-xl bg-[#E8DCC4] hover:bg-[#B7C9A8] text-[#3F5E45] border border-[#3F5E45] text-sm font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <FileDown size={16} />
              <span>{isExportingPdf ? 'PDF İndiriliyor...' : 'PDF Rapor İndir'}</span>
            </button>
            <button
              onClick={onSaveLead}
              disabled={isSavingLead || saveLeadSuccess}
              className={`px-5 py-2.5 rounded-xl transition-colors text-sm font-semibold flex items-center gap-2 cursor-pointer ${
                saveLeadSuccess
                  ? 'bg-[#6F8F72] text-white'
                  : 'bg-[#6F8F72] hover:bg-[#6F8F72] text-white disabled:opacity-50 shadow-lg shadow-none'
              }`}
            >
              <BookmarkPlus size={17} />
              <span>
                {isSavingLead
                  ? 'Kaydediliyor...'
                  : saveLeadSuccess
                    ? 'Listeye Kaydedildi'
                    : 'Listeme Kaydet'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
