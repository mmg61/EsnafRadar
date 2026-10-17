import React, { useState } from 'react';
import { scanMerchants, auditMerchant, getScanHistory, deleteScanHistoryItem, loginUser, registerUser, getUserProfile, saveLead, forgotPassword, resetPassword } from './api';
import MapRadar from './components/MapRadar';
import { SavedLeadsCRM } from './components/SavedLeadsCRM';
import { UserProfileView } from './components/UserProfileView';
import { AuditModal } from './components/AuditModal';
import { Radar, Search, User, Compass, Users, Eye, EyeOff, ArrowLeft, CheckCircle2, Check, Circle, AlertCircle, ClipboardPaste, MapPin, Globe, Layers, History, Trash2 } from 'lucide-react';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  
  // Auth state
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
  const [authError, setAuthError] = useState<string | null>(null);
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

  // Cooldown geri sayımı
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
    if (turnstileWidgetId.current && (window as any).turnstile) {
      try {
        (window as any).turnstile.reset(turnstileWidgetId.current);
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
  const [filterOnlyWithPhone, setFilterOnlyWithPhone] = useState<boolean>(false);
  const [scanHistory, setScanHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // Toast bildirim state
  const [appToast, setAppToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showAppToast = (type: 'success' | 'error', message: string) => {
    setAppToast({ type, message });
    setTimeout(() => setAppToast(null), 3500);
  };

  // Tab & CRM state
  const [activeTab, setActiveTab] = useState<'radar' | 'crm' | 'profile'>('radar');
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [saveLeadSuccess, setSaveLeadSuccess] = useState(false);
  const [savedLeadCount, setSavedLeadCount] = useState(0);

  // Audit state
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<any | null>(null);

  const loadScanHistory = async (activeToken: string) => {
    try {
      const hist = await getScanHistory(activeToken);
      setScanHistory(hist);
    } catch (_) {}
  };

  // Açılışta oturum (JWT token) doğrulama ve kayıtlı müşteri sayısını yükleme
  React.useEffect(() => {
    if (!token) return;
    getUserProfile(token)
      .then((profile) => {
        if (typeof profile.saved_leads_count === 'number') {
          setSavedLeadCount(profile.saved_leads_count);
        }
        loadScanHistory(token);
      })
      .catch(() => {
        setToken(null);
        localStorage.removeItem('token');
        setMerchants([]);
        setAuditResult(null);
        setActiveTab('radar');
        setAuthError("Oturum süreniz sona erdi. Lütfen tekrar giriş yapınız.");
      });
  }, [token]);

  const handleAudit = async (merchant: any, forceRefresh: boolean = false) => {
    if (!token) return;
    setIsAuditing(true);
    setAuditResult(null);
    setSaveLeadSuccess(false);
    try {
      const result = await auditMerchant(
        merchant.osm_id,
        merchant.name,
        merchant.website || null,
        token,
        merchant.category_label || merchant.category || undefined,
        forceRefresh
      );
      setAuditResult({ ...result, merchantName: merchant.name, merchant });
    } catch (err: any) {
      showAppToast('error', err.message || "Röntgen çekilirken hata oluştu.");
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
        latitude: auditResult.merchant.latitude || center[0],
        longitude: auditResult.merchant.longitude || center[1],
        category: auditResult.merchant.category,
        phone: auditResult.merchant.phone,
        email: auditResult.merchant.email,
        website: auditResult.merchant.website,
        address: auditResult.merchant.address,
        opportunity_score: auditResult.score,
        audit_data: auditResult
      }, token);
      setSaveLeadSuccess(true);
      const profile = await getUserProfile(token).catch(() => null);
      if (profile && typeof profile.saved_leads_count === 'number') {
        setSavedLeadCount(profile.saved_leads_count);
      } else {
        setSavedLeadCount(prev => prev + 1);
      }
      showAppToast('success', `${auditResult.merchant.name} müşteri listenize kaydedildi.`);
      setTimeout(() => setSaveLeadSuccess(false), 3000);
    } catch (err: any) {
      showAppToast('error', err.message || "Müşteri kaydedilemedi.");
    } finally {
      setIsSavingLead(false);
    }
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCenter([
            parseFloat(position.coords.latitude.toFixed(6)),
            parseFloat(position.coords.longitude.toFixed(6))
          ]);
          showAppToast('success', 'Mevcut konumunuz haritaya uygulandı.');
        },
        () => {
          showAppToast('error', "Konum alınamadı. Lütfen tarayıcı izinlerini kontrol edin.");
        }
      );
    } else {
      showAppToast('error', "Tarayıcınız konum özelliğini desteklemiyor.");
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthLoading) return;
    setAuthError(null);
    setAuthSuccess(null);

    const emailNormalized = email.trim().toLowerCase();

    if (isLogin) {
      if (!emailNormalized || !password.trim()) {
        setAuthError("Lütfen bütün bilgileri eksiksiz giriniz.");
        return;
      }
    } else {
      if (!emailNormalized || !firstName.trim() || !lastName.trim() || !password.trim() || !confirmPassword.trim()) {
        setAuthError("Lütfen bütün bilgileri eksiksiz giriniz.");
        return;
      }
      if (passwordScore < 4) {
        setAuthError("Lütfen tüm şifre güvenlik kurallarını sağlayınız.");
        return;
      }
      if (password !== confirmPassword) {
        setAuthError("Girilen şifreler birbiriyle eşleşmiyor.");
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
        setToken(data.access_token);
        localStorage.setItem('token', data.access_token);
        setPassword('');
        setConfirmPassword('');
      } else {
        const regData = await registerUser(emailNormalized, password, firstName.trim(), lastName.trim(), turnstileToken || undefined);
        const accessToken = regData.access_token || (await loginUser(emailNormalized, password)).access_token;
        if (rememberMe) {
          localStorage.setItem('remember_email', emailNormalized);
        } else {
          localStorage.removeItem('remember_email');
        }
        setToken(accessToken);
        localStorage.setItem('token', accessToken);
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      resetTurnstile();
      if (err.message === 'Incorrect email or password' || err.message === 'Giriş başarısız') {
        setAuthError("E-posta veya şifre hatalı.");
      } else {
        setAuthError(err.message || "İşlem sırasında bir hata oluştu.");
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
      setAuthError("Lütfen e-posta adresinizi giriniz.");
      return;
    }
    setIsForgotLoading(true);
    try {
      const data = await forgotPassword(emailNormalized, turnstileToken || undefined);
      setForgotStep('verify');
      setAuthSuccess(data.message || "Doğrulama kodu e-posta adresinize gönderildi.");
      setCooldown(data.cooldown_seconds || 60);
      if (data.dev_code) {
        setResetCode(data.dev_code);
      }
    } catch (err: any) {
      resetTurnstile();
      setAuthError(err.message || "İşlem sırasında bir hata oluştu.");
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
      setAuthError("Lütfen 6 haneli doğrulama kodunu eksiksiz giriniz.");
      return;
    }
    if (!newPassword.trim() || !confirmNewPassword.trim()) {
      setAuthError("Lütfen yeni şifrenizi ve şifre tekrarını giriniz.");
      return;
    }
    if (newPasswordScore < 4) {
      setAuthError("Lütfen tüm şifre güvenlik kurallarını sağlayınız.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setAuthError("Yeni şifreler birbiriyle eşleşmiyor.");
      return;
    }
    setIsForgotLoading(true);
    try {
      const data = await resetPassword(email.trim().toLowerCase(), resetCode.trim(), newPassword);
      setAuthSuccess(data.message || "Şifreniz başarıyla güncellendi!");
      setTimeout(() => {
        setIsForgotPassword(false);
        setForgotStep('request');
        setResetCode('');
        setNewPassword('');
        setConfirmNewPassword('');
        setIsLogin(true);
        setPassword('');
        setConfirmPassword('');
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
    setAuthSuccess(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleScan = async (customCenter?: [number, number], customRadius?: number, customCat?: string) => {
    if (!token) return;
    const targetLat = customCenter ? customCenter[0] : center[0];
    const targetLon = customCenter ? customCenter[1] : center[1];
    const targetRadius = customRadius ?? radius;
    const targetCategory = customCat ?? selectedCategory;

    setIsScanning(true);
    setMerchants([]);
    try {
      const results = await scanMerchants(targetLat, targetLon, targetRadius, token, targetCategory);
      setMerchants(results);
      loadScanHistory(token);
      showAppToast('success', `${results.length} yerel işletme tespit edildi.`);
    } catch (err: any) {
      showAppToast('error', err.message || "Tarama sırasında hata oluştu.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleApplyHistoryItem = (item: any) => {
    const newCenter: [number, number] = [item.search_lat, item.search_lng];
    const newRadius = item.radius_meters || 500;
    const newCat = item.category_filter || 'all';
    setCenter(newCenter);
    setRadius(newRadius);
    setSelectedCategory(newCat);
    setShowHistory(false);
    handleScan(newCenter, newRadius, newCat);
  };

  const handleDeleteHistory = async (scanId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    try {
      await deleteScanHistoryItem(scanId, token);
      setScanHistory(prev => prev.filter(s => s.id !== scanId));
    } catch (_) {}
  };

  const filteredMerchants = merchants.filter(m => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      m.name.toLowerCase().includes(q) ||
      (m.category_label && m.category_label.toLowerCase().includes(q)) ||
      (m.category && m.category.toLowerCase().includes(q));
    const matchesNoWeb = !filterOnlyNoWebsite || !m.website;
    const matchesPhone = !filterOnlyWithPhone || Boolean(m.phone);
    return matchesSearch && matchesNoWeb && matchesPhone;
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-50 flex flex-col lg:flex-row font-sans relative overflow-hidden selection:bg-emerald-500/30 selection:text-emerald-200">
        {/* SOL PANEL: Yumuşak Hatlı Kimlik Doğrulama Form Alanı */}
        <div className="relative z-10 flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-16 overflow-hidden">
          {/* Yumuşak Arka Plan Yeşil Daireleri (Sadece Sol Tarafta) */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-12 left-[10%] w-28 h-28 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-lg shadow-emerald-500/5" />
            <div className="absolute top-1/4 right-[12%] w-32 h-32 rounded-full bg-emerald-500/10 border border-emerald-400/15 shadow-lg shadow-emerald-500/5" />
            <div className="absolute bottom-16 left-[12%] w-36 h-36 rounded-full bg-emerald-500/10 border border-emerald-500/15 shadow-lg shadow-emerald-500/5" />
            <div className="absolute bottom-20 right-[14%] w-24 h-24 rounded-full bg-emerald-500/10 border border-emerald-400/20 shadow-lg shadow-emerald-500/5" />
            <div className="absolute top-16 right-[28%] w-14 h-14 rounded-full bg-emerald-400/15 border border-emerald-300/20" />
            <div className="absolute bottom-12 left-[36%] w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20" />
          </div>

          <div className="relative z-10 w-full max-w-md bg-slate-800/85 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden">
            <div className="p-6 sm:p-8">
              {/* Kart Üstü EsnafRadar Logo ve Başlığı */}
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                  <Radar size={24} />
                </div>
                <span className="text-xl font-bold tracking-tight text-slate-50 leading-none">
                  EsnafRadar
                </span>
              </div>

              {isForgotPassword ? (
                /* ŞİFRE SIFIRLAMA GÖRÜNÜMÜ */
                <div>
                  <div className="mb-6">
                    <h1 className="text-xl font-bold text-slate-50 tracking-tight">
                      Şifremi Unuttum
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {forgotStep === 'request'
                        ? 'Kayıtlı e-posta adresinize 6 haneli tek kullanımlık doğrulama kodu göndereceğiz.'
                        : 'E-posta adresinize iletilen 6 haneli doğrulama kodunu ve yeni şifrenizi giriniz.'}
                    </p>
                  </div>

                  {authSuccess && (
                    <div className="flex items-start gap-2.5 p-3.5 mb-5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                      <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />
                      <span>{authSuccess}</span>
                    </div>
                  )}

                  {authError && (
                    <div className="flex items-start gap-2.5 p-3.5 mb-5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                      <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                      <span>{authError}</span>
                    </div>
                  )}

                  {forgotStep === 'request' ? (
                    /* ADIM 1: E-posta ile Kod Talep Etme */
                    <form onSubmit={handleForgotPasswordRequest} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
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
                          className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                      </div>

                      {/* Cloudflare Turnstile Bot Koruması */}
                      <div className="bg-slate-900/60 border border-slate-700/70 rounded-xl p-3 flex flex-col items-center justify-center">
                        <div ref={turnstileContainerRef} />
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Cloudflare Turnstile ile korunuyor</span>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isForgotLoading || cooldown > 0}
                        className="w-full bg-emerald-500 text-white font-medium py-2.5 rounded-xl text-sm hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isForgotLoading
                          ? 'Doğrulama Kodu Gönderiliyor...'
                          : cooldown > 0
                            ? `Yeni Kod İçin Bekleyin (${cooldown}s)`
                            : 'Doğrulama Kodu Gönder'}
                      </button>
                    </form>
                  ) : (
                    /* ADIM 2: 6 Kutucuklu OTP Kod Doğrulama ve Yeni Şifre Belirleme */
                    <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-medium text-slate-300">
                            6 Haneli Doğrulama Kodu
                          </label>
                          <button
                            type="button"
                            onClick={handlePasteFromClipboard}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-700 text-[11px] font-medium text-emerald-400 hover:bg-slate-700/60 transition-colors cursor-pointer"
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
                              className="w-full h-11 bg-slate-900/90 border border-slate-700 rounded-xl text-center text-base font-bold text-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors"
                            />
                          ))}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1.5">
                          Doğrulama kodu 15 dakika boyunca geçerlidir.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
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
                            className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-2.5 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
                            aria-label={showNewPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                          >
                            {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>

                        {isCapsLockOn && (
                          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-400">
                            <AlertCircle size={13} className="shrink-0" />
                            <span>Büyük harf kilidi (Caps Lock) açık</span>
                          </div>
                        )}

                        {/* Yeni Şifre Güç Göstergesi */}
                        {newPassword.length > 0 && (
                          <div className="mt-2.5 p-3 bg-slate-900/80 rounded-xl border border-slate-700/70 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400">Şifre Güvenliği:</span>
                              <span className={`font-semibold ${
                                newPasswordScore === 4 ? 'text-emerald-400' : newPasswordScore >= 2 ? 'text-amber-400' : 'text-rose-400'
                              }`}>
                                {newPasswordScore === 4 ? 'Güçlü' : newPasswordScore >= 2 ? 'Orta' : 'Zayıf'}
                              </span>
                            </div>
                            <div className="flex gap-1.5 h-1.5">
                              {[1, 2, 3, 4].map(step => (
                                <div
                                  key={step}
                                  className={`flex-1 rounded-full transition-all duration-300 ${
                                    newPasswordScore >= step
                                      ? (newPasswordScore === 1 ? 'bg-rose-500' : newPasswordScore < 4 ? 'bg-amber-400' : 'bg-emerald-500')
                                      : 'bg-slate-700'
                                  }`}
                                />
                              ))}
                            </div>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-1">
                              <span className={`flex items-center gap-1 ${newPassword.length >= 8 ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                                {newPassword.length >= 8 ? <Check size={12} className="shrink-0" /> : <Circle size={8} className="shrink-0" />} En az 8 karakter
                              </span>
                              <span className={`flex items-center gap-1 ${/[A-Z]/.test(newPassword) ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                                {/[A-Z]/.test(newPassword) ? <Check size={12} className="shrink-0" /> : <Circle size={8} className="shrink-0" />} En az 1 büyük harf
                              </span>
                              <span className={`flex items-center gap-1 ${/[a-z]/.test(newPassword) ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                                {/[a-z]/.test(newPassword) ? <Check size={12} className="shrink-0" /> : <Circle size={8} className="shrink-0" />} En az 1 küçük harf
                              </span>
                              <span className={`flex items-center gap-1 ${/\d/.test(newPassword) ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                                {/\d/.test(newPassword) ? <Check size={12} className="shrink-0" /> : <Circle size={8} className="shrink-0" />} En az 1 rakam
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
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
                            className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-2.5 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
                            aria-label={showConfirmNewPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                          >
                            {showConfirmNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        {confirmNewPassword.length > 0 && newPassword !== confirmNewPassword && (
                          <p className="text-[11px] text-rose-400 mt-1">
                            Şifreler birbiriyle eşleşmiyor.
                          </p>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={isForgotLoading || newPasswordScore < 4 || newPassword !== confirmNewPassword}
                        className="w-full bg-emerald-500 text-white font-medium py-2.5 rounded-xl text-sm hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isForgotLoading ? 'Şifre Güncelleniyor...' : 'Yeni Şifreyi Kaydet'}
                      </button>

                      <div className="text-center pt-1">
                        {cooldown > 0 ? (
                          <p className="text-xs text-slate-400">
                            Yeni kod talep etmek için <span className="text-emerald-400 font-semibold">{cooldown}s</span> bekleyiniz.
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleForgotPasswordRequest()}
                            className="text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer"
                          >
                            Doğrulama kodunu tekrar gönder
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
                        setNewPassword('');
                        setConfirmNewPassword('');
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                    >
                      <ArrowLeft size={15} />
                      <span>Giriş Ekranına Dön</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* NORMAL GİRİŞ & KAYIT GÖRÜNÜMÜ */
                <div>
                  {/* Üst Sekmeli Geçiş Çubuğu (Yumuşak Hatlı Segmented Tab Control) */}
                  <div className="grid grid-cols-2 bg-slate-900/90 border border-slate-700/80 rounded-xl p-1 mb-6">
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
                      className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        isLogin
                          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                          : 'text-slate-400 hover:text-slate-200'
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
                      className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        !isLogin
                          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Yeni Hesap Oluştur
                    </button>
                  </div>

                  <div className="mb-5">
                    <h1 className="text-xl font-bold text-slate-50 tracking-tight">
                      {isLogin ? "EsnafRadar'a Hoş Geldiniz" : 'Yeni Hesap Oluşturun'}
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                      {isLogin
                        ? 'Keşif motoru ve müşteri yönetim paneline erişmek için bilgilerinizi giriniz.'
                        : 'Platformu kullanmaya başlamak için aşağıdaki bilgileri doldurunuz.'}
                    </p>
                  </div>

                  {authSuccess && (
                    <div className="flex items-start gap-2.5 p-3.5 mb-5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                      <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />
                      <span>{authSuccess}</span>
                    </div>
                  )}

                  {authError && (
                    <div className="flex items-start gap-2.5 p-3.5 mb-5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                      <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <form onSubmit={handleAuth} className="space-y-4">
                    {/* Kayıt Modunda 2 Sütunlu Ad ve Soyad Izgarası */}
                    {!isLogin && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1.5">
                            Ad
                          </label>
                          <input
                            type="text"
                            autoComplete="given-name"
                            value={firstName}
                            onChange={e => { setFirstName(e.target.value); if (authError) setAuthError(null); }}
                            placeholder="Adınız"
                            maxLength={50}
                            className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1.5">
                            Soyad
                          </label>
                          <input
                            type="text"
                            autoComplete="family-name"
                            value={lastName}
                            onChange={e => { setLastName(e.target.value); if (authError) setAuthError(null); }}
                            placeholder="Soyadınız"
                            maxLength={50}
                            className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        E-posta Adresi
                      </label>
                      <input
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={e => { setEmail(e.target.value); if (authError) setAuthError(null); }}
                        placeholder="ornek@eposta.com"
                        maxLength={100}
                        className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-medium text-slate-300">
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
                            className="text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer"
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
                          className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
                          aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>

                      {isCapsLockOn && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-400">
                          <AlertCircle size={13} className="shrink-0" />
                          <span>Büyük harf kilidi (Caps Lock) açık</span>
                        </div>
                      )}

                      {/* Şifre Güç Göstergesi (Sadece Kayıt Olurken) */}
                      {!isLogin && password.length > 0 && (
                        <div className="mt-2.5 p-3 bg-slate-900/80 rounded-xl border border-slate-700/70 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Şifre Güvenliği:</span>
                            <span className={`font-semibold ${
                              passwordScore === 4 ? 'text-emerald-400' : passwordScore >= 2 ? 'text-amber-400' : 'text-rose-400'
                            }`}>
                              {passwordScore === 4 ? 'Güçlü' : passwordScore >= 2 ? 'Orta' : 'Zayıf'}
                            </span>
                          </div>
                          <div className="flex gap-1.5 h-1.5">
                            {[1, 2, 3, 4].map(step => (
                              <div
                                key={step}
                                className={`flex-1 rounded-full transition-all duration-300 ${
                                  passwordScore >= step
                                    ? (passwordScore === 1 ? 'bg-rose-500' : passwordScore < 4 ? 'bg-amber-400' : 'bg-emerald-500')
                                    : 'bg-slate-700'
                                }`}
                              />
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-1">
                            <span className={`flex items-center gap-1 ${password.length >= 8 ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                              {password.length >= 8 ? <Check size={12} className="shrink-0" /> : <Circle size={8} className="shrink-0" />} En az 8 karakter
                            </span>
                            <span className={`flex items-center gap-1 ${/[A-Z]/.test(password) ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                              {/[A-Z]/.test(password) ? <Check size={12} className="shrink-0" /> : <Circle size={8} className="shrink-0" />} En az 1 büyük harf
                            </span>
                            <span className={`flex items-center gap-1 ${/[a-z]/.test(password) ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                              {/[a-z]/.test(password) ? <Check size={12} className="shrink-0" /> : <Circle size={8} className="shrink-0" />} En az 1 küçük harf
                            </span>
                            <span className={`flex items-center gap-1 ${/\d/.test(password) ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                              {/\d/.test(password) ? <Check size={12} className="shrink-0" /> : <Circle size={8} className="shrink-0" />} En az 1 rakam
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Kayıt Olurken Şifre Tekrar Alanı */}
                    {!isLogin && (
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
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
                            className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
                            aria-label={showConfirmPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                          >
                            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        {confirmPassword.length > 0 && password !== confirmPassword && (
                          <p className="text-[11px] text-rose-400 mt-1">
                            Şifreler birbiriyle eşleşmiyor.
                          </p>
                        )}
                      </div>
                    )}

                    {/* E-posta Adresimi Hatırla (Giriş Modunda) */}
                    {isLogin && (
                      <div className="flex items-center justify-between pt-0.5">
                        <label className="inline-flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={e => setRememberMe(e.target.checked)}
                            className="accent-emerald-500 rounded cursor-pointer"
                          />
                          <span>E-posta adresimi bu cihazda hatırla</span>
                        </label>
                      </div>
                    )}

                    {/* Cloudflare Turnstile Bot Koruması */}
                    <div className="bg-slate-900/60 border border-slate-700/70 rounded-xl p-3 flex flex-col items-center justify-center">
                      <div ref={turnstileContainerRef} />
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Cloudflare Turnstile ile korunuyor</span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isAuthLoading}
                      className="w-full bg-emerald-500 text-white font-medium py-2.5 rounded-xl text-sm hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* SAĞ PANEL: Kurumsal Misyon ve İş Akışı */}
        <div className="relative z-10 lg:w-[46%] bg-slate-800 border-t lg:border-t-0 lg:border-l border-slate-700/70 p-8 lg:p-14 flex flex-col justify-between">
          <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full py-6">
            {/* Ana Başlık ve Teknik Misyon (Ortalanmış) */}
            <div className="text-center flex flex-col items-center">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/70 border border-slate-700/80 text-emerald-400 text-xs font-medium mb-5 shadow-sm">
                <Layers size={14} />
                <span>Coğrafi Konum Tabanlı Dijital Denetim ve CRM</span>
              </div>
              <h2 className="text-2xl lg:text-3xl font-bold text-slate-50 leading-snug tracking-tight">
                Yerel İşletmelerin Dijital Varlıklarını Analiz Edin ve Satış Süreçlerini Yönetin
              </h2>
              <p className="mt-4 text-sm text-slate-300 leading-relaxed max-w-md">
                Açık kaynaklı harita verileri üzerinden bölgesel tarama gerçekleştirin, işletmelerin web ve iletişim altyapılarını denetleyin ve potansiyel müşterilerinizi tek merkezden takip edin.
              </p>
            </div>

            {/* Dikey Adım Göstergeleri */}
            <div className="mt-10 space-y-0 border-l-2 border-emerald-500/30 ml-4 sm:ml-8 max-w-md mx-auto">
              <div className="relative pl-6 pb-7">
                <div className="absolute -left-[9px] top-0.5 w-4 h-4 rounded-full bg-emerald-400 border-2 border-slate-900 shadow-sm shadow-emerald-400/50" />
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  <MapPin size={14} />
                  <span>01. Bölgesel Tarama ve Keşif</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                  Overpass API motoru ve 40'tan fazla sektör filtresi ile hedef koordinattaki ticari işletmeleri anlık olarak tespit edin.
                </p>
              </div>

              <div className="relative pl-6 pb-7">
                <div className="absolute -left-[9px] top-0.5 w-4 h-4 rounded-full bg-slate-800 border-2 border-emerald-400" />
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  <Globe size={14} />
                  <span>02. Dijital Varlık Röntgeni</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                  HTTP durum kodu, SSL sertifikası, mobil uyumluluk sinyali ve sosyal medya varlıklarını otomatik denetleyerek fırsat puanı hesaplayın.
                </p>
              </div>

              <div className="relative pl-6">
                <div className="absolute -left-[9px] top-0.5 w-4 h-4 rounded-full bg-slate-800 border-2 border-emerald-400" />
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  <Users size={14} />
                  <span>03. Müşteri İlişkileri ve Doğrudan İletişim</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                  İncelenen işletmeleri müşteri aday listesine kaydedin, satış aşamalarını güncelleyin ve doğrudan kurumsal iletişim başlatın.
                </p>
              </div>
            </div>
          </div>

          {/* Alt Sistem Durumu Çubuğu */}
          <div className="pt-5 border-t border-slate-700/70 flex flex-wrap items-center justify-center sm:justify-between gap-4 text-xs text-slate-300 max-w-lg mx-auto w-full">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
              <span className="font-medium">Overpass Keşif Motoru: Aktif</span>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-slate-400">
              <span>Web Denetleyici: Hazır</span>
              <span>JWT & Turnstile Koruması</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 relative">
      {/* Uygulama Bildirim Çubuğu (Toast) */}
      {appToast && (
        <div
          className={`fixed bottom-6 right-6 z-[9998] flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl text-xs font-medium ${
            appToast.type === 'success'
              ? 'bg-slate-900 border-emerald-500/50 text-emerald-300'
              : 'bg-slate-900 border-rose-500/50 text-rose-300'
          }`}
        >
          {appToast.type === 'success' ? (
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
          )}
          <span>{appToast.message}</span>
        </div>
      )}

      {/* Röntgen Yükleniyor Modal */}
      {isAuditing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center">
          <div className="bg-slate-800 p-8 rounded-2xl border border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.2)] animate-pulse flex flex-col items-center">
            <Radar size={48} className="text-emerald-500 animate-spin mb-4" />
            <h2 className="text-xl font-bold text-white">Dijital Röntgen Çekiliyor...</h2>
            <p className="text-slate-400 mt-2 text-sm">Web sitesi, SSL, mobil uyumluluk, SEO etiketleri ve iletişim kanalları analiz ediliyor.</p>
          </div>
        </div>
      )}

      {/* Gelişmiş Dijital Röntgen Sonuç Modalı */}
      {auditResult && (
        <AuditModal
          auditResult={auditResult}
          isSavingLead={isSavingLead}
          saveLeadSuccess={saveLeadSuccess}
          onClose={() => setAuditResult(null)}
          onSaveLead={handleSaveLead}
          onReAudit={() => handleAudit(auditResult.merchant, true)}
        />
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
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
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
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
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
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
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
          <SavedLeadsCRM
            token={token}
            onLeadCountChange={setSavedLeadCount}
            onInspectMerchant={(merchant) => handleAudit(merchant)}
          />
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
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowHistory(!showHistory)}
                    title="Geçmiş Taramalar"
                    className={`text-xs px-2 py-1 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
                      showHistory
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-200'
                    }`}
                  >
                    <History size={13} />
                    <span>Geçmiş</span>
                  </button>
                  <button 
                    onClick={handleGetLocation} 
                    className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded-lg text-emerald-400 transition-colors cursor-pointer"
                  >
                    📍 Konum
                  </button>
                </div>
              </div>

              {/* Geçmiş Taramalar Açılır Kutusu */}
              {showHistory && (
                <div className="mb-4 p-3 rounded-xl bg-slate-900 border border-slate-700 space-y-2 max-h-48 overflow-y-auto">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 pb-1 border-b border-slate-800">
                    <span>Son Taramalar ({scanHistory.length})</span>
                  </div>
                  {scanHistory.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-2">Henüz kayıtlı tarama geçmişi yok.</p>
                  ) : (
                    scanHistory.map(item => (
                      <div
                        key={item.id}
                        onClick={() => handleApplyHistoryItem(item)}
                        className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 cursor-pointer text-xs transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-200 truncate">
                            {Number(item.search_lat).toFixed(3)}, {Number(item.search_lng).toFixed(3)} ({item.radius_meters}m)
                          </p>
                          <p className="text-[10px] text-emerald-400">
                            {item.results_count} işletme • {item.category_filter || 'all'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteHistory(item.id, e)}
                          className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer shrink-0"
                          title="Kaydı Sil"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
              
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
                    <option value="services">💼 Hizmet & Ofis (Emlak, Avukat, Otel, Spor)</option>
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
                  onClick={() => handleScan()}
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
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={filterOnlyNoWebsite}
                        onChange={e => setFilterOnlyNoWebsite(e.target.checked)}
                        className="accent-emerald-500 rounded cursor-pointer"
                      />
                      <span>🚨 Sadece Web Sitesi Olmayanlar</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={filterOnlyWithPhone}
                        onChange={e => setFilterOnlyWithPhone(e.target.checked)}
                        className="accent-emerald-500 rounded cursor-pointer"
                      />
                      <span>📞 Sadece Telefonu Olanlar</span>
                    </label>
                  </div>
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
              onAudit={(m) => handleAudit(m)}
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
