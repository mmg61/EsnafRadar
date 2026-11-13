import React, { useState } from 'react';
import { loginUser, registerUser, forgotPassword, resetPassword } from '../api';
import {
  Radar,
  Users,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  Check,
  Circle,
  AlertCircle,
  ClipboardPaste,
  MapPin,
  Globe,
  Layers
} from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: (accessToken: string) => void;
  initialError?: string | null;
}

const TURNSTILE_SITE_KEY: string =
  import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess, initialError }) => {
  const [email, setEmail] = useState<string>(() => localStorage.getItem('remember_email') || '');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
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

  // Forgot password state
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
  const otpRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const resetTurnstile = () => {
    setTurnstileToken(null);
    const win = window as unknown as { turnstile?: { reset: (id: string) => void } };
    if (turnstileWidgetId.current && win.turnstile) {
      try {
        win.turnstile.reset(turnstileWidgetId.current);
      } catch (_) {}
    }
  };

  const handleKeyCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === 'function') {
      setIsCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const chars = resetCode.padEnd(6, ' ').split('');
    chars[index] = digit || ' ';
    const nextCode = chars.join('').replace(/ /g, '');
    setResetCode(nextCode);
    if (authError) setAuthError(null);
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!resetCode[index] && index > 0) {
        otpRefs.current[index - 1]?.focus();
      }
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
      setResetCode(pasted);
      if (authError) setAuthError(null);
      const focusIdx = Math.min(pasted.length, 5);
      otpRefs.current[focusIdx]?.focus();
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const pasted = text.replace(/\D/g, '').slice(0, 6);
      if (pasted) {
        setResetCode(pasted);
        if (authError) setAuthError(null);
        const focusIdx = Math.min(pasted.length, 5);
        otpRefs.current[focusIdx]?.focus();
      }
    } catch (_) {
      setAuthError('Pano erişim izni verilemedi. Kodu doğrudan kutucuklara yapıştırabilirsiniz (Ctrl+V).');
    }
  };

  React.useEffect(() => {
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
            theme: 'light',
            appearance: 'interaction-only',
            callback: (t: string) => setTurnstileToken(t),
          });
          turnstileWidgetId.current = currentWidget;
        } catch (_) {}
      }
    };

    const timer = setTimeout(renderWidget, 150);
    return () => {
      clearTimeout(timer);
      if (currentWidget && win.turnstile) {
        try {
          win.turnstile.remove(currentWidget);
        } catch (_) {}
      }
    };
  }, [isLogin, isForgotPassword, forgotStep]);

  const getPasswordScore = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    return score;
  };
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
      if (!emailNormalized || !firstName.trim() || !lastName.trim() || !password.trim() || !confirmPassword.trim()) {
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
        if (rememberMe) {
          localStorage.setItem('remember_email', emailNormalized);
        } else {
          localStorage.removeItem('remember_email');
        }
        onAuthSuccess(data.access_token);
      } else {
        const regData = await registerUser(emailNormalized, password, firstName.trim(), lastName.trim(), turnstileToken || undefined);
        const accessToken = regData.access_token || (await loginUser(emailNormalized, password)).access_token;
        if (rememberMe) {
          localStorage.setItem('remember_email', emailNormalized);
        } else {
          localStorage.removeItem('remember_email');
        }
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
    <div className="min-h-screen bg-[#FFF8E7] text-[#3F5E45] flex flex-col lg:flex-row font-sans relative overflow-hidden">
      {/* SOL PANEL: Kurumsal Misyon ve İş Akışı (#3F5E45 Zemin - Vector0 Referansı) */}
      <div className="relative z-10 lg:w-[46%] bg-[#3F5E45] text-[#FFF8E7] border-b-2 lg:border-b-0 lg:border-r-2 border-[#3F5E45] p-8 lg:p-14 flex flex-col justify-between order-2 lg:order-1">
        <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full py-6">
          <div className="text-center flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#6F8F72] border border-[#B7C9A8] text-[#FFF8E7] text-xs font-semibold mb-5">
              <Layers size={14} />
              <span>Coğrafi Konum Tabanlı Dijital Denetim ve CRM</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold text-[#FFF8E7] leading-snug tracking-tight">
              Yerel İşletmelerin Dijital Varlıklarını Analiz Edin ve Satış Süreçlerini Yönetin
            </h2>
            <p className="mt-4 text-sm text-[#E8DCC4] leading-relaxed max-w-md">
              Açık kaynaklı harita verileri üzerinden bölgesel tarama gerçekleştirin, işletmelerin web ve iletişim altyapılarını denetleyin ve potansiyel müşterilerinizi tek merkezden takip edin.
            </p>
          </div>

          <div className="mt-10 space-y-0 border-l-2 border-[#B7C9A8] ml-4 sm:ml-8 max-w-md mx-auto">
            <div className="relative pl-6 pb-7">
              <div className="absolute -left-[9px] top-0.5 w-4 h-4 rounded-full bg-[#B7C9A8] border-2 border-[#3F5E45]" />
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#B7C9A8]">
                <MapPin size={14} />
                <span>01. Bölgesel Tarama ve Keşif</span>
              </div>
              <p className="mt-1.5 text-xs text-[#E8DCC4] leading-relaxed">
                Overpass API motoru ve 40'tan fazla sektör filtresi ile hedef koordinattaki ticari işletmeleri anlık olarak tespit edin.
              </p>
            </div>

            <div className="relative pl-6 pb-7">
              <div className="absolute -left-[9px] top-0.5 w-4 h-4 rounded-full bg-[#3F5E45] border-2 border-[#B7C9A8]" />
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#B7C9A8]">
                <Globe size={14} />
                <span>02. Dijital Varlık Röntgeni</span>
              </div>
              <p className="mt-1.5 text-xs text-[#E8DCC4] leading-relaxed">
                HTTP durum kodu, SSL sertifikası, mobil uyumluluk sinyali ve sosyal medya varlıklarını otomatik denetleyerek fırsat puanı hesaplayın.
              </p>
            </div>

            <div className="relative pl-6">
              <div className="absolute -left-[9px] top-0.5 w-4 h-4 rounded-full bg-[#3F5E45] border-2 border-[#B7C9A8]" />
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#B7C9A8]">
                <Users size={14} />
                <span>03. Müşteri İlişkileri ve Doğrudan İletişim</span>
              </div>
              <p className="mt-1.5 text-xs text-[#E8DCC4] leading-relaxed">
                İncelenen işletmeleri müşteri aday listesine kaydedin, satış aşamalarını güncelleyin ve doğrudan kurumsal iletişim başlatın.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-5 border-t border-[#6F8F72] flex flex-wrap items-center justify-center sm:justify-between gap-4 text-xs text-[#E8DCC4] max-w-lg mx-auto w-full">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#B7C9A8] inline-block" />
            <span className="font-medium">Overpass Keşif Motoru: Aktif</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-[#E8DCC4]">
            <span>Web Denetleyici: Hazır</span>
            <span>JWT & Turnstile Koruması</span>
          </div>
        </div>
      </div>

      {/* SAĞ PANEL: Kimlik Doğrulama Form Alanı (#FFF8E7 Zemin) */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-16 order-1 lg:order-2">
        <div className="relative z-10 w-full max-w-md bg-[#E8DCC4] rounded-xl border-2 border-[#3F5E45] overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-xl bg-[#3F5E45] border border-[#3F5E45] flex items-center justify-center text-[#FFF8E7]">
                <Radar size={24} />
              </div>
              <span className="text-xl font-bold tracking-tight text-[#3F5E45] leading-none">
                EsnafRadar
              </span>
            </div>

            {isForgotPassword ? (
              <div>
                <div className="mb-6">
                  <h1 className="text-xl font-bold text-[#3F5E45] tracking-tight">
                    Şifremi Unuttum
                  </h1>
                  <p className="text-xs text-[#3F5E45]/80 mt-1 leading-relaxed">
                    {forgotStep === 'request'
                      ? 'Kayıtlı e-posta adresinize 6 haneli tek kullanımlık doğrulama kodu göndereceğiz.'
                      : 'E-posta adresinize iletilen 6 haneli doğrulama kodunu ve yeni şifrenizi giriniz.'}
                  </p>
                </div>

                {authSuccess && (
                  <div className="flex items-start gap-2.5 p-3.5 mb-5 rounded-xl bg-[#B7C9A8] border border-[#3F5E45] text-[#3F5E45] text-xs font-medium">
                    <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-[#3F5E45]" />
                    <span>{authSuccess}</span>
                  </div>
                )}

                {authError && (
                  <div className="flex items-start gap-2.5 p-3.5 mb-5 rounded-xl bg-rose-100 border border-rose-700 text-rose-900 text-xs font-medium">
                    <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-700" />
                    <span>{authError}</span>
                  </div>
                )}

                {forgotStep === 'request' ? (
                  <form onSubmit={handleForgotPasswordRequest} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#3F5E45] mb-1.5">
                        Kayıtlı E-posta Adresi
                      </label>
                      <input
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={e => { setEmail(e.target.value); if (authError) setAuthError(null); }}
                        placeholder="ornek@eposta.com"
                        maxLength={100}
                        required
                        className="w-full bg-[#FFF8E7] border border-[#3F5E45] rounded-xl px-4 py-2.5 text-sm text-[#3F5E45] placeholder-[#3F5E45]/50 focus:outline-none focus:border-[#6F8F72]"
                      />
                    </div>

                    <div className="bg-[#FFF8E7] border border-[#3F5E45] rounded-xl p-3 flex flex-col items-center justify-center">
                      <div ref={turnstileContainerRef} />
                      <div className="flex items-center gap-1.5 text-[11px] text-[#3F5E45]/80 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#6F8F72]" />
                        <span>Cloudflare Turnstile ile korunuyor</span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isForgotLoading || cooldown > 0}
                      className="w-full bg-[#6F8F72] hover:bg-[#3F5E45] text-[#FFF8E7] font-semibold py-2.5 rounded-xl text-sm border border-[#3F5E45] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isForgotLoading
                        ? 'Doğrulama Kodu Gönderiliyor...'
                        : cooldown > 0
                          ? `Yeni Kod İçin Bekleyin (${cooldown}s)`
                          : 'Doğrulama Kodu Gönder'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-[#3F5E45]">
                          6 Haneli Doğrulama Kodu
                        </label>
                        <button
                          type="button"
                          onClick={handlePasteFromClipboard}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFF8E7] border border-[#3F5E45] text-[11px] font-semibold text-[#3F5E45] hover:bg-[#B7C9A8] transition-colors cursor-pointer"
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
                            className="w-full h-11 bg-[#FFF8E7] border border-[#3F5E45] rounded-xl text-center text-base font-bold text-[#3F5E45] focus:outline-none focus:border-[#6F8F72]"
                          />
                        ))}
                      </div>
                      <p className="text-[11px] text-[#3F5E45]/80 mt-1.5">
                        Doğrulama kodu 15 dakika boyunca geçerlidir.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#3F5E45] mb-1.5">
                        Yeni Şifre
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={newPassword}
                          onChange={e => { setNewPassword(e.target.value); if (authError) setAuthError(null); }}
                          onKeyUp={handleKeyCapsLock}
                          onKeyDown={handleKeyCapsLock}
                          placeholder="Yeni şifrenizi giriniz"
                          maxLength={64}
                          required
                          className="w-full bg-[#FFF8E7] border border-[#3F5E45] rounded-xl px-4 py-2.5 pr-10 text-sm text-[#3F5E45] placeholder-[#3F5E45]/50 focus:outline-none focus:border-[#6F8F72]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3F5E45] hover:text-[#6F8F72] cursor-pointer"
                          aria-label={showNewPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                        >
                          {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>

                      {isCapsLockOn && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-800 font-medium">
                          <AlertCircle size={13} className="shrink-0" />
                          <span>Büyük harf kilidi (Caps Lock) açık</span>
                        </div>
                      )}

                      {newPassword.length > 0 && (
                        <div className="mt-2.5 p-3 bg-[#FFF8E7] rounded-xl border border-[#3F5E45] space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[#3F5E45]/80">Şifre Güvenliği:</span>
                            <span className="font-bold text-[#3F5E45]">
                              {newPasswordScore === 4 ? 'Güçlü' : newPasswordScore >= 2 ? 'Orta' : 'Zayıf'}
                            </span>
                          </div>
                          <div className="flex gap-1.5 h-1.5">
                            {[1, 2, 3, 4].map(step => (
                              <div
                                key={step}
                                className={`flex-1 rounded-full ${
                                  newPasswordScore >= step ? 'bg-[#6F8F72]' : 'bg-[#E8DCC4]'
                                }`}
                              />
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-1">
                            <span className={`flex items-center gap-1 ${newPassword.length >= 8 ? 'text-[#3F5E45] font-semibold' : 'text-[#3F5E45]/60'}`}>
                              {newPassword.length >= 8 ? <Check size={12} className="shrink-0" /> : <Circle size={8} className="shrink-0" />} En az 8 karakter
                            </span>
                            <span className={`flex items-center gap-1 ${/[A-Z]/.test(newPassword) ? 'text-[#3F5E45] font-semibold' : 'text-[#3F5E45]/60'}`}>
                              {/[A-Z]/.test(newPassword) ? <Check size={12} className="shrink-0" /> : <Circle size={8} className="shrink-0" />} En az 1 büyük harf
                            </span>
                            <span className={`flex items-center gap-1 ${/[a-z]/.test(newPassword) ? 'text-[#3F5E45] font-semibold' : 'text-[#3F5E45]/60'}`}>
                              {/[a-z]/.test(newPassword) ? <Check size={12} className="shrink-0" /> : <Circle size={8} className="shrink-0" />} En az 1 küçük harf
                            </span>
                            <span className={`flex items-center gap-1 ${/\d/.test(newPassword) ? 'text-[#3F5E45] font-semibold' : 'text-[#3F5E45]/60'}`}>
                              {/\d/.test(newPassword) ? <Check size={12} className="shrink-0" /> : <Circle size={8} className="shrink-0" />} En az 1 rakam
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#3F5E45] mb-1.5">
                        Yeni Şifre (Tekrar)
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmNewPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={confirmNewPassword}
                          onChange={e => { setConfirmNewPassword(e.target.value); if (authError) setAuthError(null); }}
                          onKeyUp={handleKeyCapsLock}
                          onKeyDown={handleKeyCapsLock}
                          placeholder="Yeni şifrenizi tekrar giriniz"
                          maxLength={64}
                          required
                          className="w-full bg-[#FFF8E7] border border-[#3F5E45] rounded-xl px-4 py-2.5 pr-10 text-sm text-[#3F5E45] placeholder-[#3F5E45]/50 focus:outline-none focus:border-[#6F8F72]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3F5E45] hover:text-[#6F8F72] cursor-pointer"
                          aria-label={showConfirmNewPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                        >
                          {showConfirmNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      {confirmNewPassword.length > 0 && newPassword !== confirmNewPassword && (
                        <p className="text-[11px] text-rose-700 font-medium mt-1">
                          Şifreler birbiriyle eşleşmiyor.
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isForgotLoading || newPasswordScore < 4 || newPassword !== confirmNewPassword}
                      className="w-full bg-[#6F8F72] hover:bg-[#3F5E45] text-[#FFF8E7] font-semibold py-2.5 rounded-xl text-sm border border-[#3F5E45] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isForgotLoading ? 'Şifre Güncelleniyor...' : 'Yeni Şifreyi Kaydet'}
                    </button>

                    <div className="text-center pt-1">
                      {cooldown > 0 ? (
                        <p className="text-xs text-[#3F5E45]/80">
                          Yeni kod talep etmek için <span className="text-[#3F5E45] font-bold">{cooldown}s</span> bekleyiniz.
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleForgotPasswordRequest()}
                          className="text-xs font-semibold text-[#3F5E45] hover:underline cursor-pointer"
                        >
                          Doğrulama kodunu tekrar gönder
                        </button>
                      )}
                    </div>
                  </form>
                )}

                <div className="pt-4 mt-6 border-t border-[#3F5E45]/30 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setForgotStep('request');
                      setAuthError(null);
                      setAuthSuccess(null);
                      setNewPassword('');
                      setConfirmNewPassword('');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3F5E45] hover:text-[#6F8F72] transition-colors cursor-pointer"
                  >
                    <ArrowLeft size={15} />
                    <span>Giriş Ekranına Dön</span>
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-2 bg-[#FFF8E7] border border-[#3F5E45] rounded-xl p-1 mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isLogin) {
                        setIsLogin(true);
                        setAuthError(null);
                        setAuthSuccess(null);
                        setFirstName('');
                        setLastName('');
                        setPassword('');
                        setConfirmPassword('');
                      }
                    }}
                    className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      isLogin
                        ? 'bg-[#6F8F72] text-[#FFF8E7]'
                        : 'text-[#3F5E45] hover:bg-[#E8DCC4]'
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
                        setPassword('');
                        setConfirmPassword('');
                      }
                    }}
                    className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      !isLogin
                        ? 'bg-[#6F8F72] text-[#FFF8E7]'
                        : 'text-[#3F5E45] hover:bg-[#E8DCC4]'
                    }`}
                  >
                    Yeni Hesap Oluştur
                  </button>
                </div>

                <div className="mb-5">
                  <h1 className="text-xl font-bold text-[#3F5E45] tracking-tight">
                    {isLogin ? "EsnafRadar'a Hoş Geldiniz" : 'Yeni Hesap Oluşturun'}
                  </h1>
                  <p className="text-xs text-[#3F5E45]/80 mt-1">
                    {isLogin
                      ? 'Keşif motoru ve müşteri yönetim paneline erişmek için bilgilerinizi giriniz.'
                      : 'Platformu kullanmaya başlamak için aşağıdaki bilgileri doldurunuz.'}
                  </p>
                </div>

                {authSuccess && (
                  <div className="flex items-start gap-2.5 p-3.5 mb-5 rounded-xl bg-[#B7C9A8] border border-[#3F5E45] text-[#3F5E45] text-xs font-medium">
                    <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-[#3F5E45]" />
                    <span>{authSuccess}</span>
                  </div>
                )}

                {authError && (
                  <div className="flex items-start gap-2.5 p-3.5 mb-5 rounded-xl bg-rose-100 border border-rose-700 text-rose-900 text-xs font-medium">
                    <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-700" />
                    <span>{authError}</span>
                  </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                  {!isLogin && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#3F5E45] mb-1.5">
                          Ad
                        </label>
                        <input
                          type="text"
                          autoComplete="given-name"
                          value={firstName}
                          onChange={e => { setFirstName(e.target.value); if (authError) setAuthError(null); }}
                          placeholder="Adınız"
                          maxLength={50}
                          className="w-full bg-[#FFF8E7] border border-[#3F5E45] rounded-xl px-3.5 py-2.5 text-sm text-[#3F5E45] placeholder-[#3F5E45]/50 focus:outline-none focus:border-[#6F8F72]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#3F5E45] mb-1.5">
                          Soyad
                        </label>
                        <input
                          type="text"
                          autoComplete="family-name"
                          value={lastName}
                          onChange={e => { setLastName(e.target.value); if (authError) setAuthError(null); }}
                          placeholder="Soyadınız"
                          maxLength={50}
                          className="w-full bg-[#FFF8E7] border border-[#3F5E45] rounded-xl px-3.5 py-2.5 text-sm text-[#3F5E45] placeholder-[#3F5E45]/50 focus:outline-none focus:border-[#6F8F72]"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-[#3F5E45] mb-1.5">
                      E-posta Adresi
                    </label>
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); if (authError) setAuthError(null); }}
                      placeholder="ornek@eposta.com"
                      maxLength={100}
                      className="w-full bg-[#FFF8E7] border border-[#3F5E45] rounded-xl px-3.5 py-2.5 text-sm text-[#3F5E45] placeholder-[#3F5E45]/50 focus:outline-none focus:border-[#6F8F72]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-[#3F5E45]">
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
                          className="text-xs font-semibold text-[#3F5E45] hover:underline cursor-pointer"
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
                        className="w-full bg-[#FFF8E7] border border-[#3F5E45] rounded-xl px-3.5 py-2.5 pr-10 text-sm text-[#3F5E45] placeholder-[#3F5E45]/50 focus:outline-none focus:border-[#6F8F72]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3F5E45] hover:text-[#6F8F72] cursor-pointer"
                        aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    {isCapsLockOn && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-800 font-medium">
                        <AlertCircle size={13} className="shrink-0" />
                        <span>Büyük harf kilidi (Caps Lock) açık</span>
                      </div>
                    )}

                    {!isLogin && password.length > 0 && (
                      <div className="mt-2.5 p-3 bg-[#FFF8E7] rounded-xl border border-[#3F5E45] space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#3F5E45]/80">Şifre Güvenliği:</span>
                          <span className="font-bold text-[#3F5E45]">
                            {passwordScore === 4 ? 'Güçlü' : passwordScore >= 2 ? 'Orta' : 'Zayıf'}
                          </span>
                        </div>
                        <div className="flex gap-1.5 h-1.5">
                          {[1, 2, 3, 4].map(step => (
                            <div
                              key={step}
                              className={`flex-1 rounded-full ${
                                passwordScore >= step ? 'bg-[#6F8F72]' : 'bg-[#E8DCC4]'
                              }`}
                            />
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-1">
                          <span className={`flex items-center gap-1 ${password.length >= 8 ? 'text-[#3F5E45] font-semibold' : 'text-[#3F5E45]/60'}`}>
                            {password.length >= 8 ? <Check size={12} className="shrink-0" /> : <Circle size={8} className="shrink-0" />} En az 8 karakter
                          </span>
                          <span className={`flex items-center gap-1 ${/[A-Z]/.test(password) ? 'text-[#3F5E45] font-semibold' : 'text-[#3F5E45]/60'}`}>
                            {/[A-Z]/.test(password) ? <Check size={12} className="shrink-0" /> : <Circle size={8} className="shrink-0" />} En az 1 büyük harf
                          </span>
                          <span className={`flex items-center gap-1 ${/[a-z]/.test(password) ? 'text-[#3F5E45] font-semibold' : 'text-[#3F5E45]/60'}`}>
                            {/[a-z]/.test(password) ? <Check size={12} className="shrink-0" /> : <Circle size={8} className="shrink-0" />} En az 1 küçük harf
                          </span>
                          <span className={`flex items-center gap-1 ${/\d/.test(password) ? 'text-[#3F5E45] font-semibold' : 'text-[#3F5E45]/60'}`}>
                            {/\d/.test(password) ? <Check size={12} className="shrink-0" /> : <Circle size={8} className="shrink-0" />} En az 1 rakam
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {!isLogin && (
                    <div>
                      <label className="block text-xs font-semibold text-[#3F5E45] mb-1.5">
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
                          className="w-full bg-[#FFF8E7] border border-[#3F5E45] rounded-xl px-3.5 py-2.5 pr-10 text-sm text-[#3F5E45] placeholder-[#3F5E45]/50 focus:outline-none focus:border-[#6F8F72]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3F5E45] hover:text-[#6F8F72] cursor-pointer"
                          aria-label={showConfirmPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      {confirmPassword.length > 0 && password !== confirmPassword && (
                        <p className="text-[11px] text-rose-700 font-medium mt-1">
                          Şifreler birbiriyle eşleşmiyor.
                        </p>
                      )}
                    </div>
                  )}

                  {isLogin && (
                    <div className="flex items-center justify-between pt-0.5">
                      <label className="inline-flex items-center gap-2 text-xs text-[#3F5E45] cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={e => setRememberMe(e.target.checked)}
                          className="accent-[#6F8F72] rounded cursor-pointer"
                        />
                        <span>E-posta adresimi bu cihazda hatırla</span>
                      </label>
                    </div>
                  )}

                  <div className="bg-[#FFF8E7] border border-[#3F5E45] rounded-xl p-3 flex flex-col items-center justify-center">
                    <div ref={turnstileContainerRef} />
                    <div className="flex items-center gap-1.5 text-[11px] text-[#3F5E45]/80 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#6F8F72]" />
                      <span>Cloudflare Turnstile ile korunuyor</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isAuthLoading}
                    className="w-full bg-[#6F8F72] hover:bg-[#3F5E45] text-[#FFF8E7] font-semibold py-2.5 rounded-xl text-sm border border-[#3F5E45] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
