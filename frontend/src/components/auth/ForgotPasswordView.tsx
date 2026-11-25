import React from 'react';
import {
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ClipboardPaste
} from 'lucide-react';
import { PasswordStrengthBox } from './PasswordStrengthBox';
import { getPasswordScore } from './passwordUtils';

interface ForgotPasswordViewProps {
  forgotStep: 'request' | 'verify';
  email: string;
  onEmailChange: (val: string) => void;
  resetCode: string;
  onResetCodeChange: (val: string) => void;
  newPassword: string;
  onNewPasswordChange: (val: string) => void;
  confirmNewPassword: string;
  onConfirmNewPasswordChange: (val: string) => void;
  showNewPassword: boolean;
  onToggleShowNewPassword: () => void;
  showConfirmNewPassword: boolean;
  onToggleShowConfirmNewPassword: () => void;
  isCapsLockOn: boolean;
  onKeyCapsLock: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  authSuccess: string | null;
  authError: string | null;
  onSetAuthError: (msg: string | null) => void;
  isForgotLoading: boolean;
  cooldown: number;
  hasTurnstileKey: boolean;
  turnstileContainerRef: React.RefObject<HTMLDivElement | null>;
  onRequestCode: (e?: React.FormEvent) => void;
  onSubmitNewPassword: (e: React.FormEvent) => void;
  onBackToLogin: () => void;
}

export const ForgotPasswordView: React.FC<ForgotPasswordViewProps> = ({
  forgotStep,
  email,
  onEmailChange,
  resetCode,
  onResetCodeChange,
  newPassword,
  onNewPasswordChange,
  confirmNewPassword,
  onConfirmNewPasswordChange,
  showNewPassword,
  onToggleShowNewPassword,
  showConfirmNewPassword,
  onToggleShowConfirmNewPassword,
  isCapsLockOn,
  onKeyCapsLock,
  authSuccess,
  authError,
  onSetAuthError,
  isForgotLoading,
  cooldown,
  hasTurnstileKey,
  turnstileContainerRef,
  onRequestCode,
  onSubmitNewPassword,
  onBackToLogin
}) => {
  const otpRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const newPasswordScore = getPasswordScore(newPassword);

  const handleOtpChange = (index: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const chars = resetCode.padEnd(6, ' ').split('');
    chars[index] = digit || ' ';
    const nextCode = chars.join('').replace(/ /g, '');
    onResetCodeChange(nextCode);
    if (authError) onSetAuthError(null);
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!resetCode[index] && index > 0) otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      onResetCodeChange(pasted);
      if (authError) onSetAuthError(null);
      otpRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const pasted = text.replace(/\D/g, '').slice(0, 6);
      if (pasted) {
        onResetCodeChange(pasted);
        if (authError) onSetAuthError(null);
        otpRefs.current[Math.min(pasted.length, 5)]?.focus();
      }
    } catch {
      onSetAuthError('Pano erişim izni verilemedi. Kodu doğrudan kutucuklara yapıştırabilirsiniz (Ctrl+V).');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--theme-contrast)] tracking-tight">
          Şifremi Unuttum
        </h1>
        <p className="text-xs text-[var(--theme-contrast)]/75 mt-1 leading-relaxed">
          {forgotStep === 'request'
            ? 'Kayıtlı e-posta adresinize 6 haneli tek kullanımlık doğrulama kodu göndereceğiz.'
            : 'E-posta adresinize iletilen 6 haneli doğrulama kodunu ve yeni şifrenizi giriniz.'}
        </p>
      </div>

      {authSuccess && (
        <div className="flex items-start gap-2.5 p-3.5 mb-5 rounded-xl bg-[var(--theme-muted)] border border-[var(--theme-border)] text-[var(--theme-contrast)] text-xs font-medium">
          <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-[var(--theme-primary)]" />
          <span>{authSuccess}</span>
        </div>
      )}

      {authError && (
        <div className="flex items-start gap-2.5 p-3.5 mb-5 rounded-xl bg-[var(--theme-canvas)] border border-[var(--theme-primary)]/45 text-[var(--theme-contrast)] text-xs font-medium">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-[var(--theme-primary)]" />
          <span>{authError}</span>
        </div>
      )}

      {forgotStep === 'request' ? (
        <form onSubmit={onRequestCode} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1.5">
              Kayıtlı E-posta Adresi
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => onEmailChange(e.target.value)}
              placeholder="ornek@eposta.com"
              maxLength={100}
              required
              className="w-full bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--theme-contrast)] placeholder-[var(--theme-contrast)]/45 focus:outline-none focus:border-[var(--theme-primary)]"
            />
          </div>

          {hasTurnstileKey && (
            <div className="bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-xl p-3 flex flex-col items-center justify-center">
              <div ref={turnstileContainerRef} />
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--theme-contrast)]/75 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-primary)]" />
                <span>Cloudflare Turnstile ile korunuyor</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isForgotLoading || cooldown > 0}
            className="w-full bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] font-semibold py-2.5 rounded-xl text-sm border border-[var(--theme-border)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isForgotLoading
              ? 'Doğrulama Kodu Gönderiliyor...'
              : cooldown > 0
                ? `Yeni Kod İçin Bekleyin (${cooldown}s)`
                : 'Doğrulama Kodu Gönder'}
          </button>
        </form>
      ) : (
        <form onSubmit={onSubmitNewPassword} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[var(--theme-contrast)]">
                6 Haneli Doğrulama Kodu
              </label>
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--theme-canvas)] border border-[var(--theme-border)] text-[11px] font-semibold text-[var(--theme-contrast)] hover:bg-[var(--theme-muted)] transition-colors cursor-pointer"
              >
                <ClipboardPaste size={12} />
                <span>Panodan Yapıştır</span>
              </button>
            </div>

            <div className="grid grid-cols-6 gap-2">
              {[0, 1, 2, 3, 4, 5].map(idx => (
                <input
                  key={idx}
                  ref={el => { otpRefs.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  value={resetCode[idx] || ''}
                  onChange={e => handleOtpChange(idx, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(idx, e)}
                  onPaste={handleOtpPaste}
                  className="w-full h-11 bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-xl text-center text-base font-bold text-[var(--theme-contrast)] focus:outline-none focus:border-[var(--theme-primary)]"
                />
              ))}
            </div>
            <p className="text-[11px] text-[var(--theme-contrast)]/75 mt-1.5">
              Doğrulama kodu 15 dakika boyunca geçerlidir.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1.5">
              Yeni Şifre
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={e => onNewPasswordChange(e.target.value)}
                onKeyUp={onKeyCapsLock}
                onKeyDown={onKeyCapsLock}
                placeholder="Yeni şifrenizi giriniz"
                maxLength={64}
                required
                className="w-full bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-xl px-4 py-2.5 pr-10 text-sm text-[var(--theme-contrast)] placeholder-[var(--theme-contrast)]/45 focus:outline-none focus:border-[var(--theme-primary)]"
              />
              <button
                type="button"
                onClick={onToggleShowNewPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--theme-contrast)] hover:text-[var(--theme-primary)] cursor-pointer"
                aria-label={showNewPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {isCapsLockOn && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-500 font-medium">
                <AlertCircle size={13} className="shrink-0" />
                <span>Büyük harf kilidi (Caps Lock) açık</span>
              </div>
            )}

            <PasswordStrengthBox password={newPassword} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1.5">
              Yeni Şifre (Tekrar)
            </label>
            <div className="relative">
              <input
                type={showConfirmNewPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmNewPassword}
                onChange={e => onConfirmNewPasswordChange(e.target.value)}
                onKeyUp={onKeyCapsLock}
                onKeyDown={onKeyCapsLock}
                placeholder="Yeni şifrenizi tekrar giriniz"
                maxLength={64}
                required
                className="w-full bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-xl px-4 py-2.5 pr-10 text-sm text-[var(--theme-contrast)] placeholder-[var(--theme-contrast)]/45 focus:outline-none focus:border-[var(--theme-primary)]"
              />
              <button
                type="button"
                onClick={onToggleShowConfirmNewPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--theme-contrast)] hover:text-[var(--theme-primary)] cursor-pointer"
                aria-label={showConfirmNewPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
              >
                {showConfirmNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmNewPassword.length > 0 && newPassword !== confirmNewPassword && (
              <p className="text-[11px] text-rose-500 font-medium mt-1">
                Şifreler birbiriyle eşleşmiyor.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isForgotLoading || newPasswordScore < 4 || newPassword !== confirmNewPassword}
            className="w-full bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] font-semibold py-2.5 rounded-xl text-sm border border-[var(--theme-border)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isForgotLoading ? 'Şifre Güncelleniyor...' : 'Yeni Şifreyi Kaydet'}
          </button>

          <div className="text-center pt-1">
            {cooldown > 0 ? (
              <p className="text-xs text-[var(--theme-contrast)]/75">
                Yeni kod talep etmek için <span className="text-[var(--theme-contrast)] font-bold">{cooldown}s</span> bekleyiniz.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => onRequestCode()}
                className="text-xs font-semibold text-[var(--theme-primary)] hover:underline cursor-pointer"
              >
                Doğrulama kodunu tekrar gönder
              </button>
            )}
          </div>
        </form>
      )}

      <div className="pt-4 mt-6 border-t border-[var(--theme-border)] text-center">
        <button
          type="button"
          onClick={onBackToLogin}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--theme-contrast)] hover:text-[var(--theme-primary)] transition-colors cursor-pointer"
        >
          <ArrowLeft size={15} />
          <span>Giriş Ekranına Dön</span>
        </button>
      </div>
    </div>
  );
};
