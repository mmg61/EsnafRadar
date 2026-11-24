import React, { useState } from 'react';
import {
  Globe,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  MessageSquare,
  Mail,
  ExternalLink,
  Phone,
  ArrowRight,
  LayoutTemplate,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import type { AuditResult } from '../../types';
import { formatWhatsAppNumber } from './phoneUtils';

interface AuditOverviewTabProps {
  auditResult: AuditResult;
  effectiveWebsite: string | null;
  effectivePhone: string | null;
  effectiveEmail: string | null;
  socialLinks: Record<string, string>;
  recommendedPackage: string;
  copiedItem: string | null;
  onCopyValue: (val: string) => void;
  onSwitchToProposal: () => void;
  onOpenDemoSite: () => void;
}

export const AuditOverviewTab: React.FC<AuditOverviewTabProps> = ({
  auditResult,
  effectiveWebsite,
  effectivePhone,
  effectiveEmail,
  socialLinks,
  recommendedPackage,
  copiedItem,
  onCopyValue,
  onSwitchToProposal,
  onOpenDemoSite
}) => {
  const [showOpportunities, setShowOpportunities] = useState(false);
  const [showTechnicalChecklist, setShowTechnicalChecklist] = useState(false);

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
  const opportunities = auditResult.opportunities || [];

  return (
    <div className="space-y-6">
      {/* 1. Ana Özet Kartı */}
      <div className="bg-[var(--theme-canvas)] p-7 rounded-2xl border border-[var(--theme-border)] flex flex-col md:flex-row items-center gap-8">
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
              onClick={onSwitchToProposal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] text-xs font-semibold transition-colors cursor-pointer"
            >
              <span>Hazır Teklif Mesajına Geç</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. İletişim Bilgileri */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-[var(--theme-canvas)] p-5 rounded-2xl border border-[var(--theme-border)] flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--theme-contrast)]/70 flex items-center gap-2">
              <Phone size={15} className="text-[var(--theme-primary)]" />
              Telefon
            </span>
            {effectivePhone && (
              <button
                type="button"
                onClick={() => onCopyValue(effectivePhone)}
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
                onClick={onOpenDemoSite}
                className="text-xs font-semibold text-[var(--theme-primary)] hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <LayoutTemplate size={13} />
                <span>Örnek Site Taslağı Oluştur</span>
              </button>
            </div>
          )}
        </div>

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
                  onClick={() => onCopyValue(effectiveEmail)}
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
                {opportunities.length} Madde
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
                {opportunities.map((opp, i) => (
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
  );
};
