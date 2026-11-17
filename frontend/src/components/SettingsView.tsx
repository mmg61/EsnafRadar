import React, { useState } from 'react';
import { THEME_OPTIONS, type ThemeId, type ThemeOption } from '../theme';
import {
  Palette,
  CheckCircle2,
  Cpu,
  RefreshCw,
  Check
} from 'lucide-react';

interface SettingsViewProps {
  currentTheme: ThemeId;
  onApplyTheme: (theme: ThemeId) => void;
}

interface CompileStep {
  title: string;
  progress: number;
}

const COMPILE_STEPS: CompileStep[] = [
  { title: 'Renk paleti ve kontrast ayarları hazırlanıyor...', progress: 25 },
  { title: 'Harita katmanları ve ikon renkleri güncelleniyor...', progress: 55 },
  { title: 'Sayfa bileşenleri yeni görünüme uyarlanıyor...', progress: 85 },
  { title: 'Tema hafızaya kaydedildi ve etkinleştirildi.', progress: 100 },
];

export const SettingsView: React.FC<SettingsViewProps> = ({ currentTheme, onApplyTheme }) => {
  const [previewThemeId, setPreviewThemeId] = useState<ThemeId>(currentTheme);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileStepIndex, setCompileStepIndex] = useState(0);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const selectedThemeObj: ThemeOption =
    THEME_OPTIONS.find(t => t.id === previewThemeId) || THEME_OPTIONS[0];
  const activeThemeObj: ThemeOption =
    THEME_OPTIONS.find(t => t.id === currentTheme) || THEME_OPTIONS[0];

  const handleStartThemeCompilation = () => {
    if (isCompiling || previewThemeId === currentTheme) return;

    setStatusBanner(null);
    setIsCompiling(true);
    setCompileStepIndex(0);

    const stepDurationMs = 850;

    COMPILE_STEPS.forEach((_, idx) => {
      setTimeout(() => {
        setCompileStepIndex(idx);

        if (idx === 2) {
          onApplyTheme(previewThemeId);
        }

        if (idx === COMPILE_STEPS.length - 1) {
          setTimeout(() => {
            setIsCompiling(false);
            setStatusBanner(`"${selectedThemeObj.label}" teması başarıyla uygulandı.`);
          }, 550);
        }
      }, (idx + 1) * stepDurationMs);
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 relative">
      {/* TEMA GEÇİŞ EKRANI (Sade ve Ciddi İlerleme Penceresi) */}
      {isCompiling && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-2xl p-7 shadow-2xl space-y-6 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--theme-primary)] text-[var(--theme-on-primary)] flex items-center justify-center">
              <Cpu size={28} className="animate-spin" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-[var(--theme-contrast)]">
                "{selectedThemeObj.label}" Teması Uygulanıyor
              </h3>
              <p className="text-xs text-[var(--theme-contrast)]/75">
                {COMPILE_STEPS[compileStepIndex]?.title}
              </p>
            </div>

            <div className="space-y-2">
              <div className="h-2.5 w-full bg-[var(--theme-canvas)] rounded-full overflow-hidden border border-[var(--theme-border)]">
                <div
                  className="h-full bg-[var(--theme-primary)] transition-all duration-500"
                  style={{ width: `${COMPILE_STEPS[compileStepIndex]?.progress || 10}%` }}
                />
              </div>
              <div className="flex justify-between text-xs font-semibold text-[var(--theme-contrast)]/70">
                <span>Adım {compileStepIndex + 1} / {COMPILE_STEPS.length}</span>
                <span className="text-[var(--theme-primary)] font-bold">
                  %{COMPILE_STEPS[compileStepIndex]?.progress || 10}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sade Üst Başlık */}
      <div className="bg-[var(--theme-surface)] px-6 py-5 rounded-xl border border-[var(--theme-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[var(--theme-primary)] text-[var(--theme-on-primary)] flex items-center justify-center shrink-0">
            <Palette size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--theme-contrast)]">
              Görünüm Teması
            </h2>
            <p className="text-xs text-[var(--theme-contrast)]/70 mt-0.5">
              Bir tema seçip önizleyin ve sisteme uygulayın. Seçiminiz otomatik hatırlanır.
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 bg-[var(--theme-canvas)] px-3.5 py-2 rounded-xl border border-[var(--theme-border)] text-xs">
          <span className="text-[var(--theme-contrast)]/70">Aktif:</span>
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: activeThemeObj.palette.primary }}
          />
          <span className="font-bold text-[var(--theme-contrast)]">
            {activeThemeObj.label}
          </span>
        </div>
      </div>

      {statusBanner && (
        <div className="px-4 py-3 rounded-xl bg-[var(--theme-surface)] border border-[var(--theme-primary)] text-[var(--theme-contrast)] text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} className="text-[var(--theme-primary)] shrink-0" />
          <span>{statusBanner}</span>
        </div>
      )}

      {/* 4 Ferah Tema Kartı (2x2 Izgara) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {THEME_OPTIONS.map(theme => {
          const isSelected = previewThemeId === theme.id;
          const isCurrent = currentTheme === theme.id;

          return (
            <div
              key={theme.id}
              onClick={() => setPreviewThemeId(theme.id)}
              className={`rounded-2xl border p-5 transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-[var(--theme-surface)] border-[var(--theme-primary)] ring-2 ring-[var(--theme-primary)]/40'
                  : 'bg-[var(--theme-surface)]/70 border-[var(--theme-border)] hover:border-[var(--theme-primary)]/50'
              }`}
            >
              {/* Görsel Önizleme Alanı */}
              <div
                className="w-full h-40 rounded-xl border overflow-hidden p-3 flex flex-col justify-between"
                style={{
                  backgroundColor: theme.palette.canvas,
                  borderColor: 'rgba(148, 163, 184, 0.22)',
                }}
              >
                {/* Mini Üst Çubuk */}
                <div
                  className="h-7 rounded-lg px-3 flex items-center justify-between"
                  style={{ backgroundColor: theme.palette.surface }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: theme.palette.primary }}
                    />
                    <span
                      className="text-[10px] font-bold"
                      style={{ color: theme.palette.contrast }}
                    >
                      EsnafRadar
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className="h-2 w-8 rounded-full"
                      style={{ backgroundColor: theme.palette.muted }}
                    />
                    <span
                      className="h-2 w-8 rounded-full"
                      style={{ backgroundColor: theme.palette.primary }}
                    />
                  </div>
                </div>

                {/* Mini Sol Panel + Sağ Harita Önizlemesi */}
                <div className="grid grid-cols-3 gap-2.5 flex-1 mt-2.5">
                  <div
                    className="col-span-1 rounded-lg p-2 flex flex-col justify-between"
                    style={{ backgroundColor: theme.palette.surface }}
                  >
                    <div className="space-y-1.5">
                      <div
                        className="h-2 w-4/5 rounded"
                        style={{ backgroundColor: theme.palette.contrast, opacity: 0.65 }}
                      />
                      <div
                        className="h-2 w-3/5 rounded"
                        style={{ backgroundColor: theme.palette.contrast, opacity: 0.35 }}
                      />
                    </div>
                    <div
                      className="h-4 w-full rounded flex items-center justify-center text-[8px] font-bold"
                      style={{
                        backgroundColor: theme.palette.primary,
                        color: '#FFFFFF',
                      }}
                    >
                      Başlat
                    </div>
                  </div>

                  <div
                    className="col-span-2 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: theme.palette.muted }}
                  >
                    <div
                      className="w-14 h-14 rounded-full border-2 flex items-center justify-center"
                      style={{
                        borderColor: theme.palette.primary,
                        backgroundColor: `${theme.palette.primary}20`,
                      }}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: theme.palette.primary }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Alt Başlık ve Renk Noktaları */}
              <div className="flex items-center justify-between mt-4 pt-1">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-[var(--theme-contrast)]">
                      {theme.label}
                    </h3>
                    {isCurrent && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--theme-primary)] text-[var(--theme-on-primary)]">
                        <Check size={11} /> Kullanımda
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[var(--theme-contrast)]/65">
                    {theme.badge}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {[
                    theme.palette.canvas,
                    theme.palette.surface,
                    theme.palette.primary,
                    theme.palette.contrast,
                  ].map((hex, i) => (
                    <span
                      key={i}
                      className="w-4 h-4 rounded-full border border-black/20"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Alt Uygulama Çubuğu */}
      <div className="bg-[var(--theme-surface)] p-5 rounded-xl border border-[var(--theme-border)] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="w-4 h-4 rounded-full border border-black/20 shrink-0"
            style={{ backgroundColor: selectedThemeObj.palette.primary }}
          />
          <span className="text-sm font-semibold text-[var(--theme-contrast)]">
            Seçilen Tema: <strong>{selectedThemeObj.label}</strong>
          </span>
        </div>

        {previewThemeId === currentTheme ? (
          <span className="text-xs font-semibold text-[var(--theme-contrast)]/70 px-4 py-2.5 rounded-xl bg-[var(--theme-canvas)] border border-[var(--theme-border)]">
            Bu tema şu anda kullanımda
          </span>
        ) : (
          <button
            type="button"
            onClick={handleStartThemeCompilation}
            disabled={isCompiling}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] font-bold text-xs transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <RefreshCw size={14} />
            <span>"{selectedThemeObj.label}" Temasını Uygula</span>
          </button>
        )}
      </div>
    </div>
  );
};
