import React, { useState } from 'react';
import { loginUser, registerUser, forgotPassword, resetPassword } from '../api';
import { type ThemeId } from '../theme';
import {
  Radar,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { AuthMissionPanel } from './auth/AuthMissionPanel';
import { PasswordStrengthBox } from './auth/PasswordStrengthBox';
import { getPasswordScore } from './auth/passwordUtils';
import { ForgotPasswordView } from './auth/ForgotPasswordView';

interface AuthScreenProps {
  onAuthSuccess: (accessToken: string) => void;
  initialError?: string | null;
  currentTheme: ThemeId;
}

const TURNSTILE_SITE_KEY: string =
  import.meta.env.VITE_TURNSTILE_SITE_KEY ||
  (import.meta.env.DEV ? '1x00000000000000000000AA' : '');

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthSuccess,
  initialError,
  currentTheme,
}) => {
  const [email, setEmail] = useState<string>(() => localStorage.getItem('remember_email') || '');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState<boolean>(() => localStorage.getItem('remember_email') !== null);
  const [isLogin, setIsLogin] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(initialError || null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);

  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'verify'>('request');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  React.useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const turnstileContainerRef = React.useRef<HTMLDivElement>(null);
  const turnstileWidgetId = React.useRef<string | null>(null);

  const resetTurnstile = () => {
    setTurnstileToken(null);
    const win = window as unknown as { turnstile?: { reset: (id: string) => void } };
    if (turnstileWidgetId.current && win.turnstile) {
      try {
        win.turnstile.reset(turnstileWidgetId.current);
      } catch {
        // Turnstile widget sifirlama hatasi yoksayilir
      }
    }
  };

  const handleKeyCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === 'function') {
      setIsCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  React.useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let currentWidget: string | null = null;
    const win = window as unknown as {
      turnstile?: {
        render: (el: HTMLElement, opts: Record<string, unknown>) => string;
        remove: (id: string) => void;
      };
    };

    const renderWidget = () => {
      if (win.turnstile && turnstileContainerRef.current) {
        try {
          turnstileContainerRef.current.innerHTML = '';
          currentWidget = win.turnstile.render(turnstileContainerRef.current, {
            sitekey: TURNSTILE_SITE_KEY,
            theme: currentTheme === 'midnight' || currentTheme === 'anthracite' ? 'dark' : 'light',
            appearance: 'interaction-only',
            callback: (t: string) => setTurnstileToken(t),
          });
          turnstileWidgetId.current = currentWidget;
        } catch {
          // Turnstile yuklenemedi
        }
      }
    };

    const timer = setTimeout(renderWidget, 150);
    return () => {
      clearTimeout(timer);
      if (currentWidget && win.turnstile) {
        try {
          win.turnstile.remove(currentWidget);
        } catch {
          // Temizleme hatasi yoksayilir
        }
      }
    };
  }, [isLogin, isForgotPassword, forgotStep, currentTheme]);

  const passwordScore = getPasswordScore(password);
  const newPasswordScore = getPasswordScore(newPassword);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthLoading) return;
    setAuthError(null);
    setAuthSuccess(null);

    const emailNormalized = email.trim().toLowerCase();

    if (isLogin) {
      if (!emailNormalized || !password.trim()) {
        setAuthError('Lütfen bütün bilgileri eksiksiz giriniz.');
        return;
      }
    } else {
      if (!emailNormalized || !firstName.trim() || !lastName.trim() || !companyName.trim() || !password.trim() || !confirmPassword.trim()) {
        setAuthError('Lütfen bütün bilgileri eksiksiz giriniz.');
        return;
      }
      if (passwordScore < 4) {
        setAuthError('Lütfen tüm şifre güvenlik kurallarını sağlayınız.');
        return;
      }
      if (password !== confirmPassword) {
        setAuthError('Girilen şifreler birbiriyle eşleşmiyor.');
        return;
      }
    }

    setIsAuthLoading(true);
    try {
      if (isLogin) {
        const data = await loginUser(emailNormalized, password, turnstileToken || undefined);
        if (rememberMe) localStorage.setItem('remember_email', emailNormalized);
        else localStorage.removeItem('remember_email');
        onAuthSuccess(data.access_token);
      } else {
        const regData = await registerUser(
          emailNormalized,
          password,
          firstName.trim(),
          lastName.trim(),
          companyName.trim(),
          turnstileToken || undefined
        );
        const accessToken = regData.access_token || (await loginUser(emailNormalized, password)).access_token;
        if (rememberMe) localStorage.setItem('remember_email', emailNormalized);
        else localStorage.removeItem('remember_email');
        onAuthSuccess(accessToken);
      }
    } catch (err: unknown) {
      resetTurnstile();
      const message = err instanceof Error ? err.message : 'İşlem sırasında bir hata oluştu.';
      if (message === 'Incorrect email or password' || message === 'Giriş başarısız') {
        setAuthError('E-posta veya şifre hatalı.');
      } else {
        setAuthError(message);
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleForgotPasswordRequest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (cooldown > 0 || isForgotLoading) return;
    setAuthError(null);
    setAuthSuccess(null);
    const emailNormalized = email.trim().toLowerCase();
    if (!emailNormalized) {
      setAuthError('Lütfen e-posta adresinizi giriniz.');
      return;
    }
    setIsForgotLoading(true);
    try {
      const data = await forgotPassword(emailNormalized, turnstileToken || undefined);
      setForgotStep('verify');
      setAuthSuccess(data.message || 'Doğrulama kodu e-posta adresinize gönderildi.');
      setCooldown(data.cooldown_seconds || 60);
    } catch (err: unknown) {
      resetTurnstile();
      setAuthError(err instanceof Error ? err.message : 'İşlem sırasında bir hata oluştu.');
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isForgotLoading) return;
    setAuthError(null);
    setAuthSuccess(null);
    if (!resetCode.trim() || resetCode.trim().length < 6) {
      setAuthError('Lütfen 6 haneli doğrulama kodunu eksiksiz giriniz.');
      return;
    }
    if (!newPassword.trim() || !confirmNewPassword.trim()) {
      setAuthError('Lütfen yeni şifrenizi ve şifre tekrarını giriniz.');
      return;
    }
    if (newPasswordScore < 4) {
      setAuthError('Lütfen tüm şifre güvenlik kurallarını sağlayınız.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setAuthError('Yeni şifreler birbiriyle eşleşmiyor.');
      return;
    }
    setIsForgotLoading(true);
    try {
      const data = await resetPassword(email.trim().toLowerCase(), resetCode.trim(), newPassword);
      setAuthSuccess(data.message || 'Şifreniz başarıyla güncellendi!');
      setTimeout(() => {
        setIsForgotPassword(false);
        setForgotStep('request');
        setResetCode('');
        setNewPassword('');
        setConfirmNewPassword('');
        setIsLogin(true);
        setPassword('');
        setConfirmPassword('');
        setAuthSuccess('Şifreniz başarıyla güncellendi! Yeni şifrenizle giriş yapabilirsiniz.');
      }, 1500);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Şifre güncellenemedi.');
    } finally {
      setIsForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--theme-canvas)] text-[var(--theme-contrast)] flex flex-col lg:flex-row font-sans relative overflow-hidden">
      <AuthMissionPanel />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 sm:p-10 lg:p-16 order-1 lg:order-2">
        <div className="relative z-10 w-full max-w-md bg-[var(--theme-surface)] rounded-2xl border border-[var(--theme-border)] shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-xl bg-[var(--theme-primary)] border border-[var(--theme-border)] flex items-center justify-center text-[var(--theme-on-primary)]">
                <Radar size={24} />
              </div>
              <span className="text-xl font-bold tracking-tight text-[var(--theme-contrast)] leading-none">
                EsnafRadar
              </span>
            </div>

            {isForgotPassword ? (
              <ForgotPasswordView
                forgotStep={forgotStep}
                email={email}
                onEmailChange={val => {
                  setEmail(val);
                  if (authError) setAuthError(null);
                }}
                resetCode={resetCode}
                onResetCodeChange={setResetCode}
                newPassword={newPassword}
                onNewPasswordChange={val => {
                  setNewPassword(val);
                  if (authError) setAuthError(null);
                }}
                confirmNewPassword={confirmNewPassword}
                onConfirmNewPasswordChange={val => {
                  setConfirmNewPassword(val);
                  if (authError) setAuthError(null);
                }}
                showNewPassword={showNewPassword}
                onToggleShowNewPassword={() => setShowNewPassword(!showNewPassword)}
                showConfirmNewPassword={showConfirmNewPassword}
                onToggleShowConfirmNewPassword={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                isCapsLockOn={isCapsLockOn}
                onKeyCapsLock={handleKeyCapsLock}
                authSuccess={authSuccess}
                authError={authError}
                onSetAuthError={setAuthError}
                isForgotLoading={isForgotLoading}
                cooldown={cooldown}
                hasTurnstileKey={Boolean(TURNSTILE_SITE_KEY)}
                turnstileContainerRef={turnstileContainerRef}
                onRequestCode={handleForgotPasswordRequest}
                onSubmitNewPassword={handleResetPasswordSubmit}
                onBackToLogin={() => {
                  setIsForgotPassword(false);
                  setForgotStep('request');
                  setAuthError(null);
                  setAuthSuccess(null);
                  setNewPassword('');
                  setConfirmNewPassword('');
                }}
              />
            ) : (
              <div>
                <div className="grid grid-cols-2 bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-xl p-1 mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isLogin) {
                        setIsLogin(true);
                        setAuthError(null);
                        setAuthSuccess(null);
                        setFirstName('');
                        setLastName('');
                        setCompanyName('');
                        setPassword('');
                        setConfirmPassword('');
                      }
                    }}
                    className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      isLogin
                        ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)]'
                        : 'text-[var(--theme-contrast)] hover:bg-[var(--theme-surface)]'
                    }`}
                  >
                    Giriş Yap
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isLogin) {
                        setIsLogin(false);
                        setAuthError(null);
                        setAuthSuccess(null);
                        setFirstName('');
                        setLastName('');
                        setCompanyName('');
                        setPassword('');
                        setConfirmPassword('');
                      }
                    }}
                    className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      !isLogin
                        ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)]'
                        : 'text-[var(--theme-contrast)] hover:bg-[var(--theme-surface)]'
                    }`}
                  >
                    Yeni Hesap Oluştur
                  </button>
                </div>

                <div className="mb-5">
                  <h1 className="text-xl font-bold text-[var(--theme-contrast)] tracking-tight">
                    {isLogin ? "EsnafRadar'a Hoş Geldiniz" : 'Yeni Hesap Oluşturun'}
                  </h1>
                  <p className="text-xs text-[var(--theme-contrast)]/75 mt-1">
                    {isLogin
                      ? 'Keşif motoru ve müşteri yönetim paneline erişmek için bilgilerinizi giriniz.'
                      : 'Platformu kullanmaya başlamak için aşağıdaki bilgileri doldurunuz.'}
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

                <form onSubmit={handleAuth} className="space-y-4">
                  {!isLogin && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1.5">
                            Ad
                          </label>
                          <input
                            type="text"
                            autoComplete="given-name"
                            value={firstName}
                            onChange={e => { setFirstName(e.target.value); if (authError) setAuthError(null); }}
                            placeholder="Adınız"
                            maxLength={50}
                            className="w-full bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--theme-contrast)] placeholder-[var(--theme-contrast)]/45 focus:outline-none focus:border-[var(--theme-primary)]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1.5">
                            Soyad
                          </label>
                          <input
                            type="text"
                            autoComplete="family-name"
                            value={lastName}
                            onChange={e => { setLastName(e.target.value); if (authError) setAuthError(null); }}
                            placeholder="Soyadınız"
                            maxLength={50}
                            className="w-full bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--theme-contrast)] placeholder-[var(--theme-contrast)]/45 focus:outline-none focus:border-[var(--theme-primary)]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1.5">
                          Firma veya Ekip Adı
                        </label>
                        <input
                          type="text"
                          autoComplete="organization"
                          value={companyName}
                          onChange={e => { setCompanyName(e.target.value); if (authError) setAuthError(null); }}
                          placeholder="Örn: Nova Dijital / Ahmet Yılmaz Web Ekibi"
                          maxLength={100}
                          className="w-full bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--theme-contrast)] placeholder-[var(--theme-contrast)]/45 focus:outline-none focus:border-[var(--theme-primary)]"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1.5">
                      E-posta Adresi
                    </label>
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); if (authError) setAuthError(null); }}
                      placeholder="ornek@eposta.com"
                      maxLength={100}
                      className="w-full bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--theme-contrast)] placeholder-[var(--theme-contrast)]/45 focus:outline-none focus:border-[var(--theme-primary)]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-[var(--theme-contrast)]">
                        Şifre
                      </label>
                      {isLogin && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsForgotPassword(true);
                            setForgotStep('request');
                            setAuthError(null);
                            setAuthSuccess(null);
                          }}
                          className="text-xs font-semibold text-[var(--theme-primary)] hover:underline cursor-pointer"
                        >
                          Şifremi unuttum?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={isLogin ? 'current-password' : 'new-password'}
                        value={password}
                        onChange={e => { setPassword(e.target.value); if (authError) setAuthError(null); }}
                        onKeyUp={handleKeyCapsLock}
                        onKeyDown={handleKeyCapsLock}
                        placeholder="Şifrenizi giriniz"
                        maxLength={64}
                        className="w-full bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2.5 pr-10 text-sm text-[var(--theme-contrast)] placeholder-[var(--theme-contrast)]/45 focus:outline-none focus:border-[var(--theme-primary)]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--theme-contrast)] hover:text-[var(--theme-primary)] cursor-pointer"
                        aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    {isCapsLockOn && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-500 font-medium">
                        <AlertCircle size={13} className="shrink-0" />
                        <span>Büyük harf kilidi (Caps Lock) açık</span>
                      </div>
                    )}

                    {!isLogin && <PasswordStrengthBox password={password} />}
                  </div>

                  {!isLogin && (
                    <div>
                      <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1.5">
                        Şifre (Tekrar)
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={e => { setConfirmPassword(e.target.value); if (authError) setAuthError(null); }}
                          onKeyUp={handleKeyCapsLock}
                          onKeyDown={handleKeyCapsLock}
                          placeholder="Şifrenizi tekrar giriniz"
                          maxLength={64}
                          className="w-full bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2.5 pr-10 text-sm text-[var(--theme-contrast)] placeholder-[var(--theme-contrast)]/45 focus:outline-none focus:border-[var(--theme-primary)]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--theme-contrast)] hover:text-[var(--theme-primary)] cursor-pointer"
                          aria-label={showConfirmPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      {confirmPassword.length > 0 && password !== confirmPassword && (
                        <p className="text-[11px] text-rose-500 font-medium mt-1">
                          Şifreler birbiriyle eşleşmiyor.
                        </p>
                      )}
                    </div>
                  )}

                  {isLogin && (
                    <div className="flex items-center justify-between pt-0.5">
                      <label className="inline-flex items-center gap-2 text-xs text-[var(--theme-contrast)] cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={e => setRememberMe(e.target.checked)}
                          className="accent-[var(--theme-primary)] rounded cursor-pointer"
                        />
                        <span>E-posta adresimi bu cihazda hatırla</span>
                      </label>
                    </div>
                  )}

                  {TURNSTILE_SITE_KEY && (
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
                    disabled={isAuthLoading}
                    className="w-full bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] font-semibold py-2.5 rounded-xl text-sm border border-[var(--theme-border)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAuthLoading
                      ? (isLogin ? 'Giriş Yapılıyor...' : 'Kayıt Oluşturuluyor...')
                      : (isLogin ? 'Giriş Yap' : 'Hesap Oluştur')}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
