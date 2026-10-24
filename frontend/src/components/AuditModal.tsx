import React, { useState, useEffect } from 'react';
import {
  X,
  Globe,
  Clock,
  FileCode2,
  BarChart3,
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
  Layers,
  Sparkles,
  SearchCode,
  Wand2,
  KeyRound,
  SlidersHorizontal,
  PhoneCall,
  Send
} from 'lucide-react';
import { getAiStatus, saveAiConfig, generateCustomPitch } from '../api';

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

type PitchChannelTab = 'whatsapp' | 'email' | 'instagram' | 'cold_call';

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

  const [pitchTab, setPitchTab] = useState<PitchChannelTab>('whatsapp');
  const [copied, setCopied] = useState(false);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  // Yapay Zeka (Google Gemini) Teklif Üretici Durumları
  const [tone, setTone] = useState<string>('kurumsal');
  const [focusService, setFocusService] = useState<string>('auto');
  const [senderName, setSenderName] = useState<string>('');
  const [agencyName, setAgencyName] = useState<string>('');
  const [specialOffer, setSpecialOffer] = useState<string>('');
  const [customInstruction, setCustomInstruction] = useState<string>('');
  const [showAdvancedParams, setShowAdvancedParams] = useState<boolean>(false);
  const [isGeneratingPitch, setIsGeneratingPitch] = useState<boolean>(false);
  const [pitchStatusMessage, setPitchStatusMessage] = useState<string | null>(null);

  // Gemini API Anahtarı Yapılandırma Durumları
  const [aiStatus, setAiStatus] = useState<{ configured: boolean; masked_key?: string | null; model: string }>({
    configured: false,
    masked_key: null,
    model: 'gemini-2.5-flash'
  });
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [isSavingApiKey, setIsSavingApiKey] = useState<boolean>(false);

  // Canlı düzenlenebilir teklif metinleri
  const [whatsappPitch, setWhatsappPitch] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailPitch, setEmailPitch] = useState<string>('');
  const [instagramPitch, setInstagramPitch] = useState<string>('');
  const [coldCallScript, setColdCallScript] = useState<string>('');
  const [recommendedPackage, setRecommendedPackage] = useState<string>('');
  const [valuePropositions, setValuePropositions] = useState<string[]>([]);
  const [engineUsed, setEngineUsed] = useState<string>('smart_hybrid_ai');

  useEffect(() => {
    if (!auditResult) return;
    setWhatsappPitch(auditResult.sales_pitch_whatsapp || '');
    setEmailSubject(
      auditResult.email_subject ||
        `${auditResult.merchantName} - Dijital Görünürlük ve Teknik Analiz Raporu`
    );
    setEmailPitch(auditResult.sales_pitch_email || '');
    setInstagramPitch(
      auditResult.instagram_dm_pitch ||
        `Merhaba ${auditResult.merchantName}! İşletmenizin dijital görünürlüğünü ve müşteri dönüşümünü artıracak özel web/SEO çalışmamızı paylaşmak isteriz.`
    );
    setColdCallScript(
      auditResult.cold_call_script ||
        `1. AÇILIŞ: Merhaba, ${auditResult.merchantName} yetkilisi ile mi görüşüyorum?\n2. TESPİT: Bölgenizdeki işletmelerin dijital görünürlüğünü incelerken işletmenizin web ve Google Harita potansiyelini analiz ettik.\n3. ÇÖZÜM: Müşterilerin doğrudan size ulaşmasını sağlayan kurumsal web ve yerel SEO paketimiz bulunuyor.\n4. KAPANIŞ: Hazırladığımız örnek çalışmayı WhatsApp numaranıza iletebilir miyim?`
    );
    setRecommendedPackage(auditResult.recommended_package || '');
    setValuePropositions(auditResult.value_propositions || []);
    setEngineUsed(auditResult.ai_engine_used || 'smart_hybrid_ai');
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
  const effectivePhone =
    merchant.phone ||
    auditResult.scraped_whatsapp ||
    (auditResult.scraped_phones && auditResult.scraped_phones.length > 0 ? auditResult.scraped_phones[0] : null);
  const effectiveEmail =
    merchant.email ||
    (auditResult.scraped_emails && auditResult.scraped_emails.length > 0 ? auditResult.scraped_emails[0] : null);

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
          ? 'Google Gemini API anahtarı kaydedildi. Şimdi Gemini 2.5 Flash ile teklif üretebilirsiniz.'
          : 'API anahtarı temizlendi; Akıllı Hibrit Teklif Motoru aktif.'
      );
      setTimeout(() => setPitchStatusMessage(null), 4000);
    } catch (err: any) {
      setPitchStatusMessage(err.message || 'API anahtarı kaydedilemedi.');
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
      setEngineUsed(res.engine_used || 'smart_hybrid_ai');

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

      setPitchStatusMessage(
        res.engine_used === 'google_gemini'
          ? `Google Gemini (${res.model_name}) ile kişiselleştirilmiş teklifler başarıyla üretildi.`
          : 'Röntgen verilerine dayalı kişiselleştirilmiş teklifler başarıyla güncellendi.'
      );
      setTimeout(() => setPitchStatusMessage(null), 4000);
    } catch (err: any) {
      setPitchStatusMessage(err.message || 'Teklif üretilirken bir hata oluştu.');
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
        `Merhaba ${auditResult.merchantName}, işletmenizin dijital varlığını inceledik ve bilgi vermek isteriz.`
    );
    return `https://wa.me/${phoneWithCountry}?text=${text}`;
  };

  const getMailtoLink = () => {
    if (!effectiveEmail) return null;
    const subject = encodeURIComponent(
      emailSubject || `${auditResult.merchantName} - Dijital Görünürlük ve Teknik Analiz Raporu`
    );
    const body = encodeURIComponent(emailPitch || auditResult.ai_summary || '');
    return `mailto:${effectiveEmail}?subject=${subject}&body=${body}`;
  };

  const waUrl = getWhatsAppPitchLink();
  const mailUrl = getMailtoLink();

  const checkItems = [
    { label: 'Web Sitesi', ok: Boolean(auditResult.has_website), okText: 'Mevcut', failText: 'Yok' },
    { label: 'SSL Sertifikası (HTTPS)', ok: Boolean(auditResult.ssl_valid), okText: 'Geçerli', failText: 'Güvensiz / Yok' },
    { label: 'Mobil Uyumluluk (Viewport)', ok: Boolean(auditResult.mobile_ready), okText: 'Uyumlu', failText: 'Uyumsuz' },
    { label: 'SEO Sayfa Başlığı (Title)', ok: Boolean(auditResult.has_title), okText: 'Mevcut', failText: 'Eksik' },
    { label: 'Meta Açıklama (Description)', ok: Boolean(auditResult.has_meta_description), okText: 'Mevcut', failText: 'Eksik' },
    { label: 'H1 Ana Başlık Etiketi', ok: Boolean(auditResult.has_h1), okText: 'Mevcut', failText: 'Eksik' },
    { label: 'OpenGraph Sosyal Paylaşım', ok: Boolean(auditResult.has_og_tags), okText: 'Mevcut', failText: 'Eksik' },
    { label: 'Schema.org Yapısal Veri', ok: Boolean(auditResult.has_schema), okText: 'Kurulu', failText: 'Yok' },
    { label: 'Google Analytics / GTM', ok: Boolean(auditResult.has_analytics), okText: 'Kurulu', failText: 'Yok' },
    { label: 'Meta / Facebook Pixel', ok: Boolean(auditResult.has_pixel), okText: 'Kurulu', failText: 'Yok' },
  ];

  const allEmails: string[] = Array.from(
    new Set([
      ...(merchant.email ? [merchant.email] : []),
      ...(auditResult.scraped_emails || [])
    ])
  );
  const allPhones: string[] = Array.from(
    new Set([
      ...(merchant.phone ? [merchant.phone] : []),
      ...(auditResult.scraped_phones || [])
    ])
  );
  const socialLinks: Record<string, string> = {
    ...(merchant.instagram ? { instagram: merchant.instagram } : {}),
    ...(auditResult.social_links || {})
  };
  const crawledPages: string[] = auditResult.crawled_pages || [];

  const getWebsiteSourceLabel = (src?: string) => {
    if (src === 'brand_chain') return 'Kurumsal Zincir Veritabanı';
    if (src === 'web_search') return 'Derin Web Keşfi ile Bulundu';
    if (src === 'osm') return 'Harita Kaydı';
    return null;
  };

  const websiteSourceLabel = getWebsiteSourceLabel(auditResult.website_source);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-800 w-full max-w-4xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col">
        {/* Başlık Çubuğu */}
        <div className="bg-slate-900 px-6 py-4 border-b border-slate-700 flex justify-between items-center shrink-0">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Derinleştirilmiş Web Röntgeni & Kazıyıcı
              </span>
              {auditResult.cms_platform && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-300 bg-purple-500/15 px-2.5 py-0.5 rounded-full border border-purple-500/30">
                  <Layers size={12} />
                  {auditResult.cms_platform}
                </span>
              )}
              {websiteSourceLabel && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-300 bg-blue-500/15 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                  <Sparkles size={12} />
                  {websiteSourceLabel}
                </span>
              )}
              {auditResult.response_time_ms != null && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  <Clock size={12} className="text-emerald-400" />
                  {auditResult.response_time_ms} ms
                </span>
              )}
              {auditResult.http_status && (
                <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  HTTP {auditResult.http_status}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white mt-1.5">
              {auditResult.merchantName}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {onReAudit && (
              <button
                onClick={onReAudit}
                title="Derin Taramayı Yeniden Çalıştır"
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 border border-slate-700 transition-colors cursor-pointer"
              >
                <RefreshCw size={16} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Kaydırılabilir İçerik */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Otomatik Keşif Bildirim Bandı */}
          {effectiveWebsite && (auditResult.website_source === 'web_search' || auditResult.website_source === 'brand_chain') && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-300">
                <Sparkles size={16} className="text-emerald-400 shrink-0" />
                <span>
                  {auditResult.website_source === 'brand_chain'
                    ? 'Bu işletmenin kurumsal zincir şubesi olduğu tespit edildi ve resmi web adresi otomatik olarak bağlandı:'
                    : 'Harita kaydında web sitesi olmamasına rağmen Derin Web Kazıyıcı işletmenin resmi web sitesini otomatik olarak keşfetti:'}
                </span>
              </div>
              <a
                href={effectiveWebsite.startsWith('http') ? effectiveWebsite : `https://${effectiveWebsite}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-emerald-400 hover:underline"
              >
                <Globe size={13} />
                <span>{effectiveWebsite}</span>
                <ExternalLink size={12} />
              </a>
            </div>
          )}

          {/* Üst Özet ve 10 Kriterli Teknik Denetim Karnesi */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sol: Fırsat Puanı ve Taranan Sayfalar */}
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Satış Fırsat Puanı
              </p>
              <p className="text-5xl font-black text-emerald-400 my-2">
                {auditResult.score}
                <span className="text-lg text-slate-500 font-semibold">/100</span>
              </p>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                {auditResult.score >= 80
                  ? 'Çok Yüksek Satış Potansiyeli'
                  : auditResult.score >= 55
                    ? 'Orta-Yüksek İyileştirme Fırsatı'
                    : 'Büyüme & Reklam Odaklı Fırsat'}
              </span>

              {effectiveWebsite && (
                <a
                  href={effectiveWebsite.startsWith('http') ? effectiveWebsite : `https://${effectiveWebsite}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs text-blue-400 hover:underline truncate max-w-full"
                >
                  <Globe size={12} />
                  <span className="truncate">{effectiveWebsite.replace(/^https?:\/\//, '')}</span>
                  <ExternalLink size={11} />
                </a>
              )}

              {crawledPages.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-800 w-full text-left">
                  <p className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                    <SearchCode size={12} className="text-emerald-400" />
                    <span>Kazınan Alt Sayfalar ({crawledPages.length})</span>
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {crawledPages.map((pg, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-mono bg-slate-800 text-emerald-300 px-2 py-0.5 rounded border border-slate-700"
                      >
                        {pg}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sağ: 10 Kriterli Teknik Denetim Karnesi */}
            <div className="md:col-span-2 bg-slate-900 p-4 rounded-xl border border-slate-700">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-300 mb-3 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <FileCode2 size={15} className="text-emerald-400" />
                  <span>10 Kriterli Teknik Altyapı, SEO ve Piksel Denetim Karnesi</span>
                </div>
                {auditResult.cms_platform && (
                  <span className="text-[11px] text-slate-400">
                    Altyapı: <strong className="text-emerald-400">{auditResult.cms_platform}</strong>
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {checkItems.map((item, idx) => (
                  <div
                    key={idx}
                    className={`px-3 py-2 rounded-lg border text-xs flex items-center justify-between ${
                      item.ok
                        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                    }`}
                  >
                    <span className="font-medium text-slate-200">{item.label}</span>
                    <span className="inline-flex items-center gap-1 font-semibold">
                      {item.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                      {item.ok ? item.okText : item.failText}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Derin İletişim ve Sosyal Medya Kazıyıcı (Deep Web Scraper) Paneli */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                <BarChart3 size={15} />
                <span>Derin İletişim & Sosyal Medya Kazıyıcı Sonuçları</span>
              </div>
              <span className="text-[11px] text-slate-400">
                Ana sayfa ve iletişim alt sayfalarından otomatik çıkarılan veriler
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Telefon & WhatsApp Kutusu */}
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-2">
                <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <Phone size={12} className="text-emerald-400" />
                  <span>Telefon & WhatsApp Hatları ({allPhones.length})</span>
                </p>
                {allPhones.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Telefon numarası tespit edilemedi.</p>
                ) : (
                  <div className="space-y-1.5">
                    {allPhones.map((ph, i) => (
                      <div
                        key={`ph-${i}`}
                        className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded bg-slate-800/90 border border-slate-700 text-xs"
                      >
                        <a href={`tel:${ph}`} className="text-slate-200 hover:text-emerald-400 font-medium truncate">
                          {ph}
                        </a>
                        <div className="flex items-center gap-1 shrink-0">
                          <a
                            href={`https://wa.me/${formatWhatsAppNumber(ph)}`}
                            target="_blank"
                            rel="noreferrer"
                            title="WhatsApp ile Yaz"
                            className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[10px] font-semibold"
                          >
                            WA
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopyValue(ph)}
                            title="Numarayı Kopyala"
                            className="p-1 text-slate-400 hover:text-white cursor-pointer"
                          >
                            {copiedItem === ph ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {auditResult.scraped_whatsapp && (
                  <div className="pt-1">
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      Doğrudan WhatsApp Hattı Aktif: {auditResult.scraped_whatsapp}
                    </span>
                  </div>
                )}
              </div>

              {/* E-posta Kutusu */}
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-2">
                <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <Mail size={12} className="text-blue-400" />
                  <span>E-posta Adresleri ({allEmails.length})</span>
                </p>
                {allEmails.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">E-posta adresi tespit edilemedi.</p>
                ) : (
                  <div className="space-y-1.5">
                    {allEmails.map((em, i) => (
                      <div
                        key={`em-${i}`}
                        className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded bg-slate-800/90 border border-slate-700 text-xs"
                      >
                        <a
                          href={`mailto:${em}`}
                          className="text-slate-200 hover:text-blue-400 truncate font-medium"
                          title={em}
                        >
                          {em}
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopyValue(em)}
                          title="E-postayı Kopyala"
                          className="p-1 text-slate-400 hover:text-white cursor-pointer shrink-0"
                        >
                          {copiedItem === em ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sosyal Medya Kutusu */}
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-2">
                <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <Globe size={12} className="text-purple-400" />
                  <span>Sosyal Medya Profilleri ({Object.keys(socialLinks).length})</span>
                </p>
                {Object.keys(socialLinks).length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Sosyal medya bağlantısı bulunamadı.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(socialLinks).map(([platform, link]) => (
                      <a
                        key={platform}
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-blue-400 hover:underline capitalize"
                      >
                        <ExternalLink size={11} />
                        <span>{platform}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sayfa Başlığı, H1 ve Meta Açıklama İçerik Röntgeni */}
            {(auditResult.page_title || auditResult.h1_text || auditResult.meta_description) && (
              <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Sayfa Başlığı (Title)</span>
                  <p className="text-slate-300 mt-0.5 line-clamp-2">{auditResult.page_title || 'Belirtilmemiş'}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">H1 Ana Başlık</span>
                  <p className="text-slate-300 mt-0.5 line-clamp-2">{auditResult.h1_text || 'Belirtilmemiş'}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Meta Açıklama (SEO)</span>
                  <p className="text-slate-300 mt-0.5 line-clamp-2">{auditResult.meta_description || 'Belirtilmemiş'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Analiz Özeti & Satılabilir Hizmetler */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-2">
                Teftiş ve Analiz Özeti
              </h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                {auditResult.ai_summary}
              </p>
            </div>

            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-2">
                Önerilen Hizmet Teklifleri (Fırsatlar)
              </h3>
              <div className="flex flex-wrap gap-2">
                {(auditResult.opportunities || []).map((opp: string, i: number) => (
                  <span
                    key={i}
                    className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-medium"
                  >
                    + {opp}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* YAPAY ZEKA (GOOGLE GEMINI) DESTEKLİ KİŞİSELLEŞTİRİLMİŞ TEKLİF ÜRETİCİ STÜDYOSU */}
          <div className="bg-slate-900 rounded-xl border border-emerald-500/40 shadow-lg overflow-hidden">
            {/* Üst Başlık ve Gemini Durum Çubuğu */}
            <div className="px-4 py-3 bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Wand2 size={15} />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <span>Yapay Zeka (Google Gemini) Kişiselleştirilmiş Teklif Üretici</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                        aiStatus.configured || engineUsed === 'google_gemini'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      }`}
                    >
                      {aiStatus.configured || engineUsed === 'google_gemini'
                        ? 'Google Gemini 2.5 Flash Aktif'
                        : 'Akıllı Hibrit AI Motoru Aktif'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    İşletmenin röntgen bulgularına, seçtiğiniz üsluba ve hizmet paketine göre 4 farklı kanalda satış teklifi üretir.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdvancedParams(!showAdvancedParams)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    showAdvancedParams
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                  }`}
                >
                  <SlidersHorizontal size={13} />
                  <span>Ajans & Kampanya Ayarları</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowApiKeyModal(!showApiKeyModal)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                  title="Google Gemini API Anahtarını Yapılandır"
                >
                  <KeyRound size={13} className="text-emerald-400" />
                  <span>{aiStatus.configured ? `API (${aiStatus.masked_key})` : 'Gemini API Anahtarı'}</span>
                </button>
              </div>
            </div>

            {/* Gemini API Anahtarı Ayar Çekmecesi */}
            {showApiKeyModal && (
              <form
                onSubmit={handleSaveApiKey}
                className="p-4 bg-slate-950/90 border-b border-slate-800 space-y-2.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-400">
                    Google Gemini API Anahtarı Yapılandırması (gemini-2.5-flash)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Anahtarınız sunucu .env dosyasına güvenli şekilde kaydedilir
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                    placeholder="Google AI Studio API Anahtarınızı girin (AIzaSy...)"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={isSavingApiKey}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {isSavingApiKey ? 'Kaydediliyor...' : 'Anahtarı Kaydet'}
                  </button>
                </div>
              </form>
            )}

            {/* Teklif Parametre Seçicileri (Üslup, Odak Paket ve Yeniden Üret Butonu) */}
            <div className="p-4 bg-slate-950/40 border-b border-slate-800 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-4">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Teklif Üslubu / İletişim Tonu
                  </label>
                  <select
                    value={tone}
                    onChange={e => setTone(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="kurumsal">Kurumsal & Resmi Danışmanlık Dili</option>
                    <option value="samimi">Samimi, Esnaf Dostu & Güven Veren Dil</option>
                    <option value="ikna_edici">İkna Edici & Ciro / Rakip Vurgulu Dil</option>
                    <option value="kisa_net">Kısa, Net & Doğrudan Randevu Odaklı</option>
                  </select>
                </div>

                <div className="md:col-span-5">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Odaklanılacak Dijital Hizmet Paketi
                  </label>
                  <select
                    value={focusService}
                    onChange={e => setFocusService(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="auto">Otomatik (Röntgen Eksiklerine Göre En Uygun Paket)</option>
                    <option value="web_tasarim">Yeni Nesil Mobil Uyumlu Web Sitesi & Kurumsal Kimlik</option>
                    <option value="yerel_seo">Google Haritalar (Yerel SEO) & Bölgesel Müşteri Kazanımı</option>
                    <option value="performans_reklam">Instagram / Google Ads & Meta Pixel Dönüşüm Paketi</option>
                    <option value="e_ticaret">Online Sipariş / Rezervasyon & WhatsApp Satış Otomasyonu</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <button
                    type="button"
                    onClick={handleGenerateAiPitch}
                    disabled={isGeneratingPitch}
                    className="w-full flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 px-3 rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-md shadow-emerald-500/20"
                  >
                    <Sparkles size={14} className={isGeneratingPitch ? 'animate-spin' : ''} />
                    <span>{isGeneratingPitch ? 'Teklif Üretiliyor...' : 'Yapay Zeka ile Üret'}</span>
                  </button>
                </div>
              </div>

              {/* Gelişmiş Ajans / Kampanya / Özel Talimat Alanları */}
              {showAdvancedParams && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80 text-xs">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Gönderici / Danışman Adı</label>
                    <input
                      type="text"
                      value={senderName}
                      onChange={e => setSenderName(e.target.value)}
                      placeholder="Örn: Ahmet Yılmaz"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Ajans / Firma Adı</label>
                    <input
                      type="text"
                      value={agencyName}
                      onChange={e => setAgencyName(e.target.value)}
                      placeholder="Örn: Nova Dijital Ajans"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Özel Kampanya / İndirim Fırsatı</label>
                    <input
                      type="text"
                      value={specialOffer}
                      onChange={e => setSpecialOffer(e.target.value)}
                      placeholder="Örn: Bu haftaya özel ücretsiz Google Harita SEO kaydı hediye"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Ek Yapay Zeka Talimatı (İsteğe Bağlı)</label>
                    <input
                      type="text"
                      value={customInstruction}
                      onChange={e => setCustomInstruction(e.target.value)}
                      placeholder="Örn: Online randevu modülüne özellikle vurgu yap"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}

              {pitchStatusMessage && (
                <div className="px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>{pitchStatusMessage}</span>
                </div>
              )}

              {/* Önerilen Paket ve Değer Önerisi Özeti */}
              {recommendedPackage && (
                <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-400">
                      Önerilen Çözüm Paketi:
                    </span>
                    <span className="text-xs font-bold text-emerald-400">
                      {recommendedPackage}
                    </span>
                  </div>
                  {valuePropositions.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
                      {valuePropositions.map((vp, idx) => (
                        <div
                          key={idx}
                          className="text-[11px] text-slate-300 bg-slate-950/60 px-2.5 py-1.5 rounded border border-slate-800/80"
                        >
                          • {vp}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 4 Kanallı Teklif Sekmeleri */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-950/60 border-b border-slate-800">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPitchTab('whatsapp')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    pitchTab === 'whatsapp'
                      ? 'bg-emerald-500 text-white'
                      : 'text-slate-400 hover:text-white bg-slate-800'
                  }`}
                >
                  <MessageSquare size={13} />
                  <span>WhatsApp Mesajı</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPitchTab('email')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    pitchTab === 'email'
                      ? 'bg-emerald-500 text-white'
                      : 'text-slate-400 hover:text-white bg-slate-800'
                  }`}
                >
                  <Mail size={13} />
                  <span>Kurumsal E-posta</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPitchTab('instagram')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    pitchTab === 'instagram'
                      ? 'bg-emerald-500 text-white'
                      : 'text-slate-400 hover:text-white bg-slate-800'
                  }`}
                >
                  <Send size={13} />
                  <span>Instagram DM</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPitchTab('cold_call')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    pitchTab === 'cold_call'
                      ? 'bg-emerald-500 text-white'
                      : 'text-slate-400 hover:text-white bg-slate-800'
                  }`}
                >
                  <PhoneCall size={13} />
                  <span>Telefon Senaryosu</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyPitch}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-emerald-400 border border-slate-700 transition-colors cursor-pointer"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                <span>{copied ? 'Kopyalandı' : 'Metni Kopyala'}</span>
              </button>
            </div>

            {/* Düzenlenebilir Teklif İçeriği ve Hızlı Gönderim Aksiyonları */}
            <div className="p-4 space-y-3">
              {pitchTab === 'email' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    E-posta Konu Başlığı
                  </label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={e => setEmailSubject(e.target.value)}
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-slate-400">
                    {pitchTab === 'whatsapp'
                      ? 'WhatsApp Teklif Metni (Göndermeden önce düzenleyebilirsiniz)'
                      : pitchTab === 'email'
                        ? 'Kurumsal E-posta Gövdesi (Göndermeden önce düzenleyebilirsiniz)'
                        : pitchTab === 'instagram'
                          ? 'Instagram DM Satış Mesajı'
                          : 'Adım Adım Telefon Satış Konuşma Rehberi'}
                  </span>
                </div>
                <textarea
                  rows={pitchTab === 'email' || pitchTab === 'cold_call' ? 8 : 5}
                  value={getActivePitchText()}
                  onChange={e => setActivePitchText(e.target.value)}
                  className="w-full text-xs text-slate-100 font-sans leading-relaxed bg-slate-950/70 p-3.5 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500 resize-y"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {waUrl && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                  >
                    <MessageSquare size={14} />
                    <span>WhatsApp ile Doğrudan Gönder ({effectivePhone})</span>
                  </a>
                )}
                {mailUrl && (
                  <a
                    href={mailUrl}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                  >
                    <Mail size={14} />
                    <span>E-posta İstemcisinde Aç ({effectiveEmail})</span>
                  </a>
                )}
                {socialLinks.instagram && (
                  <a
                    href={socialLinks.instagram}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors"
                  >
                    <Send size={14} />
                    <span>Instagram Profilini Aç</span>
                  </a>
                )}
                {effectivePhone && (
                  <a
                    href={`tel:${effectivePhone}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
                  >
                    <PhoneCall size={14} className="text-emerald-400" />
                    <span>İşletmeyi Ara ({effectivePhone})</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Alt Aksiyon Çubuğu */}
        <div className="px-6 py-4 border-t border-slate-700 bg-slate-900 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Kapat
          </button>
          <button
            onClick={onSaveLead}
            disabled={isSavingLead || saveLeadSuccess}
            className={`px-5 py-2.5 rounded-lg transition-colors text-xs font-semibold flex items-center gap-2 cursor-pointer ${
              saveLeadSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 shadow-lg shadow-emerald-500/20'
            }`}
          >
            <BookmarkPlus size={16} />
            <span>
              {isSavingLead
                ? 'Kaydediliyor...'
                : saveLeadSuccess
                  ? 'Müşteri Listenize Kaydedildi'
                  : 'Listeme Kaydet (CRM)'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
