import React, { useState } from 'react';
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
  Phone
} from 'lucide-react';

interface AuditModalProps {
  auditResult: any;
  isSavingLead: boolean;
  saveLeadSuccess: boolean;
  onClose: () => void;
  onSaveLead: () => void;
  onReAudit?: () => void;
}

export const AuditModal: React.FC<AuditModalProps> = ({
  auditResult,
  isSavingLead,
  saveLeadSuccess,
  onClose,
  onSaveLead,
  onReAudit
}) => {
  const [pitchTab, setPitchTab] = useState<'whatsapp' | 'email'>('whatsapp');
  const [copied, setCopied] = useState(false);

  if (!auditResult) return null;

  const merchant = auditResult.merchant || {};
  const effectivePhone =
    merchant.phone ||
    (auditResult.scraped_phones && auditResult.scraped_phones.length > 0 ? auditResult.scraped_phones[0] : null);
  const effectiveEmail =
    merchant.email ||
    (auditResult.scraped_emails && auditResult.scraped_emails.length > 0 ? auditResult.scraped_emails[0] : null);

  const currentPitch =
    pitchTab === 'whatsapp'
      ? auditResult.sales_pitch_whatsapp || ''
      : auditResult.sales_pitch_email || '';

  const handleCopyPitch = async () => {
    if (!currentPitch) return;
    try {
      await navigator.clipboard.writeText(currentPitch);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  const getWhatsAppPitchLink = () => {
    if (!effectivePhone) return null;
    const cleanPhone = effectivePhone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.startsWith('90')
      ? cleanPhone
      : cleanPhone.startsWith('0')
        ? '9' + cleanPhone
        : '90' + cleanPhone;
    const text = encodeURIComponent(
      auditResult.sales_pitch_whatsapp ||
        `Merhaba ${auditResult.merchantName}, işletmenizin dijital varlığını inceledik ve bilgi vermek isteriz.`
    );
    return `https://wa.me/${phoneWithCountry}?text=${text}`;
  };

  const getMailtoLink = () => {
    if (!effectiveEmail) return null;
    const subject = encodeURIComponent(`${auditResult.merchantName} - Dijital Görünürlük ve Teknik Analiz Raporu`);
    const body = encodeURIComponent(auditResult.sales_pitch_email || auditResult.ai_summary || '');
    return `mailto:${effectiveEmail}?subject=${subject}&body=${body}`;
  };

  const waUrl = getWhatsAppPitchLink();
  const mailUrl = getMailtoLink();

  const checkItems = [
    { label: 'Web Sitesi', ok: Boolean(auditResult.has_website), okText: 'Mevcut', failText: 'Yok' },
    { label: 'SSL Sertifikası (HTTPS)', ok: Boolean(auditResult.ssl_valid), okText: 'Geçerli', failText: 'Güvensiz / Yok' },
    { label: 'Mobil Uyumluluk', ok: Boolean(auditResult.mobile_ready), okText: 'Uyumlu', failText: 'Uyumsuz' },
    { label: 'SEO Sayfa Başlığı (Title)', ok: Boolean(auditResult.has_title), okText: 'Mevcut', failText: 'Eksik' },
    { label: 'Meta Açıklama (Description)', ok: Boolean(auditResult.has_meta_description), okText: 'Mevcut', failText: 'Eksik' },
    { label: 'H1 Ana Başlık Etiketi', ok: Boolean(auditResult.has_h1), okText: 'Mevcut', failText: 'Eksik' },
    { label: 'Google Analytics / GTM', ok: Boolean(auditResult.has_analytics), okText: 'Kurulu', failText: 'Yok' },
    { label: 'Meta / Facebook Pixel', ok: Boolean(auditResult.has_pixel), okText: 'Kurulu', failText: 'Yok' },
  ];

  const scrapedEmails: string[] = auditResult.scraped_emails || [];
  const scrapedPhones: string[] = auditResult.scraped_phones || [];
  const socialLinks: Record<string, string> = auditResult.social_links || {};
  const hasScrapedExtras =
    scrapedEmails.length > 0 || scrapedPhones.length > 0 || Object.keys(socialLinks).length > 0;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-800 w-full max-w-3xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden my-6 max-h-[90vh] flex flex-col">
        {/* Başlık Çubuğu */}
        <div className="bg-slate-900 px-6 py-4 border-b border-slate-700 flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Dijital Varlık Röntgeni
              </span>
              {auditResult.response_time_ms != null && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
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
            <h2 className="text-xl font-bold text-white mt-1">
              {auditResult.merchantName}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {onReAudit && (
              <button
                onClick={onReAudit}
                title="Röntgeni Yeniden Çek"
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
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Üst Özet ve 8 Kriterli Teknik Denetim Karnesi */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sol: Fırsat Puanı */}
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
              {merchant.website && (
                <a
                  href={merchant.website.startsWith('http') ? merchant.website : `https://${merchant.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs text-blue-400 hover:underline truncate max-w-full"
                >
                  <Globe size={12} />
                  <span className="truncate">{merchant.website.replace(/^https?:\/\//, '')}</span>
                  <ExternalLink size={11} />
                </a>
              )}
            </div>

            {/* Sağ: 8 Kriterli Teknik Denetim Karnesi */}
            <div className="md:col-span-2 bg-slate-900 p-4 rounded-xl border border-slate-700">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-3 pb-2 border-b border-slate-800">
                <FileCode2 size={15} className="text-emerald-400" />
                <span>Teknik Altyapı, SEO ve Piksel Denetim Karnesi</span>
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

          {/* Siteden Kazınan (Scraped) İletişim ve Sosyal Medya Bilgileri */}
          {hasScrapedExtras && (
            <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-700 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <BarChart3 size={15} />
                <span>Web Sitesinden Otomatik Tespit Edilen İletişim & Sosyal Medya Kanalları</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {scrapedEmails.map((em, i) => (
                  <a
                    key={`em-${i}`}
                    href={`mailto:${em}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:border-emerald-500/50"
                  >
                    <Mail size={13} className="text-emerald-400" />
                    <span>{em}</span>
                  </a>
                ))}
                {scrapedPhones.map((ph, i) => (
                  <span
                    key={`ph-${i}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
                  >
                    <Phone size={13} className="text-emerald-400" />
                    <span>{ph}</span>
                  </span>
                ))}
                {Object.entries(socialLinks).map(([platform, link]) => (
                  <a
                    key={platform}
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-blue-400 hover:underline capitalize"
                  >
                    <ExternalLink size={12} />
                    <span>{platform}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

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

          {/* Kişiselleştirilmiş Hazır Satış Teklifi Metni */}
          {(auditResult.sales_pitch_whatsapp || auditResult.sales_pitch_email) && (
            <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-950/60 border-b border-slate-800">
                <div className="flex items-center gap-2">
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
                    <span>WhatsApp Satış Metni</span>
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
                    <span>Kurumsal E-posta Metni</span>
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

              <div className="p-4">
                <pre className="text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed bg-slate-950/50 p-3.5 rounded-lg border border-slate-800">
                  {currentPitch}
                </pre>

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                    >
                      <MessageSquare size={14} />
                      <span>WhatsApp ile Doğrudan Gönder</span>
                    </a>
                  )}
                  {mailUrl && (
                    <a
                      href={mailUrl}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                    >
                      <Mail size={14} />
                      <span>E-posta İstemcisinde Aç</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
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
