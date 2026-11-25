import React, { useState } from 'react';
import {
  Copy,
  Check,
  MessageSquare,
  Mail,
  Sparkles,
  KeyRound,
  SlidersHorizontal,
  Send,
  ChevronDown,
  ChevronUp,
  UserCheck
} from 'lucide-react';

interface AuditProposalTabProps {
  tone: string;
  onToneChange: (val: string) => void;
  focusService: string;
  onFocusServiceChange: (val: string) => void;
  senderName: string;
  onSenderNameChange: (val: string) => void;
  agencyName: string;
  onAgencyNameChange: (val: string) => void;
  senderEmail?: string | null;
  specialOffer: string;
  onSpecialOfferChange: (val: string) => void;
  customInstruction: string;
  onCustomInstructionChange: (val: string) => void;
  aiConfigured: boolean;
  apiKeyInput: string;
  onApiKeyInputChange: (val: string) => void;
  isSavingApiKey: boolean;
  onSaveApiKey: (e: React.FormEvent) => void;
  isGeneratingPitch: boolean;
  onGenerateAiPitch: () => void;
  proposalMessage: string;
  onProposalMessageChange: (val: string) => void;
  copied: boolean;
  onCopyPitch: () => void;
  waUrl: string | null;
  mailUrl: string | null;
  effectivePhone: string | null;
  instagramUrl?: string | null;
}

export const AuditProposalTab: React.FC<AuditProposalTabProps> = ({
  tone,
  onToneChange,
  focusService,
  onFocusServiceChange,
  senderName,
  onSenderNameChange,
  agencyName,
  onAgencyNameChange,
  senderEmail,
  specialOffer,
  onSpecialOfferChange,
  customInstruction,
  onCustomInstructionChange,
  aiConfigured,
  apiKeyInput,
  onApiKeyInputChange,
  isSavingApiKey,
  onSaveApiKey,
  isGeneratingPitch,
  onGenerateAiPitch,
  proposalMessage,
  onProposalMessageChange,
  copied,
  onCopyPitch,
  waUrl,
  mailUrl,
  effectivePhone,
  instagramUrl
}) => {
  const [showMessageSettings, setShowMessageSettings] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  return (
    <div className="space-y-5">
      {/* Tekil Teklif Mesajı Kutusu */}
      <div className="bg-[var(--theme-canvas)] p-6 rounded-2xl border border-[var(--theme-border)] space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-[var(--theme-contrast)]/80">
              Hazır Teklif Mesajı (Dilediğiniz kanaldan paylaşabilir veya düzenleyebilirsiniz)
            </label>
            <button
              type="button"
              onClick={onCopyPitch}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--theme-surface)] hover:bg-[var(--theme-muted)] text-xs font-semibold text-[var(--theme-contrast)] border border-[var(--theme-border)] transition-colors cursor-pointer"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? 'Kopyalandı' : 'Metni Kopyala'}</span>
            </button>
          </div>

          <textarea
            rows={8}
            value={proposalMessage}
            onChange={e => onProposalMessageChange(e.target.value)}
            className="w-full text-sm text-[var(--theme-contrast)] font-sans leading-relaxed bg-[var(--theme-surface)] p-4 rounded-xl border border-[var(--theme-border)] focus:outline-none focus:border-[var(--theme-primary)] resize-y"
          />
        </div>

        {/* Metnin Altındaki Mesaj Ayarları Butonu ve Doğrudan Gönderim Aksiyonları */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => setShowMessageSettings(v => !v)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--theme-surface)] hover:bg-[var(--theme-muted)] text-xs font-semibold text-[var(--theme-contrast)] border border-[var(--theme-border)] transition-colors cursor-pointer"
          >
            <SlidersHorizontal size={14} className="text-[var(--theme-primary)]" />
            <span>Mesaj Ayarları</span>
            {showMessageSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] text-xs font-semibold transition-colors"
              >
                <MessageSquare size={15} />
                <span>WhatsApp ile Gönder ({effectivePhone})</span>
              </a>
            )}
            {mailUrl && (
              <a
                href={mailUrl}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--theme-surface)] hover:bg-[var(--theme-muted)] text-[var(--theme-contrast)] border border-[var(--theme-border)] text-xs font-semibold transition-colors"
              >
                <Mail size={15} />
                <span>E-posta Gönder</span>
              </a>
            )}
            {instagramUrl && (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--theme-surface)] hover:bg-[var(--theme-muted)] text-[var(--theme-contrast)] border border-[var(--theme-border)] text-xs font-semibold transition-colors"
              >
                <Send size={14} />
                <span>Instagram Profilini Aç</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Açılır Mesaj Ayarları ve Gönderen Bilgileri */}
      {showMessageSettings && (
        <div className="bg-[var(--theme-canvas)] p-6 rounded-2xl border border-[var(--theme-border)] space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--theme-border)]">
            <span className="text-sm font-bold text-[var(--theme-contrast)]">
              Mesaj Ayarları
            </span>
            <button
              type="button"
              onClick={() => setShowApiKeyModal(!showApiKeyModal)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--theme-surface)] hover:bg-[var(--theme-muted)] text-xs font-medium text-[var(--theme-contrast)] border border-[var(--theme-border)] cursor-pointer"
            >
              <KeyRound size={13} />
              <span>{aiConfigured ? 'Gemini Ayarlı' : 'Gemini Anahtarı'}</span>
            </button>
          </div>

          {showApiKeyModal && (
            <form
              onSubmit={e => {
                onSaveApiKey(e);
                setShowApiKeyModal(false);
              }}
              className="p-4 bg-[var(--theme-surface)] rounded-xl border border-[var(--theme-border)] space-y-2.5 text-xs"
            >
              <div className="font-semibold text-[var(--theme-contrast)]">
                Google Gemini API Anahtarı (Şifreli Saklanır)
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={e => onApiKeyInputChange(e.target.value)}
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

          {/* Gönderen Bilgileri (Kullanıcının Kayıt Bilgileriyle Otomatik Dolu) */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-[var(--theme-contrast)] flex items-center gap-1.5">
                <UserCheck size={14} className="text-[var(--theme-primary)]" />
                <span>Gönderen Bilgileri</span>
              </span>
              {senderEmail && (
                <span className="text-[11px] text-[var(--theme-contrast)]/65">
                  Hesap: {senderEmail}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[var(--theme-contrast)]/80 mb-1">
                  Adınız Soyadınız
                </label>
                <input
                  type="text"
                  value={senderName}
                  onChange={e => onSenderNameChange(e.target.value)}
                  placeholder="Adınız Soyadınız"
                  className="w-full bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2 text-sm text-[var(--theme-contrast)] focus:outline-none focus:border-[var(--theme-primary)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--theme-contrast)]/80 mb-1">
                  Firma veya Ekip Adınız
                </label>
                <input
                  type="text"
                  value={agencyName}
                  onChange={e => onAgencyNameChange(e.target.value)}
                  placeholder="Firma veya Ekip Adınız"
                  className="w-full bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2 text-sm text-[var(--theme-contrast)] focus:outline-none focus:border-[var(--theme-primary)]"
                />
              </div>
            </div>
          </div>

          {/* Üslup, Hizmet ve Ek Not Ayarları */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[var(--theme-border)]">
            <div>
              <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1.5">
                Konuşma Dili
              </label>
              <select
                value={tone}
                onChange={e => onToneChange(e.target.value)}
                className="w-full bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--theme-contrast)] focus:outline-none cursor-pointer"
              >
                <option value="kurumsal">Kurumsal ve Saygılı</option>
                <option value="samimi">Samimi ve Esnaf Dostu</option>
                <option value="ikna_edici">İkna Edici ve Kazanç Odaklı</option>
                <option value="kisa_net">Kısa ve Doğrudan Sonuç Odaklı</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1.5">
                Önerilecek Hizmet
              </label>
              <select
                value={focusService}
                onChange={e => onFocusServiceChange(e.target.value)}
                className="w-full bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--theme-contrast)] focus:outline-none cursor-pointer"
              >
                <option value="auto">Otomatik (Eksiklere Göre En Uygunu)</option>
                <option value="web_tasarim">Telefon Uyumlu Yeni Web Sitesi</option>
                <option value="yerel_seo">Google Harita ve Üst Sıra Çalışması</option>
                <option value="performans_reklam">Instagram ve Google Reklam Yönetimi</option>
                <option value="e_ticaret">Online Sipariş / Randevu ve WhatsApp Hattı</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-[var(--theme-contrast)]/80 mb-1">
                Özel İndirim veya Kampanya Notu
              </label>
              <input
                type="text"
                value={specialOffer}
                onChange={e => onSpecialOfferChange(e.target.value)}
                placeholder="Örn: Bu haftaya özel Google Harita kaydı ücretsiz"
                className="w-full bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2 text-sm text-[var(--theme-contrast)] focus:outline-none focus:border-[var(--theme-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--theme-contrast)]/80 mb-1">
                Eklemek İstediğiniz Özel Not
              </label>
              <input
                type="text"
                value={customInstruction}
                onChange={e => onCustomInstructionChange(e.target.value)}
                placeholder="Örn: Paket servis siparişlerine vurgu yap"
                className="w-full bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2 text-sm text-[var(--theme-contrast)] focus:outline-none focus:border-[var(--theme-primary)]"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onGenerateAiPitch}
              disabled={isGeneratingPitch}
              className="inline-flex items-center justify-center gap-2 bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] font-semibold py-2.5 px-6 rounded-xl text-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <Sparkles size={16} className={isGeneratingPitch ? 'animate-spin' : ''} />
              <span>{isGeneratingPitch ? 'Mesaj Yenileniyor...' : 'Mesajı Yenile'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
