import React, { useState } from 'react';
import {
  API_BASE_URL,
  scanMerchants,
  auditMerchant,
  getUserProfile,
  saveLead,
  getSavedLeads
} from './api';
import { getSavedTheme, applyAndSaveTheme, type ThemeId } from './theme';
import type { AuditResult, Merchant } from './types';
import MapRadar from './components/MapRadar';
import { SavedLeadsCRM } from './components/SavedLeadsCRM';
import { UserProfileView } from './components/UserProfileView';
import { AuditModal } from './components/AuditModal';
import { AuthScreen } from './components/AuthScreen';
import { SettingsView } from './components/SettingsView';
import {
  Radar,
  Search,
  User,
  Compass,
  Users,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Bell,
  Settings,
  LogOut
} from 'lucide-react';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(() => getSavedTheme());

  React.useEffect(() => {
    applyAndSaveTheme(currentTheme);
  }, [currentTheme]);

  const handleSelectTheme = (theme: ThemeId) => {
    setCurrentTheme(theme);
    applyAndSaveTheme(theme);
  };

  // Tarayıcı sekmesi açık olduğu sürece arka uçla bağlantıyı koru; yerel masaüstü modunda sekme kapanınca sunucuları kapat
  React.useEffect(() => {
    let ws: WebSocket | null = null;
    let pingInterval: ReturnType<typeof setInterval> | null = null;
    let isUnmounting = false;

    const wsBaseUrl = API_BASE_URL.replace(/^http/i, 'ws');

    const sendHeartbeat = () => {
      fetch(`${API_BASE_URL}/api/heartbeat`, { method: 'POST', keepalive: true }).catch(() => {});
    };

    const connectKeepAlive = () => {
      if (isUnmounting) return;
      sendHeartbeat();
      try {
        ws = new WebSocket(`${wsBaseUrl}/api/keepalive`);
        ws.onopen = () => {
          sendHeartbeat();
        };
        ws.onclose = () => {
          if (!isUnmounting) {
            setTimeout(connectKeepAlive, 1500);
          }
        };
        } catch {
    // Baglanti hatasinda sessizce devam et
  }
    };

    connectKeepAlive();
    pingInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send('ping');
      } else {
        sendHeartbeat();
      }
    }, 5000);

    const handlePageHide = () => {
      isUnmounting = true;
      if (ws) {
        try {
          ws.close();
          } catch {
    // Baglanti hatasinda sessizce devam et
  }
      }
      if (navigator.sendBeacon) {
        navigator.sendBeacon(`${API_BASE_URL}/api/tab-closed`);
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => {
      isUnmounting = true;
      window.removeEventListener('pagehide', handlePageHide);
      if (pingInterval) clearInterval(pingInterval);
      if (ws) {
        try {
          ws.close();
          } catch {
    // Baglanti hatasinda sessizce devam et
  }
      }
    };
  }, []);

  // Radar state
  const [isScanning, setIsScanning] = useState(false);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [center, setCenter] = useState<[number, number]>([40.990, 29.025]); // Kadıköy
  const [radius, setRadius] = useState(500);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterOnlyNoWebsite, setFilterOnlyNoWebsite] = useState<boolean>(false);
  const [filterOnlyWithPhone, setFilterOnlyWithPhone] = useState<boolean>(false);
  const [hideCorporateChains, setHideCorporateChains] = useState<boolean>(false);

  // Toast bildirim state
  const [appToast, setAppToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showAppToast = (type: 'success' | 'error', message: string) => {
    setAppToast({ type, message });
    setTimeout(() => setAppToast(null), 3500);
  };

  // Tab & CRM state
  const [activeTab, setActiveTab] = useState<'radar' | 'crm' | 'profile' | 'settings'>('radar');
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [saveLeadSuccess, setSaveLeadSuccess] = useState(false);
  const [savedLeadCount, setSavedLeadCount] = useState(0);
  const [dueReminderCount, setDueReminderCount] = useState(0);
  const notifiedLeadIdsRef = React.useRef<Set<number>>(new Set());

  const checkDueReminders = React.useCallback(async (activeToken: string) => {
    try {
      const leads = await getSavedLeads(activeToken);
      setSavedLeadCount(leads.length);
      const now = Date.now();
      const due = leads.filter(
        l => l.reminder_at && !l.reminder_completed && new Date(l.reminder_at).getTime() <= now
      );
      setDueReminderCount(due.length);
      for (const item of due) {
        if (!notifiedLeadIdsRef.current.has(item.id)) {
          notifiedLeadIdsRef.current.add(item.id);
          const msg = `${item.merchant?.name || 'Müşteri'} için geri arama zamanı geldi: ${item.reminder_note || 'Takip yapılacak'}`;
          showAppToast('success', msg);
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('EsnafRadar - Geri Arama Hatırlatıcısı', { body: msg });
              } catch {
    // Baglanti hatasinda sessizce devam et
  }
          }
        }
      }
      } catch {
    // Baglanti hatasinda sessizce devam et
  }
  }, []);

  React.useEffect(() => {
    if (!token) return;
    const initialTimer = setTimeout(() => {
      void checkDueReminders(token);
    }, 0);
    const interval = setInterval(() => {
      void checkDueReminders(token);
    }, 45000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [token, checkDueReminders]);

  // Audit state
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);

  // Açılışta oturum (JWT token) doğrulama ve kayıtlı müşteri sayısını yükleme
  React.useEffect(() => {
    if (!token) return;
    getUserProfile(token)
      .then(profile => {
        if (typeof profile.saved_leads_count === 'number') {
          setSavedLeadCount(profile.saved_leads_count);
        }
      })
      .catch(() => {
        setToken(null);
        localStorage.removeItem('token');
        setMerchants([]);
        setAuditResult(null);
        setActiveTab('radar');
        setSessionError('Oturum süreniz sona erdi. Lütfen tekrar giriş yapınız.');
      });
  }, [token]);

  const handleAudit = async (merchant: Merchant, forceRefresh: boolean = false) => {
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
      const enrichedMerchant: Merchant = {
        ...merchant,
        website: merchant.website || result.discovered_website || undefined,
        website_source: result.website_source || merchant.website_source,
        phone:
          merchant.phone ||
          result.scraped_whatsapp ||
          (result.scraped_phones && result.scraped_phones.length > 0 ? result.scraped_phones[0] : undefined),
        email:
          merchant.email ||
          (result.scraped_emails && result.scraped_emails.length > 0 ? result.scraped_emails[0] : undefined),
        instagram:
          merchant.instagram ||
          (result.social_links && result.social_links.instagram ? result.social_links.instagram : undefined)
      };
      setMerchants(prev =>
        prev.map(m => (m.osm_id === merchant.osm_id ? enrichedMerchant : m))
      );
      setAuditResult({ ...result, merchantName: merchant.name, merchant: enrichedMerchant });
    } catch (err: unknown) {
      showAppToast('error', err instanceof Error ? err.message : 'İnceleme sırasında hata oluştu.');
    } finally {
      setIsAuditing(false);
    }
  };

  const handleSaveLead = async () => {
    if (!token || !auditResult || !auditResult.merchant) return;
    setIsSavingLead(true);
    try {
      await saveLead(
        {
          osm_id: auditResult.merchant.osm_id,
          name: auditResult.merchant.name,
          latitude: auditResult.merchant.latitude || center[0],
          longitude: auditResult.merchant.longitude || center[1],
          category: auditResult.merchant.category,
          phone:
            auditResult.merchant.phone ||
            (auditResult.scraped_phones && auditResult.scraped_phones.length > 0 ? auditResult.scraped_phones[0] : undefined),
          email:
            auditResult.merchant.email ||
            (auditResult.scraped_emails && auditResult.scraped_emails.length > 0 ? auditResult.scraped_emails[0] : undefined),
          website: auditResult.merchant.website || auditResult.discovered_website,
          address: auditResult.merchant.address,
          opportunity_score: auditResult.score,
          audit_data: auditResult
        },
        token
      );
      setSaveLeadSuccess(true);
      const profile = await getUserProfile(token).catch(() => null);
      if (profile && typeof profile.saved_leads_count === 'number') {
        setSavedLeadCount(profile.saved_leads_count);
      } else {
        setSavedLeadCount(prev => prev + 1);
      }
      showAppToast('success', `${auditResult.merchant.name} müşteri listenize kaydedildi.`);
      setTimeout(() => setSaveLeadSuccess(false), 3000);
    } catch (err: unknown) {
      showAppToast('error', err instanceof Error ? err.message : 'Müşteri kaydedilemedi.');
    } finally {
      setIsSavingLead(false);
    }
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          setCenter([
            parseFloat(position.coords.latitude.toFixed(6)),
            parseFloat(position.coords.longitude.toFixed(6))
          ]);
          showAppToast('success', 'Mevcut konumunuz haritaya uygulandı.');
        },
        () => {
          showAppToast('error', 'Konum alınamadı. Lütfen tarayıcı izinlerini kontrol edin.');
        }
      );
    } else {
      showAppToast('error', 'Tarayıcınız konum özelliğini desteklemiyor.');
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
    setMerchants([]);
    setAuditResult(null);
    setActiveTab('radar');
    setSessionError(null);
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
      showAppToast('success', `${results.length} yerel işletme tespit edildi.`);
    } catch (err: unknown) {
      showAppToast('error', err instanceof Error ? err.message : 'Tarama sırasında hata oluştu.');
    } finally {
      setIsScanning(false);
    }
  };

  const filteredMerchants = merchants.filter(m => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      m.name.toLowerCase().includes(q) ||
      (m.category_label && m.category_label.toLowerCase().includes(q)) ||
      (m.category && m.category.toLowerCase().includes(q));
    const matchesNoWeb = !filterOnlyNoWebsite || !m.website;
    const matchesPhone = !filterOnlyWithPhone || Boolean(m.phone);
    const matchesChain = !hideCorporateChains || !m.is_corporate_chain;
    return matchesSearch && matchesNoWeb && matchesPhone && matchesChain;
  });

  if (!token) {
    return (
      <AuthScreen
        initialError={sessionError}
        currentTheme={currentTheme}
        onAuthSuccess={accessToken => {
          setToken(accessToken);
          localStorage.setItem('token', accessToken);
          setSessionError(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--theme-canvas)] text-[var(--theme-contrast)] relative">
      {/* Uygulama Bildirim Çubuğu (Toast) */}
      {appToast && (
        <div
          className={`fixed bottom-6 right-6 z-[9998] flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-semibold shadow-lg ${
            appToast.type === 'success'
              ? 'bg-[var(--theme-surface)] border-[var(--theme-border)] text-[var(--theme-contrast)]'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-500'
          }`}
        >
          {appToast.type === 'success' ? (
            <CheckCircle2 size={16} className="text-[var(--theme-primary)] shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-rose-500 shrink-0" />
          )}
          <span>{appToast.message}</span>
        </div>
      )}

      {/* İnceleme Yükleniyor Modal */}
      {isAuditing && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
          <div className="bg-[var(--theme-canvas)] p-8 rounded-2xl border border-[var(--theme-border)] flex flex-col items-center max-w-md text-center shadow-xl">
            <Radar size={48} className="text-[var(--theme-primary)] animate-spin mb-4" />
            <h2 className="text-xl font-bold text-[var(--theme-contrast)]">İşletme İnceleniyor...</h2>
            <p className="text-[var(--theme-contrast)]/75 mt-2 text-sm">
              Web sitesi, telefon uyumu, Google görünürlüğü ve iletişim bilgileri kontrol ediliyor.
            </p>
          </div>
        </div>
      )}

      {/* Gelişmiş Dijital Röntgen Sonuç Modalı */}
      {auditResult && (
        <AuditModal
          key={auditResult.merchant?.osm_id || auditResult.merchantName || 'audit-modal'}
          auditResult={auditResult}
          token={token}
          isSavingLead={isSavingLead}
          saveLeadSuccess={saveLeadSuccess}
          onClose={() => setAuditResult(null)}
          onSaveLead={handleSaveLead}
          onReAudit={() => auditResult.merchant && handleAudit(auditResult.merchant, true)}
          onAuditResultUpdate={updated => setAuditResult(updated)}
        />
      )}

      <header className="border-b border-[var(--theme-border)] bg-[var(--theme-surface)] sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2.5 text-[var(--theme-primary)]">
              <div className="w-8 h-8 rounded-lg bg-[var(--theme-primary)] text-[var(--theme-on-primary)] flex items-center justify-center">
                <Radar size={18} />
              </div>
              <span className="text-xl font-bold tracking-tight">EsnafRadar</span>
            </div>

            {/* Navigasyon Sekmeleri */}
            <nav className="flex items-center h-[42px] gap-1.5 bg-[var(--theme-canvas)] p-1 rounded-xl border border-[var(--theme-border)]">
              <button
                onClick={() => setActiveTab('radar')}
                className={`flex items-center h-8 gap-2 px-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                  activeTab === 'radar'
                    ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)]'
                    : 'text-[var(--theme-contrast)] hover:bg-[var(--theme-surface)]'
                }`}
              >
                <Compass size={16} />
                <span>Harita Radarı</span>
              </button>
              <button
                onClick={() => setActiveTab('crm')}
                className={`flex items-center h-8 gap-2 px-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                  activeTab === 'crm'
                    ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)]'
                    : 'text-[var(--theme-contrast)] hover:bg-[var(--theme-surface)]'
                }`}
              >
                <Users size={16} />
                <span>Kayıtlı Müşterilerim</span>
                {dueReminderCount > 0 && (
                  <span
                    title={`${dueReminderCount} müşterinin geri arama zamanı geldi`}
                    className="inline-flex items-center gap-1 bg-amber-600 text-white text-xs px-2 py-0.5 rounded-full font-bold"
                  >
                    <Bell size={11} />
                    {dueReminderCount}
                  </span>
                )}
                {savedLeadCount > 0 && (
                  <span className="bg-[var(--theme-muted)] text-[var(--theme-contrast)] text-xs px-2 py-0.5 rounded-full font-bold border border-[var(--theme-border)]">
                    {savedLeadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex items-center h-8 gap-2 px-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                  activeTab === 'profile'
                    ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)]'
                    : 'text-[var(--theme-contrast)] hover:bg-[var(--theme-surface)]'
                }`}
              >
                <User size={16} />
                <span>Profilim</span>
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center h-8 gap-2 px-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)]'
                    : 'text-[var(--theme-contrast)] hover:bg-[var(--theme-surface)]'
                }`}
              >
                <Settings size={16} />
                <span>Ayarlar</span>
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              className="flex items-center h-[42px] gap-2 px-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-canvas)] text-[var(--theme-contrast)] hover:bg-rose-500/15 hover:text-rose-500 hover:border-rose-500/30 transition-colors cursor-pointer font-semibold text-sm"
            >
              <LogOut size={16} />
              <span>Çıkış Yap</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {activeTab === 'settings' ? (
          <SettingsView currentTheme={currentTheme} onApplyTheme={handleSelectTheme} />
        ) : activeTab === 'profile' ? (
          <UserProfileView
            token={token}
            onAccountDeleted={() => {
              handleLogout();
              setSessionError('Hesabınız ve ilişkili tüm verileriniz kalıcı olarak silindi.');
            }}
          />
        ) : activeTab === 'crm' ? (
          <SavedLeadsCRM
            token={token}
            onLeadCountChange={setSavedLeadCount}
            onInspectMerchant={merchant => handleAudit(merchant)}
            onRemindersUpdated={() => checkDueReminders(token)}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sol Panel: Kontroller */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-[var(--theme-surface)] p-6 rounded-xl border border-[var(--theme-border)]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-[var(--theme-contrast)] flex items-center gap-2">
                    <Compass size={18} className="text-[var(--theme-primary)]" />
                    Radar Kontrolü
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleGetLocation}
                      className="inline-flex items-center gap-1 text-xs bg-[var(--theme-canvas)] hover:bg-[var(--theme-muted)] px-2.5 py-1 rounded-lg text-[var(--theme-contrast)] border border-[var(--theme-border)] font-semibold transition-colors cursor-pointer"
                    >
                      <MapPin size={12} />
                      <span>Konum</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Sektör Seçici */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1">
                      Hedef Sektör (Akıllı Filtre)
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={e => setSelectedCategory(e.target.value)}
                      className="w-full bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-lg px-3 py-2 text-xs text-[var(--theme-contrast)] font-medium focus:outline-none focus:border-[var(--theme-primary)] cursor-pointer"
                    >
                      <option value="all">Tüm Sektörler (Geniş Tarama)</option>
                      <option value="food">Yeme & İçme (Restoran, Kafe, Fırın)</option>
                      <option value="beauty">Güzellik & Bakım (Kuaför, Berber, Spa)</option>
                      <option value="auto">Oto & Sanayi (Tamir, Yıkama, Lastik)</option>
                      <option value="retail">Perakende & Market (Butik, Bakkal)</option>
                      <option value="health">Sağlık & Medikal (Eczane, Diş, Klinik)</option>
                      <option value="services">Hizmet & Ofis (Emlak, Avukat, Otel, Spor)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1">Enlem (Lat)</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={center[0]}
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) setCenter([val, center[1]]);
                        }}
                        className="w-full bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--theme-contrast)] focus:outline-none focus:border-[var(--theme-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1">Boylam (Lon)</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={center[1]}
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) setCenter([center[0], val]);
                        }}
                        className="w-full bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--theme-contrast)] focus:outline-none focus:border-[var(--theme-primary)]"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-[var(--theme-contrast)] mb-1">
                      <span className="font-semibold">Tarama Yarıçapı</span>
                      <span className="text-[var(--theme-primary)] font-bold">{radius} metre</span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="2500"
                      step="100"
                      value={radius}
                      onChange={e => setRadius(parseInt(e.target.value))}
                      className="w-full accent-[var(--theme-primary)] cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={() => handleScan()}
                    disabled={isScanning || isAuditing}
                    className="w-full flex items-center justify-center gap-2 bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] font-semibold py-2.5 rounded-lg border border-[var(--theme-border)] transition-colors disabled:opacity-50 text-sm cursor-pointer"
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

              {/* Bulunan Esnaflar Listesi */}
              <div className="bg-[var(--theme-surface)] p-5 rounded-xl border border-[var(--theme-border)] space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[var(--theme-contrast)]">
                    Bulunan İşletmeler ({filteredMerchants.length}
                    {filteredMerchants.length !== merchants.length ? ` / ${merchants.length}` : ''})
                  </h2>
                </div>

                {merchants.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <input
                      type="text"
                      placeholder="Sonuçlarda ara..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--theme-contrast)] placeholder-[var(--theme-contrast)]/45 focus:outline-none focus:border-[var(--theme-primary)]"
                    />
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-2 text-xs text-[var(--theme-contrast)] font-medium cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={filterOnlyNoWebsite}
                          onChange={e => setFilterOnlyNoWebsite(e.target.checked)}
                          className="accent-[var(--theme-primary)] rounded cursor-pointer"
                        />
                        <span>Sadece Web Sitesi Olmayanlar</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-[var(--theme-contrast)] font-medium cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={filterOnlyWithPhone}
                          onChange={e => setFilterOnlyWithPhone(e.target.checked)}
                          className="accent-[var(--theme-primary)] rounded cursor-pointer"
                        />
                        <span>Sadece Telefonu Olanlar</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-[var(--theme-contrast)] font-medium cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={hideCorporateChains}
                          onChange={e => setHideCorporateChains(e.target.checked)}
                          className="accent-[var(--theme-primary)] rounded cursor-pointer"
                        />
                        <span>Kurumsal Zincirleri Gizle (Yerel Esnaf)</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="h-[280px] overflow-y-auto space-y-2.5 pr-1">
                  {merchants.length === 0 ? (
                    <p className="text-[var(--theme-contrast)]/70 text-xs text-center mt-12 leading-relaxed">
                      Haritada konumu seçin veya hedef pini sürükleyin, ardından "Radarı Başlat" butonuna basın.
                    </p>
                  ) : filteredMerchants.length === 0 ? (
                    <p className="text-[var(--theme-contrast)]/70 text-xs text-center mt-12">
                      Arama kriterine uygun işletme bulunamadı.
                    </p>
                  ) : (
                    filteredMerchants.map(m => (
                      <div
                        key={m.osm_id}
                        className="p-3 bg-[var(--theme-canvas)] rounded-xl border border-[var(--theme-border)] hover:bg-[var(--theme-muted)]/40 transition-colors cursor-pointer group"
                        onClick={() => handleAudit(m)}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--theme-surface)] text-[var(--theme-contrast)] border border-[var(--theme-border)] shrink-0">
                              {m.category_icon || 'ISL'}
                            </span>
                            <h3 className="font-bold text-xs truncate text-[var(--theme-contrast)]">
                              {m.name}
                            </h3>
                          </div>
                          {m.lead_potential_score && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-[var(--theme-muted)] text-[var(--theme-contrast)] border border-[var(--theme-border)] shrink-0">
                              %{m.lead_potential_score}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-[var(--theme-contrast)]/75 mt-0.5 truncate">
                          {m.category_label || m.category}
                        </p>

                        <div className="flex items-center justify-between text-[10px] mt-2 pt-1.5 border-t border-[var(--theme-border)]">
                          <span className={m.phone ? 'text-[var(--theme-contrast)] font-semibold' : 'text-[var(--theme-contrast)]/50'}>
                            {m.phone ? 'Tel: Mevcut' : 'Tel: Yok'}
                          </span>
                          <span className={m.website ? 'text-[var(--theme-primary)] font-semibold' : 'text-amber-600 font-semibold'}>
                            {m.website
                              ? m.is_corporate_chain
                                ? 'Kurumsal Web'
                                : 'Web Mevcut'
                              : 'Haritada Web Yok'}
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
                onAudit={m => handleAudit(m)}
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
