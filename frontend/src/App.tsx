import React, { useState } from 'react';
import { scanMerchants, loginUser, registerUser, saveLead, forgotPassword, resetPassword } from './api';
import MapRadar from './components/MapRadar';
import { SavedLeadsCRM } from './components/SavedLeadsCRM';
import { UserProfileView } from './components/UserProfileView';
import { Radar, Search, User, Compass, Users, Eye, EyeOff, KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  
  // Auth state
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  // Forgot password state
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'verify'>('request');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Cooldown geri sayımı
  React.useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const turnstileContainerRef = React.useRef<HTMLDivElement>(null);
  const turnstileWidgetId = React.useRef<string | null>(null);

  // Turnstile widget loader
  React.useEffect(() => {
    if (!token) {
      let currentWidget: string | null = null;
      const renderWidget = () => {
        if ((window as any).turnstile && turnstileContainerRef.current) {
          try {
            turnstileContainerRef.current.innerHTML = '';
            currentWidget = (window as any).turnstile.render(turnstileContainerRef.current, {
              sitekey: '1x00000000000000000000AA', // Cloudflare Turnstile Always-Pass test key
              theme: 'dark',
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
        if (currentWidget && (window as any).turnstile) {
          try { (window as any).turnstile.remove(currentWidget); } catch (_) {}
        }
      };
    }
  }, [token, isLogin, isForgotPassword, forgotStep]);

  // Password strength calculation
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

  // Radar state
  const [isScanning, setIsScanning] = useState(false);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [center, setCenter] = useState<[number, number]>([40.990, 29.025]); // Kadıköy
  const [radius, setRadius] = useState(500);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterOnlyNoWebsite, setFilterOnlyNoWebsite] = useState<boolean>(false);

  // Tab & CRM state
  const [activeTab, setActiveTab] = useState<'radar' | 'crm' | 'profile'>('radar');
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [saveLeadSuccess, setSaveLeadSuccess] = useState(false);
  const [savedLeadCount, setSavedLeadCount] = useState(0);

  // Audit state
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<any | null>(null);

  const handleAudit = async (merchant: any) => {
    if (!token) return;
    setIsAuditing(true);
    setAuditResult(null);
    setSaveLeadSuccess(false);
    try {
      const { auditMerchant } = await import('./api');
      const result = await auditMerchant(merchant.osm_id, merchant.name, merchant.website || null, token);
      setAuditResult({ ...result, merchantName: merchant.name, merchant });
    } catch (err: any) {
      alert(err.message || "Röntgen çekilirken hata oluştu!");
    } finally {
      setIsAuditing(false);
    }
  };

  const handleSaveLead = async () => {
    if (!token || !auditResult || !auditResult.merchant) return;
    setIsSavingLead(true);
    try {
      await saveLead({
        osm_id: auditResult.merchant.osm_id,
        name: auditResult.merchant.name,
        latitude: auditResult.merchant.latitude,
        longitude: auditResult.merchant.longitude,
        category: auditResult.merchant.category,
        phone: auditResult.merchant.phone,
        email: auditResult.merchant.email,
        website: auditResult.merchant.website,
        address: auditResult.merchant.address,
        opportunity_score: auditResult.score,
        audit_data: auditResult
      }, token);
      setSaveLeadSuccess(true);
      setSavedLeadCount(prev => prev + 1);
      setTimeout(() => setSaveLeadSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || "Lead kaydedilemedi!");
    } finally {
      setIsSavingLead(false);
    }
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCenter([position.coords.latitude, position.coords.longitude]);
        },
        () => {
          alert("Konum alınamadı. Lütfen tarayıcı izinlerini kontrol edin.");
        }
      );
    } else {
      alert("Tarayıcınız konum özelliğini desteklemiyor.");
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (isLogin) {
      if (!email.trim() || !password.trim()) {
        setAuthError("Lütfen bütün bilgileri eksiksiz giriniz.");
        return;
      }
    } else {
      if (!email.trim() || !firstName.trim() || !lastName.trim() || !password.trim()) {
        setAuthError("Lütfen bütün bilgileri eksiksiz giriniz.");
        return;
      }
      if (passwordScore < 4) {
        setAuthError("Lütfen tüm şifre güvenlik kurallarını sağlayınız.");
        return;
      }
    }

    try {
      if (isLogin) {
        const data = await loginUser(email, password, turnstileToken || undefined);
        setToken(data.access_token);
        localStorage.setItem('token', data.access_token);
        setPassword('');
      } else {
        await registerUser(email, password, firstName.trim(), lastName.trim(), turnstileToken || undefined);
        const data = await loginUser(email, password, turnstileToken || undefined);
        setToken(data.access_token);
        localStorage.setItem('token', data.access_token);
        setPassword('');
      }
    } catch (err: any) {
      if (err.message === 'Incorrect email or password' || err.message === 'Giriş başarısız') {
        setAuthError("E-posta veya şifre hatalı.");
      } else {
        setAuthError(err.message || "İşlem sırasında bir hata oluştu.");
      }
    }
  };

  const handleForgotPasswordRequest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (cooldown > 0) return;
    setAuthError(null);
    setAuthSuccess(null);
    if (!email.trim()) {
      setAuthError("Lütfen e-posta adresinizi giriniz.");
      return;
    }
    setIsForgotLoading(true);
    try {
      const data = await forgotPassword(email.trim(), turnstileToken || undefined);
      setForgotStep('verify');
      setAuthSuccess(data.message || "Doğrulama kodu e-posta adresinize gönderildi.");
      setCooldown(data.cooldown_seconds || 60);
      if (data.dev_code) {
        setResetCode(data.dev_code);
      }
    } catch (err: any) {
      setAuthError(err.message || "İşlem sırasında bir hata oluştu.");
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    if (!resetCode.trim()) {
      setAuthError("Lütfen 6 haneli doğrulama kodunu giriniz.");
      return;
    }
    if (!newPassword.trim()) {
      setAuthError("Lütfen yeni şifrenizi giriniz.");
      return;
    }
    if (newPasswordScore < 4) {
      setAuthError("Lütfen tüm şifre güvenlik kurallarını sağlayınız.");
      return;
    }
    setIsForgotLoading(true);
    try {
      const data = await resetPassword(email.trim(), resetCode.trim(), newPassword);
      setAuthSuccess(data.message || "Şifreniz başarıyla güncellendi!");
      setTimeout(() => {
        setIsForgotPassword(false);
        setForgotStep('request');
        setResetCode('');
        setNewPassword('');
        setIsLogin(true);
        setPassword('');
        setAuthSuccess("Şifreniz başarıyla güncellendi! Yeni şifrenizle giriş yapabilirsiniz.");
      }, 1500);
    } catch (err: any) {
      setAuthError(err.message || "Şifre güncellenemedi.");
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
    setMerchants([]);
    setAuditResult(null);
    setActiveTab('radar');
    setAuthError(null);
    setPassword('');
  };

  const handleScan = async () => {
    if (!token) return;
    setIsScanning(true);
    setMerchants([]);
    try {
      const results = await scanMerchants(center[0], center[1], radius, token, selectedCategory);
      setMerchants(results);
    } catch (err: any) {
      alert(err.message || "Tarama sırasında hata oluştu!");
    } finally {
      setIsScanning(false);
    }
  };

  const filteredMerchants = merchants.filter(m => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      m.name.toLowerCase().includes(q) ||
      (m.category_label && m.category_label.toLowerCase().includes(q)) ||
      (m.category && m.category.toLowerCase().includes(q));
    const matchesNoWeb = !filterOnlyNoWebsite || !m.website;
    return matchesSearch && matchesNoWeb;
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Yeşil Balon Efekti (Arka Plan Yuvarlakları) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-12 left-[15%] w-24 h-24 rounded-full bg-emerald-500/15 border border-emerald-500/30 shadow-lg shadow-emerald-500/10" />
          <div className="absolute top-1/4 right-[12%] w-32 h-32 rounded-full bg-emerald-500/10 border border-emerald-400/20 shadow-lg shadow-emerald-500/5" />
          <div className="absolute bottom-20 left-[10%] w-36 h-36 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-lg shadow-emerald-500/5" />
          <div className="absolute bottom-1/4 right-[18%] w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-400/30 shadow-lg shadow-emerald-500/10" />
          <div className="absolute top-20 right-[28%] w-14 h-14 rounded-full bg-emerald-400/20 border border-emerald-300/30 shadow-md shadow-emerald-400/10" />
          <div className="absolute bottom-14 left-[30%] w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 shadow-md shadow-emerald-500/10" />
          <div className="absolute top-1/2 left-[6%] w-12 h-12 rounded-full bg-emerald-400/15 border border-emerald-400/25" />
          <div className="absolute top-1/3 left-[28%] w-8 h-8 rounded-full bg-emerald-300/20 border border-emerald-300/40" />
          <div className="absolute bottom-1/3 right-[8%] w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20" />
        </div>

        {/* Giriş & Şifre Sıfırlama Kartı */}
        <div className="relative z-10 w-full max-w-md bg-slate-800/90 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-slate-700/80">
          {isForgotPassword ? (
            /* ŞİFRE SIFIRLAMA GÖRÜNÜMÜ */
            <div>
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400">
                  <KeyRound size={32} />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-center mb-1">
                Şifremi Unuttum
              </h1>
              <p className="text-xs text-slate-400 text-center mb-6">
                {forgotStep === 'request'
                  ? "Kayıtlı e-posta adresinize 6 haneli doğrulama kodu göndereceğiz."
                  : "E-postanıza gelen kodu ve yeni şifrenizi giriniz."}
              </p>

              {authSuccess && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span>{authSuccess}</span>
                </div>
              )}

              {authError && (
                <p className="text-sm font-normal text-rose-400 text-center mb-4">
                  {authError}
                </p>
              )}

              {forgotStep === 'request' ? (
                /* ADIM 1: E-posta ile Kod Talep Etme */
                <form onSubmit={handleForgotPasswordRequest} className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">E-posta Adresi</label>
                    <input 
                      type="email" 
                      value={email} 
                      onChange={e => { setEmail(e.target.value); if (authError) setAuthError(null); }} 
                      placeholder="kayitli@eposta.com"
                      maxLength={100}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500" 
                    />
                  </div>

                  {/* Cloudflare Turnstile Bot Koruması */}
                  <div className="flex flex-col items-center justify-center py-1">
                    <div ref={turnstileContainerRef} />
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Cloudflare Turnstile ile korunuyor</span>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isForgotLoading || cooldown > 0}
                    className="w-full bg-emerald-500 text-white font-medium py-2 rounded-lg hover:bg-emerald-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isForgotLoading ? 'Kod Gönderiliyor...' : cooldown > 0 ? `Yeni Kod İçin Bekleyin (${cooldown}s)` : 'Doğrulama Kodu Gönder'}
                  </button>
                </form>
              ) : (
                /* ADIM 2: Kod Doğrulama ve Yeni Şifre Belirleme */
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">6 Haneli Doğrulama Kodu</label>
                    <input 
                      type="text" 
                      value={resetCode} 
                      onChange={e => { setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6)); if (authError) setAuthError(null); }} 
                      placeholder="123456"
                      maxLength={6}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-center text-xl tracking-[0.35em] font-mono text-emerald-400 placeholder-slate-600 focus:outline-none focus:border-emerald-500" 
                    />
                    <p className="text-[11px] text-slate-400 mt-1 text-center">Kod 15 dakika boyunca geçerlidir.</p>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Yeni Şifre</label>
                    <div className="relative">
                      <input 
                        type={showNewPassword ? "text" : "password"} 
                        value={newPassword} 
                        onChange={e => { setNewPassword(e.target.value); if (authError) setAuthError(null); }} 
                        placeholder="Yeni şifrenizi giriniz."
                        maxLength={64}
                        required
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 pr-10 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500" 
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
                        aria-label={showNewPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                      >
                        {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    {/* Yeni Şifre Güç Göstergesi */}
                    {newPassword.length > 0 && (
                      <div className="mt-2.5 p-3 bg-slate-900/90 rounded-xl border border-slate-700/70 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Şifre Güvenliği:</span>
                          <span className={`font-semibold ${
                            newPasswordScore === 4 ? 'text-emerald-400' : newPasswordScore >= 2 ? 'text-amber-400' : 'text-rose-400'
                          }`}>
                            {newPasswordScore === 4 ? 'Güçlü' : newPasswordScore >= 2 ? 'Orta' : 'Zayıf'}
                          </span>
                        </div>
                        {/* Güç Barları */}
                        <div className="flex gap-1.5 h-1.5">
                          <div className={`flex-1 rounded-full transition-all duration-300 ${
                            newPasswordScore >= 1 ? (newPasswordScore === 1 ? 'bg-rose-500' : newPasswordScore < 4 ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-slate-700'
                          }`} />
                          <div className={`flex-1 rounded-full transition-all duration-300 ${
                            newPasswordScore >= 2 ? (newPasswordScore < 4 ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-slate-700'
                          }`} />
                          <div className={`flex-1 rounded-full transition-all duration-300 ${
                            newPasswordScore >= 3 ? (newPasswordScore < 4 ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-slate-700'
                          }`} />
                          <div className={`flex-1 rounded-full transition-all duration-300 ${
                            newPasswordScore === 4 ? 'bg-emerald-500' : 'bg-slate-700'
                          }`} />
                        </div>
                        {/* Kurallar Listesi */}
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-1">
                          <span className={`flex items-center gap-1 ${newPassword.length >= 8 ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                            {newPassword.length >= 8 ? '✓' : '•'} En az 8 karakter
                          </span>
                          <span className={`flex items-center gap-1 ${/[A-Z]/.test(newPassword) ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                            {/[A-Z]/.test(newPassword) ? '✓' : '•'} En az 1 büyük harf
                          </span>
                          <span className={`flex items-center gap-1 ${/[a-z]/.test(newPassword) ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                            {/[a-z]/.test(newPassword) ? '✓' : '•'} En az 1 küçük harf
                          </span>
                          <span className={`flex items-center gap-1 ${/\d/.test(newPassword) ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                            {/\d/.test(newPassword) ? '✓' : '•'} En az 1 rakam
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <button 
                    type="submit" 
                    disabled={isForgotLoading || newPasswordScore < 4}
                    className="w-full bg-emerald-500 text-white font-medium py-2 rounded-lg hover:bg-emerald-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isForgotLoading ? 'Şifre Güncelleniyor...' : 'Şifremi Sıfırla ve Kaydet'}
                  </button>

                  <div className="text-center pt-1">
                    {cooldown > 0 ? (
                      <p className="text-xs text-slate-400">
                        Yeni kod talep etmek için <span className="text-emerald-400 font-mono font-medium">{cooldown}s</span> bekleyiniz
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleForgotPasswordRequest()}
                        className="text-xs text-slate-400 hover:text-emerald-400 cursor-pointer"
                      >
                        Kodu tekrar gönder
                      </button>
                    )}
                  </div>
                </form>
              )}

              {/* Giriş Ekranına Dön */}
              <div className="pt-4 mt-6 border-t border-slate-700/60 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setForgotStep('request');
                    setAuthError(null);
                    setAuthSuccess(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  <ArrowLeft size={16} />
                  <span>Giriş Ekranına Dön</span>
                </button>
              </div>
            </div>
          ) : (
            /* NORMAL GİRİŞ & KAYIT GÖRÜNÜMÜ */
            <div>
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400">
                  <Radar size={32} />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-center mb-2">
                {isLogin ? "EsnafRadar'a Giriş Yap" : "EsnafRadar'a Kayıt Ol"}
              </h1>

              {authSuccess && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span>{authSuccess}</span>
                </div>
              )}

              {authError ? (
                <p className="text-sm font-normal text-rose-400 text-center mb-6">
                  {authError}
                </p>
              ) : !authSuccess && (
                <div className="mb-6" />
              )}
              
              <form onSubmit={handleAuth} className="space-y-4">
                {!isLogin && (
                  <>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Ad</label>
                      <input 
                        type="text" 
                        value={firstName} 
                        onChange={e => { setFirstName(e.target.value); if (authError) setAuthError(null); }} 
                        placeholder="Lütfen adınızı giriniz."
                        maxLength={50}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Soyad</label>
                      <input 
                        type="text" 
                        value={lastName} 
                        onChange={e => { setLastName(e.target.value); if (authError) setAuthError(null); }} 
                        placeholder="Lütfen soyadınızı giriniz."
                        maxLength={50}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500" 
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm text-slate-400 mb-1">E-posta</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={e => { setEmail(e.target.value); if (authError) setAuthError(null); }} 
                    placeholder="Lütfen e-posta adresinizi giriniz."
                    maxLength={100}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500" 
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm text-slate-400">Şifre</label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(true);
                          setForgotStep('request');
                          setAuthError(null);
                          setAuthSuccess(null);
                        }}
                        className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer"
                      >
                        Şifremi unuttum?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      value={password} 
                      onChange={e => { setPassword(e.target.value); if (authError) setAuthError(null); }} 
                      placeholder="Lütfen şifrenizi giriniz."
                      maxLength={64}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 pr-10 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500" 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
                      aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {/* Şifre Güç Göstergesi (Sadece Kayıt Olurken) */}
                  {!isLogin && password.length > 0 && (
                    <div className="mt-2.5 p-3 bg-slate-900/90 rounded-xl border border-slate-700/70 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Şifre Güvenliği:</span>
                        <span className={`font-semibold ${
                          passwordScore === 4 ? 'text-emerald-400' : passwordScore >= 2 ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                          {passwordScore === 4 ? 'Güçlü' : passwordScore >= 2 ? 'Orta' : 'Zayıf'}
                        </span>
                      </div>
                      {/* Güç Barları */}
                      <div className="flex gap-1.5 h-1.5">
                        <div className={`flex-1 rounded-full transition-all duration-300 ${
                          passwordScore >= 1 ? (passwordScore === 1 ? 'bg-rose-500' : passwordScore < 4 ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-slate-700'
                        }`} />
                        <div className={`flex-1 rounded-full transition-all duration-300 ${
                          passwordScore >= 2 ? (passwordScore < 4 ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-slate-700'
                        }`} />
                        <div className={`flex-1 rounded-full transition-all duration-300 ${
                          passwordScore >= 3 ? (passwordScore < 4 ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-slate-700'
                        }`} />
                        <div className={`flex-1 rounded-full transition-all duration-300 ${
                          passwordScore === 4 ? 'bg-emerald-500' : 'bg-slate-700'
                        }`} />
                      </div>
                      {/* Kurallar Listesi */}
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-1">
                        <span className={`flex items-center gap-1 ${password.length >= 8 ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                          {password.length >= 8 ? '✓' : '•'} En az 8 karakter
                        </span>
                        <span className={`flex items-center gap-1 ${/[A-Z]/.test(password) ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                          {/[A-Z]/.test(password) ? '✓' : '•'} En az 1 büyük harf
                        </span>
                        <span className={`flex items-center gap-1 ${/[a-z]/.test(password) ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                          {/[a-z]/.test(password) ? '✓' : '•'} En az 1 küçük harf
                        </span>
                        <span className={`flex items-center gap-1 ${/\d/.test(password) ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                          {/\d/.test(password) ? '✓' : '•'} En az 1 rakam
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Cloudflare Turnstile Bot Koruması (Hem Giriş Hem Kayıt) */}
                <div className="flex flex-col items-center justify-center py-1">
                  <div ref={turnstileContainerRef} />
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Cloudflare Turnstile ile korunuyor</span>
                  </div>
                </div>

                <button type="submit" className="w-full bg-emerald-500 text-white font-medium py-2 rounded-lg hover:bg-emerald-600 transition-colors cursor-pointer">
                  {isLogin ? 'Giriş Yap' : 'Kayıt Ol'}
                </button>
              </form>
              
              <p className="text-center mt-4 text-sm text-slate-400">
                {isLogin ? "Hesabın yok mu?" : "Zaten hesabın var mı?"}{" "}
                <button onClick={() => { setIsLogin(!isLogin); setAuthError(null); setAuthSuccess(null); setFirstName(''); setLastName(''); }} className="text-emerald-400 hover:underline cursor-pointer">
                  {isLogin ? 'Kayıt Ol' : 'Giriş Yap'}
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 relative">
      {/* Röntgen Modal */}
      {isAuditing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center">
          <div className="bg-slate-800 p-8 rounded-2xl border border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.2)] animate-pulse flex flex-col items-center">
            <Radar size={48} className="text-emerald-500 animate-spin mb-4" />
            <h2 className="text-xl font-bold text-white">Dijital Röntgen Çekiliyor...</h2>
            <p className="text-slate-400 mt-2">Web sitesi analiz ediliyor, SEO ve mobil uyumluluk test ediliyor.</p>
          </div>
        </div>
      )}

      {auditResult && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-slate-800 w-full max-w-2xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
            <div className="bg-slate-900 p-4 border-b border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-emerald-400">📊 {auditResult.merchantName} - Röntgen Sonucu</h2>
              <button onClick={() => setAuditResult(null)} className="text-slate-400 hover:text-white font-bold text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex gap-4">
                <div className="flex-1 bg-slate-900 p-4 rounded-xl border border-slate-700 text-center">
                  <p className="text-sm text-slate-400">Fırsat Puanı</p>
                  <p className="text-4xl font-black text-emerald-500">{auditResult.score}/100</p>
                </div>
                <div className="flex-1 space-y-2">
                  <div className={`p-2 rounded flex justify-between ${auditResult.has_website ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    <span>Web Sitesi:</span> <span>{auditResult.has_website ? 'VAR' : 'YOK'}</span>
                  </div>
                  <div className={`p-2 rounded flex justify-between ${auditResult.ssl_valid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    <span>SSL (Güvenlik):</span> <span>{auditResult.ssl_valid ? 'GEÇERLİ' : 'YOK'}</span>
                  </div>
                  <div className={`p-2 rounded flex justify-between ${auditResult.mobile_ready ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    <span>Mobil Uyumlu:</span> <span>{auditResult.mobile_ready ? 'EVET' : 'HAYIR'}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-bold text-lg mb-2">Yapay Zeka Yorumu</h3>
                <p className="text-slate-300 text-sm leading-relaxed bg-slate-900 p-4 rounded-xl border border-slate-700">
                  {auditResult.ai_summary}
                </p>
              </div>

              <div>
                <h3 className="font-bold text-lg mb-2">Neler Satabiliriz? (Fırsatlar)</h3>
                <div className="flex flex-wrap gap-2">
                  {auditResult.opportunities.map((opp: string, i: number) => (
                    <span key={i} className="bg-emerald-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      + {opp}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-700 bg-slate-900/50 flex justify-end gap-2">
              <button className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-600 transition-colors" onClick={() => setAuditResult(null)}>
                Kapat
              </button>
              <button 
                onClick={handleSaveLead}
                disabled={isSavingLead || saveLeadSuccess}
                className={`px-4 py-2 rounded-lg transition-colors font-medium flex items-center gap-2 ${
                  saveLeadSuccess 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50'
                }`}
              >
                {isSavingLead ? 'Kaydediliyor...' : saveLeadSuccess ? '✓ Listenize Kaydedildi' : 'Listeme Kaydet (CRM)'}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-emerald-400">
              <Radar size={24} />
              <span className="text-xl font-bold">EsnafRadar</span>
            </div>

            {/* Navigasyon Sekmeleri */}
            <nav className="flex items-center gap-2 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => setActiveTab('radar')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'radar'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Compass size={16} />
                <span>Harita Radarı</span>
              </button>
              <button
                onClick={() => setActiveTab('crm')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'crm'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users size={16} />
                <span>Kayıtlı Müşterilerim (CRM)</span>
                {savedLeadCount > 0 && (
                  <span className="bg-emerald-950 text-emerald-300 text-xs px-2 py-0.5 rounded-full font-bold border border-emerald-500/40">
                    {savedLeadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'profile'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <User size={16} />
                <span>Profilim</span>
              </button>
            </nav>
          </div>

          <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer">
            <span className="text-sm">Çıkış Yap</span>
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {activeTab === 'profile' ? (
          <UserProfileView token={token} />
        ) : activeTab === 'crm' ? (
          <SavedLeadsCRM token={token} onLeadCountChange={setSavedLeadCount} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sol Panel: Kontroller */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Compass size={18} className="text-emerald-400" />
                  Radar Kontrolü
                </h2>
                <button 
                  onClick={handleGetLocation} 
                  className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded-lg text-emerald-400 transition-colors cursor-pointer"
                >
                  📍 Konumumu Bul
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Sektör Seçici */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Hedef Sektör (Akıllı Filtre)</label>
                  <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="all">🏢 Tüm Sektörler (Geniş Tarama)</option>
                    <option value="food">🍽️ Yeme & İçme (Restoran, Kafe, Fırın)</option>
                    <option value="beauty">💇 Güzellik & Bakım (Kuaför, Berber, Spa)</option>
                    <option value="auto">🚗 Oto & Sanayi (Tamir, Yıkama, Lastik)</option>
                    <option value="retail">🛒 Perakende & Market (Butik, Bakkal)</option>
                    <option value="health">💊 Sağlık & Medikal (Eczane, Diş, Klinik)</option>
                    <option value="services">💼 Hizmet & Ofis (Emlak, Avukat, Terzi)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Enlem (Lat)</label>
                    <input type="number" step="0.0001" value={center[0]} onChange={e => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) setCenter([val, center[1]]);
                      }} 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Boylam (Lon)</label>
                    <input type="number" step="0.0001" value={center[1]} onChange={e => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) setCenter([center[0], val]);
                      }} 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Tarama Yarıçapı</span>
                    <span className="text-emerald-400 font-bold">{radius} metre</span>
                  </div>
                  <input type="range" min="100" max="2500" step="100" value={radius} onChange={e => setRadius(parseInt(e.target.value))} 
                         className="w-full accent-emerald-500 cursor-pointer" />
                </div>
                
                <button 
                  onClick={handleScan}
                  disabled={isScanning || isAuditing}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  {isScanning ? (
                    <span className="animate-pulse">Derin Tarama Yapılıyor...</span>
                  ) : (
                    <>
                      <Search size={16} />
                      Radarı Başlat & Tara
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Bulunan Esnaflar Listesi (Gelişmiş Filtreli & Zengin) */}
            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">
                  Bulunan İşletmeler ({filteredMerchants.length}{filteredMerchants.length !== merchants.length ? ` / ${merchants.length}` : ''})
                </h2>
              </div>

              {/* Anlık Arama ve Filtre */}
              {merchants.length > 0 && (
                <div className="space-y-2 pt-1">
                  <input
                    type="text"
                    placeholder="Sonuçlarda ara..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={filterOnlyNoWebsite}
                      onChange={e => setFilterOnlyNoWebsite(e.target.checked)}
                      className="accent-emerald-500 rounded cursor-pointer"
                    />
                    <span>🚨 Sadece Web Sitesi Olmayanlar</span>
                  </label>
                </div>
              )}

              <div className="h-[280px] overflow-y-auto space-y-2.5 pr-1">
                {merchants.length === 0 ? (
                  <p className="text-slate-500 text-xs text-center mt-12 leading-relaxed">
                    Haritada konumu seçin veya hedef pini sürükleyin, ardından "Radarı Başlat" butonuna basın.
                  </p>
                ) : filteredMerchants.length === 0 ? (
                  <p className="text-slate-500 text-xs text-center mt-12">
                    Arama kriterine uygun işletme bulunamadı.
                  </p>
                ) : (
                  filteredMerchants.map(m => (
                    <div 
                      key={m.osm_id} 
                      className="p-3 bg-slate-900/90 rounded-xl border border-slate-700/80 hover:border-emerald-500/60 transition-all cursor-pointer shadow-sm group"
                      onClick={() => handleAudit(m)}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm shrink-0">{m.category_icon || '🏢'}</span>
                          <h3 className="font-semibold text-xs truncate text-white group-hover:text-emerald-400 transition-colors">
                            {m.name}
                          </h3>
                        </div>
                        {m.lead_potential_score && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                            %{m.lead_potential_score}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {m.category_label || m.category}
                      </p>

                      {/* Mini rozetler */}
                      <div className="flex items-center justify-between text-[10px] mt-2 pt-1.5 border-t border-slate-800/80">
                        <span className={m.phone ? "text-emerald-400 font-medium" : "text-slate-500"}>
                          {m.phone ? "📞 Telefon Var" : "📞 Tel Yok"}
                        </span>
                        <span className={m.website ? "text-blue-400" : "text-rose-400 font-medium"}>
                          {m.website ? "🌐 Web Var" : "🌐 Web Yok"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sağ Panel: Harita */}
          <div className="lg:col-span-3">
            <MapRadar 
              center={center} 
              radius={radius} 
              merchants={filteredMerchants} 
              isScanning={isScanning} 
              onAudit={handleAudit}
              onCenterChange={setCenter}
            />
          </div>
        </div>
        )}
      </main>
    </div>
  );
}

export default App;
