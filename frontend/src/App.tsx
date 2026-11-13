import React, { useState } from 'react';
import {
  API_BASE_URL,
  scanMerchants,
  auditMerchant,
  getUserProfile,
  saveLead,
  getSavedLeads
} from './api';
import type { AuditResult, Merchant } from './types';
import MapRadar from './components/MapRadar';
import { SavedLeadsCRM } from './components/SavedLeadsCRM';
import { UserProfileView } from './components/UserProfileView';
import { AuditModal } from './components/AuditModal';
import { AuthScreen } from './components/AuthScreen';
import {
  Radar,
  Search,
  User,
  Compass,
  Users,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Bell
} from 'lucide-react';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [sessionError, setSessionError] = useState<string | null>(null);

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
      } catch (_) {}
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
        } catch (_) {}
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
        } catch (_) {}
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
  const [activeTab, setActiveTab] = useState<'radar' | 'crm' | 'profile'>('radar');
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
            } catch (_) {}
          }
        }
      }
    } catch (_) {}
  }, []);

  React.useEffect(() => {
    if (!token) return;
    checkDueReminders(token);
    const interval = setInterval(() => checkDueReminders(token), 45000);
    return () => clearInterval(interval);
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
        onAuthSuccess={accessToken => {
          setToken(accessToken);
          localStorage.setItem('token', accessToken);
          setSessionError(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF8E7] text-[#3F5E45] relative">
      {/* Uygulama Bildirim Çubuğu (Toast) */}
      {appToast && (
        <div
          className={`fixed bottom-6 right-6 z-[9998] flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 text-xs font-semibold ${
            appToast.type === 'success'
              ? 'bg-[#E8DCC4] border-[#3F5E45] text-[#3F5E45]'
              : 'bg-rose-100 border-rose-700 text-rose-900'
          }`}
        >
          {appToast.type === 'success' ? (
            <CheckCircle2 size={16} className="text-[#3F5E45] shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-rose-700 shrink-0" />
          )}
          <span>{appToast.message}</span>
        </div>
      )}

      {/* İnceleme Yükleniyor Modal */}
      {isAuditing && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
          <div className="bg-[#FFF8E7] p-8 rounded-xl border-2 border-[#3F5E45] flex flex-col items-center max-w-md text-center">
            <Radar size={48} className="text-[#6F8F72] animate-spin mb-4" />
            <h2 className="text-xl font-bold text-[#3F5E45]">İşletme İnceleniyor...</h2>
            <p className="text-[#3F5E45]/80 mt-2 text-sm">
              Web sitesi, telefon uyumu, Google görünürlüğü ve iletişim bilgileri kontrol ediliyor.
            </p>
          </div>
        </div>
      )}

      {/* Gelişmiş Dijital Röntgen Sonuç Modalı */}
      {auditResult && (
        <AuditModal
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

      <header className="border-b-2 border-[#3F5E45] bg-[#E8DCC4] sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[#3F5E45]">
              <Radar size={24} />
              <span className="text-xl font-bold">EsnafRadar</span>
            </div>

            {/* Navigasyon Sekmeleri */}
            <nav className="flex items-center gap-2 bg-[#FFF8E7] p-1 rounded-xl border border-[#3F5E45]">
              <button
                onClick={() => setActiveTab('radar')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                  activeTab === 'radar'
                    ? 'bg-[#6F8F72] text-[#FFF8E7]'
                    : 'text-[#3F5E45] hover:bg-[#E8DCC4]'
                }`}
              >
                <Compass size={16} />
                <span>Harita Radarı</span>
              </button>
              <button
                onClick={() => setActiveTab('crm')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                  activeTab === 'crm'
                    ? 'bg-[#6F8F72] text-[#FFF8E7]'
                    : 'text-[#3F5E45] hover:bg-[#E8DCC4]'
                }`}
              >
                <Users size={16} />
                <span>Kayıtlı Müşterilerim</span>
                {dueReminderCount > 0 && (
                  <span
                    title={`${dueReminderCount} müşterinin geri arama zamanı geldi`}
                    className="inline-flex items-center gap-1 bg-amber-600 text-[#FFF8E7] text-xs px-2 py-0.5 rounded-full font-bold"
                  >
                    <Bell size={11} />
                    {dueReminderCount}
                  </span>
                )}
                {savedLeadCount > 0 && (
                  <span className="bg-[#B7C9A8] text-[#3F5E45] text-xs px-2 py-0.5 rounded-full font-bold border border-[#3F5E45]">
                    {savedLeadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                  activeTab === 'profile'
                    ? 'bg-[#6F8F72] text-[#FFF8E7]'
                    : 'text-[#3F5E45] hover:bg-[#E8DCC4]'
                }`}
              >
                <User size={16} />
                <span>Profilim</span>
              </button>
            </nav>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#3F5E45] bg-[#FFF8E7] text-[#3F5E45] hover:bg-rose-100 hover:text-rose-900 transition-colors cursor-pointer font-semibold text-xs"
          >
            <span>Çıkış Yap</span>
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
            onInspectMerchant={merchant => handleAudit(merchant)}
            onRemindersUpdated={() => checkDueReminders(token)}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sol Panel: Kontroller */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-[#E8DCC4] p-6 rounded-xl border-2 border-[#3F5E45]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-[#3F5E45] flex items-center gap-2">
                    <Compass size={18} className="text-[#3F5E45]" />
                    Radar Kontrolü
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleGetLocation}
                      className="inline-flex items-center gap-1 text-xs bg-[#FFF8E7] hover:bg-[#B7C9A8] px-2.5 py-1 rounded-lg text-[#3F5E45] border border-[#3F5E45] font-semibold transition-colors cursor-pointer"
                    >
                      <MapPin size={12} />
                      <span>Konum</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Sektör Seçici */}
                  <div>
                    <label className="block text-xs font-semibold text-[#3F5E45] mb-1">
                      Hedef Sektör (Akıllı Filtre)
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={e => setSelectedCategory(e.target.value)}
                      className="w-full bg-[#FFF8E7] border border-[#3F5E45] rounded-lg px-3 py-2 text-xs text-[#3F5E45] font-medium focus:outline-none focus:border-[#6F8F72] cursor-pointer"
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
                      <label className="block text-xs font-semibold text-[#3F5E45] mb-1">Enlem (Lat)</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={center[0]}
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) setCenter([val, center[1]]);
                        }}
                        className="w-full bg-[#FFF8E7] border border-[#3F5E45] rounded-lg px-2.5 py-1.5 text-xs text-[#3F5E45] focus:outline-none focus:border-[#6F8F72]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#3F5E45] mb-1">Boylam (Lon)</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={center[1]}
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) setCenter([center[0], val]);
                        }}
                        className="w-full bg-[#FFF8E7] border border-[#3F5E45] rounded-lg px-2.5 py-1.5 text-xs text-[#3F5E45] focus:outline-none focus:border-[#6F8F72]"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-[#3F5E45] mb-1">
                      <span className="font-semibold">Tarama Yarıçapı</span>
                      <span className="text-[#3F5E45] font-bold">{radius} metre</span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="2500"
                      step="100"
                      value={radius}
                      onChange={e => setRadius(parseInt(e.target.value))}
                      className="w-full accent-[#6F8F72] cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={() => handleScan()}
                    disabled={isScanning || isAuditing}
                    className="w-full flex items-center justify-center gap-2 bg-[#6F8F72] hover:bg-[#3F5E45] text-[#FFF8E7] font-semibold py-2.5 rounded-lg border border-[#3F5E45] transition-colors disabled:opacity-50 text-sm cursor-pointer"
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
              <div className="bg-[#E8DCC4] p-5 rounded-xl border-2 border-[#3F5E45] space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#3F5E45]">
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
                      className="w-full bg-[#FFF8E7] border border-[#3F5E45] rounded-lg px-3 py-1.5 text-xs text-[#3F5E45] placeholder-[#3F5E45]/50 focus:outline-none focus:border-[#6F8F72]"
                    />
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-2 text-xs text-[#3F5E45] font-medium cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={filterOnlyNoWebsite}
                          onChange={e => setFilterOnlyNoWebsite(e.target.checked)}
                          className="accent-[#6F8F72] rounded cursor-pointer"
                        />
                        <span>Sadece Web Sitesi Olmayanlar</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-[#3F5E45] font-medium cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={filterOnlyWithPhone}
                          onChange={e => setFilterOnlyWithPhone(e.target.checked)}
                          className="accent-[#6F8F72] rounded cursor-pointer"
                        />
                        <span>Sadece Telefonu Olanlar</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-[#3F5E45] font-medium cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={hideCorporateChains}
                          onChange={e => setHideCorporateChains(e.target.checked)}
                          className="accent-[#6F8F72] rounded cursor-pointer"
                        />
                        <span>Kurumsal Zincirleri Gizle (Yerel Esnaf)</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="h-[280px] overflow-y-auto space-y-2.5 pr-1">
                  {merchants.length === 0 ? (
                    <p className="text-[#3F5E45]/70 text-xs text-center mt-12 leading-relaxed">
                      Haritada konumu seçin veya hedef pini sürükleyin, ardından "Radarı Başlat" butonuna basın.
                    </p>
                  ) : filteredMerchants.length === 0 ? (
                    <p className="text-[#3F5E45]/70 text-xs text-center mt-12">
                      Arama kriterine uygun işletme bulunamadı.
                    </p>
                  ) : (
                    filteredMerchants.map(m => (
                      <div
                        key={m.osm_id}
                        className="p-3 bg-[#FFF8E7] rounded-xl border border-[#3F5E45] hover:bg-[#B7C9A8]/40 transition-colors cursor-pointer group"
                        onClick={() => handleAudit(m)}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#E8DCC4] text-[#3F5E45] border border-[#3F5E45] shrink-0">
                              {m.category_icon || 'ISL'}
                            </span>
                            <h3 className="font-bold text-xs truncate text-[#3F5E45]">
                              {m.name}
                            </h3>
                          </div>
                          {m.lead_potential_score && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-[#B7C9A8] text-[#3F5E45] border border-[#3F5E45] shrink-0">
                              %{m.lead_potential_score}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-[#3F5E45]/80 mt-0.5 truncate">
                          {m.category_label || m.category}
                        </p>

                        <div className="flex items-center justify-between text-[10px] mt-2 pt-1.5 border-t border-[#3F5E45]/20">
                          <span className={m.phone ? 'text-[#3F5E45] font-semibold' : 'text-[#3F5E45]/50'}>
                            {m.phone ? 'Tel: Mevcut' : 'Tel: Yok'}
                          </span>
                          <span className={m.website ? 'text-[#3F5E45] font-semibold' : 'text-amber-800 font-semibold'}>
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
