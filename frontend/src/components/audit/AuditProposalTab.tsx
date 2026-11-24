import React, { useState } from 'react';
import {
  Copy,
  Check,
  MessageSquare,
  Mail,
  Sparkles,
  KeyRound,
  SlidersHorizontal,
  PhoneCall,
  Send
} from 'lucide-react';

export type PitchChannelTab = 'whatsapp' | 'email' | 'instagram' | 'cold_call';

interface AuditProposalTabProps {
  pitchTab: PitchChannelTab;
  onSelectPitchTab: (tab: PitchChannelTab) => void;
  tone: string;
  onToneChange: (val: string) => void;
  focusService: string;
  onFocusServiceChange: (val: string) => void;
  senderName: string;
  onSenderNameChange: (val: string) => void;
  agencyName: string;
  onAgencyNameChange: (val: string) => void;
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
  emailSubject: string;
  onEmailSubjectChange: (val: string) => void;
  activePitchText: string;
  onActivePitchTextChange: (val: string) => void;
  copied: boolean;
  onCopyPitch: () => void;
  waUrl: string | null;
  mailUrl: string | null;
  effectivePhone: string | null;
  instagramUrl?: string | null;
}

export const AuditProposalTab: React.FC<AuditProposalTabProps> = ({
  pitchTab,
  onSelectPitchTab,
  tone,
  onToneChange,
  focusService,
  onFocusServiceChange,
  senderName,
  onSenderNameChange,
  agencyName,
  onAgencyNameChange,
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
  emailSubject,
  onEmailSubjectChange,
  activePitchText,
  onActivePitchTextChange,
  copied,
  onCopyPitch,
  waUrl,
  mailUrl,
  effectivePhone,
  instagramUrl
}) => {
  const [showPitchCustomizer, setShowPitchCustomizer] = useState(false);
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  return (
    <div className="space-y-5">
      <div className="bg-[var(--theme-canvas)] p-5 rounded-2xl border border-[var(--theme-border)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectPitchTab('whatsapp')}
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
            onClick={() => onSelectPitchTab('email')}
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
            onClick={() => onSelectPitchTab('instagram')}
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
            onClick={() => onSelectPitchTab('cold_call')}
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

        <button
          type="button"
          onClick={() => setShowPitchCustomizer(!showPitchCustomizer)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--theme-surface)] hover:bg-[var(--theme-muted)] text-xs font-semibold text-[var(--theme-contrast)] border border-[var(--theme-border)] transition-colors cursor-pointer"
        >
          <SlidersHorizontal size={14} className="text-[var(--theme-primary)]" />
          <span>{showPitchCustomizer ? 'Mesaj Ayarlarını Gizle' : 'Mesaj Ayarlarını Özelleştir'}</span>
        </button>
      </div>

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
                <span>{aiConfigured ? 'Gemini Ayarlı' : 'Gemini Anahtarı'}</span>
              </button>
            </div>
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

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-4">
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

            <div className="md:col-span-5">
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

            <div className="md:col-span-3">
              <button
                type="button"
                onClick={onGenerateAiPitch}
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
                  onChange={e => onSenderNameChange(e.target.value)}
                  placeholder="Örn: Ahmet Yılmaz"
                  className="w-full bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2 text-sm text-[var(--theme-contrast)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--theme-contrast)]/80 mb-1">Firma / Ekip Adınız</label>
                <input
                  type="text"
                  value={agencyName}
                  onChange={e => onAgencyNameChange(e.target.value)}
                  placeholder="Örn: Nova Web Tasarım"
                  className="w-full bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2 text-sm text-[var(--theme-contrast)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--theme-contrast)]/80 mb-1">Özel İndirim veya Hediye Notu</label>
                <input
                  type="text"
                  value={specialOffer}
                  onChange={e => onSpecialOfferChange(e.target.value)}
                  placeholder="Örn: Bu haftaya özel Google Harita kaydı ücretsiz"
                  className="w-full bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2 text-sm text-[var(--theme-contrast)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--theme-contrast)]/80 mb-1">Eklemek İstediğiniz Özel Not</label>
                <input
                  type="text"
                  value={customInstruction}
                  onChange={e => onCustomInstructionChange(e.target.value)}
                  placeholder="Örn: Paket servis siparişlerine vurgu yap"
                  className="w-full bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2 text-sm text-[var(--theme-contrast)] focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-[var(--theme-canvas)] p-6 rounded-2xl border border-[var(--theme-border)] space-y-4">
        {pitchTab === 'email' && (
          <div>
            <label className="block text-xs font-semibold text-[var(--theme-contrast)]/80 mb-1.5">
              E-posta Konusu
            </label>
            <input
              type="text"
              value={emailSubject}
              onChange={e => onEmailSubjectChange(e.target.value)}
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
              onClick={onCopyPitch}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--theme-surface)] hover:bg-[var(--theme-muted)] text-xs font-semibold text-[var(--theme-contrast)] border border-[var(--theme-border)] transition-colors cursor-pointer"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? 'Kopyalandı' : 'Metni Kopyala'}</span>
            </button>
          </div>
          <textarea
            rows={8}
            value={activePitchText}
            onChange={e => onActivePitchTextChange(e.target.value)}
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
          {instagramUrl && (
            <a
              href={instagramUrl}
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
  );
};
