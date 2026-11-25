import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  RefreshCw,
  BookmarkPlus,
  Wand2,
  FileDown,
  FileText,
  LayoutTemplate
} from 'lucide-react';
import {
  getAiStatus,
  saveAiConfig,
  generateCustomPitch,
  exportAuditPdf,
  generateDemoSite,
  getUserProfile
} from '../api';
import type { AuditResult } from '../types';
import { normalizeAndDeduplicatePhones } from './audit/phoneUtils';
import { AuditOverviewTab } from './audit/AuditOverviewTab';
import { AuditProposalTab } from './audit/AuditProposalTab';
import { AuditDemoSiteTab } from './audit/AuditDemoSiteTab';

interface AuditModalProps {
  auditResult: AuditResult;
  token?: string | null;
  isSavingLead: boolean;
  saveLeadSuccess: boolean;
  onClose: () => void;
  onSaveLead: () => void;
  onReAudit?: () => void;
  onAuditResultUpdate?: (updatedAudit: AuditResult) => void;
}

type MainModalTab = 'overview' | 'proposal' | 'demo_site';

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
  const displayName = auditResult.merchantName || auditResult.merchant?.name || 'İşletme';

  const [mainTab, setMainTab] = useState<MainModalTab>('overview');
  const [copied, setCopied] = useState(false);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const [demoSiteHtml, setDemoSiteHtml] = useState<string>('');
  const [isGeneratingDemoSite, setIsGeneratingDemoSite] = useState<boolean>(false);

  const [tone, setTone] = useState<string>('kurumsal');
  const [focusService, setFocusService] = useState<string>('auto');
  const [senderName, setSenderName] = useState<string>('');
  const [agencyName, setAgencyName] = useState<string>('');
  const [senderEmail, setSenderEmail] = useState<string | null>(null);
  const [isGeneratingPitch, setIsGeneratingPitch] = useState<boolean>(false);
  const [pitchStatusMessage, setPitchStatusMessage] = useState<string | null>(null);

  const [aiStatus, setAiStatus] = useState<{ configured: boolean; masked_key?: string | null; model: string }>({
    configured: false,
    masked_key: null,
    model: 'gemini-2.5-flash'
  });
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [isSavingApiKey, setIsSavingApiKey] = useState<boolean>(false);

  const [proposalMessage, setProposalMessage] = useState<string>(
    () => auditResult.sales_pitch_whatsapp || auditResult.sales_pitch_email || ''
  );
  const [recommendedPackage, setRecommendedPackage] = useState<string>(() => auditResult.recommended_package || '');
  const [valuePropositions, setValuePropositions] = useState<string[]>(() => auditResult.value_propositions || []);

  // Pencere açıkken arka plan (ana sayfa) kaydırmasını tamamen kilitle
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    if (!activeToken) return;
    let cancelled = false;

    getAiStatus(activeToken)
      .then(status => {
        if (!cancelled) setAiStatus(status);
      })
      .catch(() => {});

    getUserProfile(activeToken)
      .then(profile => {
        if (cancelled) return;
        const defaultSender =
          profile.full_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
        setSenderName(prev => prev || defaultSender);
        setAgencyName(prev => prev || profile.company_name || '');
        setSenderEmail(profile.email || null);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeToken]);

  const merchant = auditResult.merchant;
  const effectiveWebsite = auditResult.discovered_website || merchant?.website || null;
  const hasWebsite = Boolean(effectiveWebsite || auditResult.has_website);

  const allPhones: string[] = normalizeAndDeduplicatePhones([
    merchant?.phone,
    auditResult.scraped_whatsapp,
    ...(auditResult.scraped_phones || [])
  ]);

  const allEmails: string[] = Array.from(
    new Set(
      [
        ...(merchant?.email ? [merchant.email.trim().toLowerCase()] : []),
        ...((auditResult.scraped_emails || []).map((e: string) => e.trim().toLowerCase()))
      ].filter(Boolean)
    )
  );

  const effectivePhone = allPhones.length > 0 ? allPhones[0] : null;
  const effectiveEmail = allEmails.length > 0 ? allEmails[0] : null;

  const socialLinks: Record<string, string> = {};
  if (merchant?.instagram) socialLinks.instagram = merchant.instagram;
  if (auditResult.social_links) {
    for (const [k, v] of Object.entries(auditResult.social_links)) {
      if (typeof v === 'string' && v.trim()) {
        socialLinks[k] = v;
      }
    }
  }

  const handleCopyPitch = async () => {
    if (!proposalMessage) return;
    try {
      await navigator.clipboard.writeText(proposalMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Pano erisimi basarisiz
    }
  };

  const handleCopyValue = async (val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedItem(val);
      setTimeout(() => setCopiedItem(null), 1800);
    } catch {
      // Pano erisimi basarisiz
    }
  };

  const handleDownloadPdf = async () => {
    if (!activeToken || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      await exportAuditPdf(
        {
          merchant_name: displayName,
          category: merchant?.category_label || merchant?.category || 'Yerel İşletme',
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
          whatsapp_pitch: proposalMessage,
          sales_pitch_whatsapp: proposalMessage
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
    if (hasWebsite) return;
    setMainTab('demo_site');
    if (demoSiteHtml || isGeneratingDemoSite || !activeToken) return;
    setIsGeneratingDemoSite(true);
    try {
      const res = await generateDemoSite(
        {
          merchant_name: displayName,
          category: merchant?.category_label || merchant?.category || 'Yerel İşletme',
          phone: effectivePhone,
          email: effectiveEmail,
          address: merchant?.address || null,
          opening_hours: merchant?.opening_hours || null,
          instagram: socialLinks.instagram || merchant?.instagram || null,
          latitude: merchant?.latitude || null,
          longitude: merchant?.longitude || null
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
    const safeName = displayName
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
          osm_id: merchant?.osm_id,
          merchant_name: displayName,
          category: merchant?.category_label || merchant?.category || undefined,
          tone,
          focus_service: focusService,
          sender_name: senderName.trim() || undefined,
          agency_name: agencyName.trim() || undefined,
          audit_context: auditResult as unknown as Record<string, unknown>
        },
        activeToken
      );

      const nextUnifiedMessage = res.whatsapp_pitch || res.email_pitch || '';
      setProposalMessage(nextUnifiedMessage);
      setRecommendedPackage(res.recommended_package || '');
      setValuePropositions(res.value_propositions || []);

      if (onAuditResultUpdate) {
        onAuditResultUpdate({
          ...auditResult,
          recommended_package: res.recommended_package,
          detected_pain_points: res.detected_pain_points,
          value_propositions: res.value_propositions,
          sales_pitch_whatsapp: nextUnifiedMessage,
          sales_pitch_email_subject: res.email_subject,
          sales_pitch_email: nextUnifiedMessage
        });
      }

      setPitchStatusMessage('Teklif mesajı seçtiğiniz ayarlara göre yenilendi.');
      setTimeout(() => setPitchStatusMessage(null), 4000);
    } catch (err: unknown) {
      setPitchStatusMessage((err instanceof Error ? err.message : '') || 'Teklif oluşturulurken bir hata oluştu.');
    } finally {
      setIsGeneratingPitch(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-hidden overscroll-contain">
      <div className="bg-[var(--theme-surface)] w-full max-w-5xl rounded-2xl border border-[var(--theme-border)] shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        <div className="bg-[var(--theme-canvas)] px-7 py-5 border-b border-[var(--theme-border)] flex justify-between items-center gap-4 shrink-0">
          <div>
            <span className="text-xs font-semibold text-[var(--theme-primary)]">
              {merchant?.category_label || merchant?.category || 'İşletme İnceleme Raporu'}
            </span>
            <h2 className="text-2xl font-bold text-[var(--theme-contrast)] mt-0.5">
              {displayName}
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

          {!hasWebsite && (
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
          )}
        </div>

        <div className="p-7 sm:p-9 space-y-7 overflow-y-auto no-scrollbar overscroll-contain flex-1">
          {pitchStatusMessage && (
            <div className="px-4 py-3 rounded-xl bg-[var(--theme-canvas)] border border-[var(--theme-primary)] text-[var(--theme-contrast)] text-sm flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[var(--theme-primary)] shrink-0" />
              <span>{pitchStatusMessage}</span>
            </div>
          )}

          {mainTab === 'proposal' ? (
            <AuditProposalTab
              tone={tone}
              onToneChange={setTone}
              focusService={focusService}
              onFocusServiceChange={setFocusService}
              senderName={senderName}
              onSenderNameChange={setSenderName}
              agencyName={agencyName}
              onAgencyNameChange={setAgencyName}
              senderEmail={senderEmail}
              aiConfigured={aiStatus.configured}
              apiKeyInput={apiKeyInput}
              onApiKeyInputChange={setApiKeyInput}
              isSavingApiKey={isSavingApiKey}
              onSaveApiKey={handleSaveApiKey}
              isGeneratingPitch={isGeneratingPitch}
              onGenerateAiPitch={handleGenerateAiPitch}
              proposalMessage={proposalMessage}
              onProposalMessageChange={setProposalMessage}
              copied={copied}
              onCopyPitch={handleCopyPitch}
            />
          ) : mainTab === 'demo_site' && !hasWebsite ? (
            <AuditDemoSiteTab
              merchantName={displayName}
              demoSiteHtml={demoSiteHtml}
              isGeneratingDemoSite={isGeneratingDemoSite}
              onOpenInNewTab={handleOpenDemoInNewTab}
              onDownloadHtml={handleDownloadDemoHtml}
            />
          ) : (
            <AuditOverviewTab
              auditResult={auditResult}
              effectiveWebsite={effectiveWebsite}
              effectivePhone={effectivePhone}
              effectiveEmail={effectiveEmail}
              socialLinks={socialLinks}
              recommendedPackage={recommendedPackage}
              copiedItem={copiedItem}
              onCopyValue={handleCopyValue}
              onSwitchToProposal={() => setMainTab('proposal')}
              onOpenDemoSite={handleOpenDemoSite}
            />
          )}
        </div>

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
