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
  Smartphone,
  ChevronDown,
  ChevronUp
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
    const parts = raw.split(/[;,]/);
    for (const part of parts) {
      let digits = part.replace(/\D/g, '');
      if (!digits) continue;

      if (digits.length === 7 && digits.startsWith('444')) {
        const key = digits;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          result.push(`444 ${digits.slice(3, 5)} ${digits.slice(5, 7)}`);
        }
        continue;
      }

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

  // Detayları gizleyen / butonla açan durumlar
  const [showOpportunities, setShowOpportunities] = useState(false);
  const [showTechnicalChecklist, setShowTechnicalChecklist] = useState(false);
  const [showPitchCustomizer, setShowPitchCustomizer] = useState(false);

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
    setShowOpportunities(false);
    setShowTechnicalChecklist(false);
    setShowPitchCustomizer(false);
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
      setPitchStatusMessage((err instanceof Error ? err.message : '') || 'PDF raporu indirilemedi.');
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
      setPitchStatusMessage((err instanceof Error ? err.message : '') || 'Örnek site taslağı oluşturulamadı.');
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
      setPitchStatusMessage((err instanceof Error ? err.message : '') || 'Anahtar kaydedilemedi.');
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
      setPitchStatusMessage((err instanceof Error ? err.message : '') || 'Teklif oluşturulurken bir hata oluştu.');
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
    { label: 'Güvenli Bağlantı (SSL)', ok: Boolean(auditResult.ssl_valid), okText: 'Güvenli', failText: 'Yok' },
    { label: 'Telefon ve Tablet Uyumu', ok: Boolean(auditResult.mobile_ready), okText: 'Uyumlu', failText: 'Uyumsuz' },
    { label: 'Google Arama Başlığı', ok: Boolean(auditResult.has_title), okText: 'Mevcut', failText: 'Eksik' },
    { label: 'Google Tanıtım Yazısı', ok: Boolean(auditResult.has_meta_description), okText: 'Mevcut', failText: 'Eksik' },
    { label: 'Ziyaretçi Sayacı', ok: Boolean(auditResult.has_analytics), okText: 'Kurulu', failText: 'Yok' },
    { label: 'Reklam Takip Kodu', ok: Boolean(auditResult.has_pixel), okText: 'Kurulu', failText: 'Yok' },
    { label: 'Sosyal Medya Önizlemesi', ok: Boolean(auditResult.has_og_tags), okText: 'Mevcut', failText: 'Eksik' },
  ];

  const missingCount = checkItems.filter(c => !c.ok).length;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-[var(--theme-surface)] w-full max-w-5xl rounded-2xl border border-[var(--theme-border)] shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Sade Üst Başlık */}
        <div className="bg-[var(--theme-canvas)] px-7 py-5 border-b border-[var(--theme-border)] flex justify-between items-center gap-4 shrink-0">
          <div>
            <span className="text-xs font-semibold text-[var(--theme-primary)]">
              {merchant.category_label || merchant.category || 'İşletme İnceleme Raporu'}
            </span>
            <h2 className="text-2xl font-bold text-[var(--theme-contrast)] mt-0.5">
              {auditResult.merchantName}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {onReAudit && (
              <button
                onClick={onReAudit}
                title="İncelemeyi Yenile"
                className="p-2.5 rounded-xl bg-[var(--theme-surface)] hover:bg-[var(--theme-muted)] text-[var(--theme-contrast)] border border-[var(--theme-border)] transition-colors cursor-pointer"
              >
                <RefreshCw size={17} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-[var(--theme-surface)] hover:bg-[var(--theme-muted)] text-[var(--theme-contrast)]/80 hover:text-[var(--theme-contrast)] border border-[var(--theme-border)] transition-colors cursor-pointer"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {/* 3 Ana Sekme Çubuğu */}
        <div className="bg-[var(--theme-canvas)] px-7 py-3 border-b border-[var(--theme-border)] flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMainTab('overview')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              mainTab === 'overview'
                ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)]'
                : 'bg-[var(--theme-surface)] text-[var(--theme-contrast)] hover:bg-[var(--theme-muted)] border border-[var(--theme-border)]'
            }`}
          >
            <FileText size={16} />
            <span>1. Özet ve İletişim</span>
          </button>

          <button
            type="button"
            onClick={() => setMainTab('proposal')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              mainTab === 'proposal'
                ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)]'
                : 'bg-[var(--theme-surface)] text-[var(--theme-contrast)] hover:bg-[var(--theme-muted)] border border-[var(--theme-border)]'
            }`}
          >
            <Wand2 size={16} />
            <span>2. Hazır Teklif Mesajı</span>
          </button>

          <button
            type="button"
            onClick={handleOpenDemoSite}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              mainTab === 'demo_site'
                ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)]'
                : 'bg-[var(--theme-surface)] text-[var(--theme-contrast)] hover:bg-[var(--theme-muted)] border border-[var(--theme-border)]'
            }`}
          >
            <LayoutTemplate size={16} />
            <span>3. Örnek Site Taslağı</span>
          </button>
        </div>

        {/* Kaydırılabilir Ferah İçerik Alanı */}
        <div className="p-7 sm:p-9 space-y-7 overflow-y-auto flex-1">
          {pitchStatusMessage && (
            <div className="px-4 py-3 rounded-xl bg-[var(--theme-canvas)] border border-[var(--theme-primary)] text-[var(--theme-contrast)] text-sm flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[var(--theme-primary)] shrink-0" />
              <span>{pitchStatusMessage}</span>
            </div>
          )}

          {mainTab === 'overview' ? (
            <div className="space-y-6">
              {/* 1. Ana Özet Kartı (Geniş ve Sade) */}
              <div className="bg-[var(--theme-canvas)] p-7 rounded-2xl border border-[var(--theme-border)] flex flex-col md:flex-row items-center gap-8">
                {/* Sol: Fırsat Puanı */}
                <div className="flex flex-col items-center justify-center text-center md:border-r border-[var(--theme-border)] md:pr-8 shrink-0 min-w-[180px]">
                  <span className="text-xs font-semibold text-[var(--theme-contrast)]/70">
                    Fırsat Puanı
                  </span>
                  <div className="text-5xl font-black text-[var(--theme-primary)] my-2">
                    {auditResult.score}
                    <span className="text-xl text-[var(--theme-contrast)]/50 font-semibold">/100</span>
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[var(--theme-surface)] text-[var(--theme-contrast)] border border-[var(--theme-border)]">
                    {auditResult.score >= 80
                      ? 'Yüksek Satış Fırsatı'
                      : auditResult.score >= 55
                        ? 'Orta Seviye İhtiyaç'
                        : 'Tanıtım Fırsatı'}
                  </span>
                </div>

                {/* Sağ: Kısa Durum Özeti */}
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-[var(--theme-contrast)] mb-1.5">
                      İşletme Durum Özeti
                    </h3>
                    <p className="text-[var(--theme-contrast)]/90 text-sm leading-relaxed">
                      {auditResult.ai_summary}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--theme-border)]">
                    <div className="text-xs text-[var(--theme-contrast)]/75">
                      Önerilen Hizmet:{' '}
                      <strong className="text-[var(--theme-contrast)]">
                        {recommendedPackage || 'Telefon Uyumlu Web Sitesi ve Harita Paketi'}
                      </strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMainTab('proposal')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <span>Hazır Teklif Mesajına Geç</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. İletişim Bilgileri (3 Geniş ve Net Kutu) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Telefon & WhatsApp */}
                <div className="bg-[var(--theme-canvas)] p-5 rounded-2xl border border-[var(--theme-border)] flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--theme-contrast)]/70 flex items-center gap-2">
                      <Phone size={15} className="text-[var(--theme-primary)]" />
                      Telefon
                    </span>
                    {effectivePhone && (
                      <button
                        type="button"
                        onClick={() => handleCopyValue(effectivePhone)}
                        className="text-xs text-[var(--theme-primary)] hover:underline cursor-pointer inline-flex items-center gap-1"
                      >
                        {copiedItem === effectivePhone ? <Check size={13} /> : <Copy size={13} />}
                        <span>{copiedItem === effectivePhone ? 'Kopyalandı' : 'Kopyala'}</span>
                      </button>
                    )}
                  </div>

                  {effectivePhone ? (
                    <div className="space-y-2.5">
                      <a
                        href={`tel:${effectivePhone}`}
                        className="block text-base font-bold text-[var(--theme-contrast)] hover:text-[var(--theme-primary)]"
                      >
                        {effectivePhone}
                      </a>
                      <a
                        href={`https://wa.me/${formatWhatsAppNumber(effectivePhone)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--theme-primary)] text-[var(--theme-on-primary)] text-xs font-semibold"
                      >
                        <MessageSquare size={13} />
                        <span>WhatsApp Aç</span>
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--theme-contrast)]/55 py-2">
                      Telefon numarası kayıtlı değil
                    </p>
                  )}
                </div>

                {/* İnternet Sitesi */}
                <div className="bg-[var(--theme-canvas)] p-5 rounded-2xl border border-[var(--theme-border)] flex flex-col justify-between space-y-3">
                  <span className="text-xs font-semibold text-[var(--theme-contrast)]/70 flex items-center gap-2">
                    <Globe size={15} className="text-[var(--theme-primary)]" />
                    İnternet Sitesi
                  </span>

                  {effectiveWebsite ? (
                    <div className="space-y-2">
                      <a
                        href={effectiveWebsite.startsWith('http') ? effectiveWebsite : `https://${effectiveWebsite}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--theme-contrast)] hover:text-[var(--theme-primary)] break-all"
                      >
                        <span className="line-clamp-1">{effectiveWebsite.replace(/^https?:\/\//, '')}</span>
                        <ExternalLink size={14} className="shrink-0" />
                      </a>
                      <p className="text-xs text-[var(--theme-contrast)]/70">
                        {auditResult.cms_platform ? `Altyapı: ${auditResult.cms_platform}` : 'Site aktif durumda'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-bold text-amber-500">
                        Web Sitesi Bulunmuyor
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenDemoSite}
                        className="text-xs font-semibold text-[var(--theme-primary)] hover:underline cursor-pointer inline-flex items-center gap-1"
                      >
                        <LayoutTemplate size={13} />
                        <span>Örnek Site Taslağı Oluştur</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* E-posta ve Sosyal Medya */}
                <div className="bg-[var(--theme-canvas)] p-5 rounded-2xl border border-[var(--theme-border)] flex flex-col justify-between space-y-3">
                  <span className="text-xs font-semibold text-[var(--theme-contrast)]/70 flex items-center gap-2">
                    <Mail size={15} className="text-[var(--theme-primary)]" />
                    E-posta & Sosyal Medya
                  </span>

                  <div className="space-y-2">
                    {effectiveEmail ? (
                      <div className="flex items-center justify-between gap-2">
                        <a
                          href={`mailto:${effectiveEmail}`}
                          className="text-sm font-semibold text-[var(--theme-contrast)] hover:text-[var(--theme-primary)] truncate"
                        >
                          {effectiveEmail}
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopyValue(effectiveEmail)}
                          className="text-xs text-[var(--theme-contrast)]/70 hover:text-[var(--theme-contrast)] cursor-pointer shrink-0"
                        >
                          {copiedItem === effectiveEmail ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--theme-contrast)]/55">E-posta bulunamadı</p>
                    )}

                    {Object.keys(socialLinks).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {Object.entries(socialLinks).map(([platform, link]) => (
                          <a
                            key={platform}
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--theme-surface)] hover:bg-[var(--theme-muted)] border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-contrast)] capitalize"
                          >
                            <span>{platform}</span>
                            <ExternalLink size={11} />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--theme-contrast)]/55">Sosyal medya kaydı yok</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Ayrı Butonlarla Açılan Detay Bölümleri */}
              <div className="space-y-3 pt-1">
                {/* Buton A: Yapılabilecek İyileştirmeler */}
                <div className="bg-[var(--theme-canvas)] rounded-2xl border border-[var(--theme-border)] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowOpportunities(!showOpportunities)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-[var(--theme-muted)]/30 transition-colors cursor-pointer"
                  >
                    <div>
                      <span className="text-sm font-bold text-[var(--theme-contrast)]">
                        Tespit Edilen Eksikler ve İyileştirme Fırsatları
                      </span>
                      <span className="ml-2 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[var(--theme-surface)] text-[var(--theme-contrast)] border border-[var(--theme-border)]">
                        {(auditResult.opportunities || []).length} Madde
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--theme-primary)]">
                      <span>{showOpportunities ? 'Gizle' : 'Detayları Göster'}</span>
                      {showOpportunities ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  </button>

                  {showOpportunities && (
                    <div className="px-6 pb-6 pt-2 border-t border-[var(--theme-border)]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                        {(auditResult.opportunities || []).map((opp: string, i: number) => (
                          <div
                            key={i}
                            className="p-3.5 rounded-xl bg-[var(--theme-surface)] border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-contrast)] flex items-start gap-2.5"
                          >
                            <CheckCircle2 size={15} className="text-[var(--theme-primary)] shrink-0 mt-0.5" />
                            <span>{opp}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Buton B: Teknik Web Sitesi Durum Kontrolü (8 Kriter) */}
                <div className="bg-[var(--theme-canvas)] rounded-2xl border border-[var(--theme-border)] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowTechnicalChecklist(!showTechnicalChecklist)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-[var(--theme-muted)]/30 transition-colors cursor-pointer"
                  >
                    <div>
                      <span className="text-sm font-bold text-[var(--theme-contrast)]">
                        Teknik Web Sitesi Kontrol Tablosu
                      </span>
                      <span className="ml-2 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[var(--theme-surface)] text-[var(--theme-contrast)] border border-[var(--theme-border)]">
                        {missingCount} Eksik / {checkItems.length} Kriter
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--theme-primary)]">
                      <span>{showTechnicalChecklist ? 'Gizle' : 'Teknik Detayları Aç'}</span>
                      {showTechnicalChecklist ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  </button>

                  {showTechnicalChecklist && (
                    <div className="px-6 pb-6 pt-3 border-t border-[var(--theme-border)]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {checkItems.map((item, idx) => (
                          <div
                            key={idx}
                            className="px-4 py-3 rounded-xl bg-[var(--theme-surface)] border border-[var(--theme-border)] text-xs flex items-center justify-between"
                          >
                            <span className="font-medium text-[var(--theme-contrast)]">{item.label}</span>
                            <span
                              className={`inline-flex items-center gap-1.5 font-bold ${
                                item.ok ? 'text-[var(--theme-primary)]' : 'text-rose-500'
                              }`}
                            >
                              {item.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                              {item.ok ? item.okText : item.failText}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : mainTab === 'proposal' ? (
            /* SEKME 2: HAZIR TEKLİF MESAJI (Sade ve Geniş) */
            <div className="space-y-5">
              {/* Kanal Seçimi ve Özelleştirme Butonu */}
              <div className="bg-[var(--theme-canvas)] p-5 rounded-2xl border border-[var(--theme-border)] flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPitchTab('whatsapp')}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      pitchTab === 'whatsapp'
                        ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)]'
                        : 'text-[var(--theme-contrast)] bg-[var(--theme-surface)] border border-[var(--theme-border)]'
                    }`}
                  >
                    <MessageSquare size={14} />
                    <span>WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPitchTab('email')}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      pitchTab === 'email'
                        ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)]'
                        : 'text-[var(--theme-contrast)] bg-[var(--theme-surface)] border border-[var(--theme-border)]'
                    }`}
                  >
                    <Mail size={14} />
                    <span>E-posta</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPitchTab('instagram')}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      pitchTab === 'instagram'
                        ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)]'
                        : 'text-[var(--theme-contrast)] bg-[var(--theme-surface)] border border-[var(--theme-border)]'
                    }`}
                  >
                    <Send size={14} />
                    <span>Instagram</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPitchTab('cold_call')}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      pitchTab === 'cold_call'
                        ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)]'
                        : 'text-[var(--theme-contrast)] bg-[var(--theme-surface)] border border-[var(--theme-border)]'
                    }`}
                  >
                    <PhoneCall size={14} />
                    <span>Telefon Konuşması</span>
                  </button>
                </div>

                {/* Detaylı Teklif Ayarlarını Açan Ayrı Buton */}
                <button
                  type="button"
                  onClick={() => setShowPitchCustomizer(!showPitchCustomizer)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--theme-surface)] hover:bg-[var(--theme-muted)] text-xs font-semibold text-[var(--theme-contrast)] border border-[var(--theme-border)] transition-colors cursor-pointer"
                >
                  <SlidersHorizontal size={14} className="text-[var(--theme-primary)]" />
                  <span>{showPitchCustomizer ? 'Mesaj Ayarlarını Gizle' : 'Mesaj Ayarlarını Özelleştir'}</span>
                </button>
              </div>

              {/* Ayrı Butonla Açılan Teklif Özelleştirme Paneli */}
              {showPitchCustomizer && (
                <div className="bg-[var(--theme-canvas)] p-6 rounded-2xl border border-[var(--theme-border)] space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--theme-border)]">
                    <span className="text-sm font-bold text-[var(--theme-contrast)]">
                      Teklif Metni Özelleştirme
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAdvancedParams(!showAdvancedParams)}
                        className="px-3 py-1.5 rounded-lg bg-[var(--theme-surface)] hover:bg-[var(--theme-muted)] text-xs font-medium text-[var(--theme-contrast)] border border-[var(--theme-border)] cursor-pointer"
                      >
                        {showAdvancedParams ? 'Gönderen Bilgilerini Gizle' : 'Gönderen ve Kampanya Ekle'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowApiKeyModal(!showApiKeyModal)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--theme-surface)] hover:bg-[var(--theme-muted)] text-xs font-medium text-[var(--theme-contrast)] border border-[var(--theme-border)] cursor-pointer"
                      >
                        <KeyRound size={13} />
                        <span>{aiStatus.configured ? 'Gemini Ayarlı' : 'Gemini Anahtarı'}</span>
                      </button>
                    </div>
                  </div>

                  {showApiKeyModal && (
                    <form
                      onSubmit={handleSaveApiKey}
                      className="p-4 bg-[var(--theme-surface)] rounded-xl border border-[var(--theme-border)] space-y-2.5 text-xs"
                    >
                      <div className="font-semibold text-[var(--theme-contrast)]">
                        Google Gemini API Anahtarı (İsteğe Bağlı)
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <input
                          type="password"
                          value={apiKeyInput}
                          onChange={e => setApiKeyInput(e.target.value)}
                          placeholder="Google Gemini anahtarınızı yapıştırın (AIzaSy...)"
                          className="flex-1 bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2 text-sm text-[var(--theme-contrast)] focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={isSavingApiKey}
                          className="px-5 py-2 rounded-xl bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] font-semibold cursor-pointer disabled:opacity-50"
                        >
                          {isSavingApiKey ? 'Kaydediliyor...' : 'Kaydet'}
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-4">
                      <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1.5">
                        Konuşma Dili
                      </label>
                      <select
                        value={tone}
                        onChange={e => setTone(e.target.value)}
                        className="w-full bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--theme-contrast)] focus:outline-none cursor-pointer"
                      >
                        <option value="kurumsal">Kurumsal ve Saygılı</option>
                        <option value="samimi">Samimi ve Esnaf Dostu</option>
                        <option value="ikna_edici">İkna Edici ve Kazanç Odaklı</option>
                        <option value="kisa_net">Kısa ve Doğrudan Sonuç Odaklı</option>
                      </select>
                    </div>

                    <div className="md:col-span-5">
                      <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1.5">
                        Önerilecek Hizmet
                      </label>
                      <select
                        value={focusService}
                        onChange={e => setFocusService(e.target.value)}
                        className="w-full bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--theme-contrast)] focus:outline-none cursor-pointer"
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
                        className="w-full flex items-center justify-center gap-2 bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles size={16} className={isGeneratingPitch ? 'animate-spin' : ''} />
                        <span>{isGeneratingPitch ? 'Üretiliyor...' : 'Metni Yenile'}</span>
                      </button>
                    </div>
                  </div>

                  {showAdvancedParams && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[var(--theme-border)]">
                      <div>
                        <label className="block text-xs text-[var(--theme-contrast)]/80 mb-1">Adınız Soyadınız</label>
                        <input
                          type="text"
                          value={senderName}
                          onChange={e => setSenderName(e.target.value)}
                          placeholder="Örn: Ahmet Yılmaz"
                          className="w-full bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2 text-sm text-[var(--theme-contrast)] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--theme-contrast)]/80 mb-1">Firma / Ekip Adınız</label>
                        <input
                          type="text"
                          value={agencyName}
                          onChange={e => setAgencyName(e.target.value)}
                          placeholder="Örn: Nova Web Tasarım"
                          className="w-full bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2 text-sm text-[var(--theme-contrast)] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--theme-contrast)]/80 mb-1">Özel İndirim veya Hediye Notu</label>
                        <input
                          type="text"
                          value={specialOffer}
                          onChange={e => setSpecialOffer(e.target.value)}
                          placeholder="Örn: Bu haftaya özel Google Harita kaydı ücretsiz"
                          className="w-full bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2 text-sm text-[var(--theme-contrast)] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--theme-contrast)]/80 mb-1">Eklemek İstediğiniz Özel Not</label>
                        <input
                          type="text"
                          value={customInstruction}
                          onChange={e => setCustomInstruction(e.target.value)}
                          placeholder="Örn: Paket servis siparişlerine vurgu yap"
                          className="w-full bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2 text-sm text-[var(--theme-contrast)] focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mesaj Kutusu ve Doğrudan Gönderim Aksiyonları */}
              <div className="bg-[var(--theme-canvas)] p-6 rounded-2xl border border-[var(--theme-border)] space-y-4">
                {pitchTab === 'email' && (
                  <div>
                    <label className="block text-xs font-semibold text-[var(--theme-contrast)]/80 mb-1.5">
                      E-posta Konusu
                    </label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={e => setEmailSubject(e.target.value)}
                      className="w-full bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--theme-contrast)] focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-[var(--theme-contrast)]/80">
                      Gönderilecek Metin (Üzerinde değişiklik yapabilirsiniz)
                    </label>
                    <button
                      type="button"
                      onClick={handleCopyPitch}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--theme-surface)] hover:bg-[var(--theme-muted)] text-xs font-semibold text-[var(--theme-contrast)] border border-[var(--theme-border)] transition-colors cursor-pointer"
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copied ? 'Kopyalandı' : 'Metni Kopyala'}</span>
                    </button>
                  </div>
                  <textarea
                    rows={8}
                    value={getActivePitchText()}
                    onChange={e => setActivePitchText(e.target.value)}
                    className="w-full text-sm text-[var(--theme-contrast)] font-sans leading-relaxed bg-[var(--theme-surface)] p-4 rounded-xl border border-[var(--theme-border)] focus:outline-none resize-y"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] text-sm font-semibold transition-colors"
                    >
                      <MessageSquare size={16} />
                      <span>WhatsApp ile Gönder ({effectivePhone})</span>
                    </a>
                  )}
                  {mailUrl && (
                    <a
                      href={mailUrl}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
                    >
                      <Mail size={16} />
                      <span>E-posta Gönder</span>
                    </a>
                  )}
                  {socialLinks.instagram && (
                    <a
                      href={socialLinks.instagram}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--theme-surface)] hover:bg-[var(--theme-muted)] text-[var(--theme-contrast)] border border-[var(--theme-border)] text-sm font-semibold transition-colors"
                    >
                      <Send size={15} />
                      <span>Instagram Profilini Aç</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* SEKME 3: CANLI ÖRNEK SİTE ÖNİZLEMESİ */
            <div className="space-y-4">
              <div className="bg-[var(--theme-canvas)] p-5 rounded-2xl border border-[var(--theme-border)] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-[var(--theme-contrast)]">
                    {auditResult.merchantName} — Örnek Web Sitesi Taslağı
                  </h3>
                  <p className="text-xs text-[var(--theme-contrast)]/75 mt-0.5">
                    İşletmenin kendi bilgileriyle otomatik oluşturulan canlı web sitesi önizlemesi.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex bg-[var(--theme-surface)] p-1 rounded-xl border border-[var(--theme-border)]">
                    <button
                      type="button"
                      onClick={() => setDemoPreviewDevice('desktop')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        demoPreviewDevice === 'desktop'
                          ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)]'
                          : 'text-[var(--theme-contrast)]/80'
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
                          ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)]'
                          : 'text-[var(--theme-contrast)]/80'
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
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--theme-surface)] hover:bg-[var(--theme-muted)] text-[var(--theme-contrast)] border border-[var(--theme-border)] text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    <ExternalLink size={14} />
                    <span>Tam Ekran Aç</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadDemoHtml}
                    disabled={!demoSiteHtml}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    <FileDown size={14} />
                    <span>Taslağı İndir (.html)</span>
                  </button>
                </div>
              </div>

              {isGeneratingDemoSite ? (
                <div className="bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-2xl p-16 text-center text-[var(--theme-contrast)] animate-pulse">
                  İşletmeye özel örnek web sitesi hazırlanıyor...
                </div>
              ) : demoSiteHtml ? (
                <div className="bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-2xl p-4 flex justify-center overflow-hidden">
                  <iframe
                    title={`${auditResult.merchantName} Örnek Web Sitesi`}
                    srcDoc={demoSiteHtml}
                    className={`bg-white rounded-xl border border-[var(--theme-border)] transition-all duration-200 ${
                      demoPreviewDevice === 'mobile'
                        ? 'w-[390px] h-[620px]'
                        : 'w-full h-[540px]'
                    }`}
                  />
                </div>
              ) : (
                <div className="bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-2xl p-12 text-center text-[var(--theme-contrast)]/80 text-sm">
                  Örnek site önizlemesi yüklenemedi.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sade Alt Aksiyon Çubuğu */}
        <div className="px-7 py-4 border-t border-[var(--theme-border)] bg-[var(--theme-canvas)] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="bg-[var(--theme-surface)] hover:bg-[var(--theme-muted)] text-[var(--theme-contrast)] border border-[var(--theme-border)] px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
          >
            Kapat
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="px-4 py-2.5 rounded-xl bg-[var(--theme-surface)] hover:bg-[var(--theme-muted)] text-[var(--theme-contrast)] border border-[var(--theme-border)] text-sm font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <FileDown size={16} />
              <span>{isExportingPdf ? 'PDF Hazırlanıyor...' : 'PDF Rapor İndir'}</span>
            </button>
            <button
              onClick={onSaveLead}
              disabled={isSavingLead || saveLeadSuccess}
              className="px-5 py-2.5 rounded-xl bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] transition-colors text-sm font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <BookmarkPlus size={17} />
              <span>
                {isSavingLead
                  ? 'Kaydediliyor...'
                  : saveLeadSuccess
                    ? 'Listeye Kaydedildi'
                    : 'Müşteri Listeme Kaydet'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
