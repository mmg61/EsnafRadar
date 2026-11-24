import React, { useState } from 'react';
import { ExternalLink, FileDown, Monitor, Smartphone } from 'lucide-react';

interface AuditDemoSiteTabProps {
  merchantName: string;
  demoSiteHtml: string;
  isGeneratingDemoSite: boolean;
  onOpenInNewTab: () => void;
  onDownloadHtml: () => void;
}

export const AuditDemoSiteTab: React.FC<AuditDemoSiteTabProps> = ({
  merchantName,
  demoSiteHtml,
  isGeneratingDemoSite,
  onOpenInNewTab,
  onDownloadHtml
}) => {
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  return (
    <div className="space-y-4">
      <div className="bg-[var(--theme-canvas)] p-5 rounded-2xl border border-[var(--theme-border)] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[var(--theme-contrast)]">
            {merchantName} — Örnek Web Sitesi Taslağı
          </h3>
          <p className="text-xs text-[var(--theme-contrast)]/75 mt-0.5">
            İşletmenin kendi bilgileriyle otomatik oluşturulan izole web sitesi önizlemesi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex bg-[var(--theme-surface)] p-1 rounded-xl border border-[var(--theme-border)]">
            <button
              type="button"
              onClick={() => setPreviewDevice('desktop')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                previewDevice === 'desktop'
                  ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)]'
                  : 'text-[var(--theme-contrast)]/80'
              }`}
            >
              <Monitor size={14} />
              <span>Bilgisayar</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice('mobile')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                previewDevice === 'mobile'
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
            onClick={onOpenInNewTab}
            disabled={!demoSiteHtml}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--theme-surface)] hover:bg-[var(--theme-muted)] text-[var(--theme-contrast)] border border-[var(--theme-border)] text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            <ExternalLink size={14} />
            <span>Tam Ekran Aç</span>
          </button>

          <button
            type="button"
            onClick={onDownloadHtml}
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
          {/* Güvenlik: sandbox="" ile tüm script, form ve üst pencere erişimi tamamen kapatılmıştır */}
          <iframe
            title={`${merchantName} Örnek Web Sitesi`}
            sandbox=""
            referrerPolicy="no-referrer"
            srcDoc={demoSiteHtml}
            className={`bg-white rounded-xl border border-[var(--theme-border)] transition-all duration-200 ${
              previewDevice === 'mobile'
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
  );
};
