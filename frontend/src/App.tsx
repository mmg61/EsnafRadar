import React, { useState } from 'react';
import { scanMerchants, loginUser, registerUser } from './api';
import MapRadar from './components/MapRadar';
import { Radar, Search, User } from 'lucide-react';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  
  // Auth state
  const [email, setEmail] = useState('test@esnafradar.com');
  const [password, setPassword] = useState('password123');
  const [isLogin, setIsLogin] = useState(true);

  // Radar state
  const [isScanning, setIsScanning] = useState(false);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [center, setCenter] = useState<[number, number]>([40.990, 29.025]); // Kadıköy
  const [radius, setRadius] = useState(500);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        const data = await loginUser(email, password);
        setToken(data.access_token);
        localStorage.setItem('token', data.access_token);
      } else {
        await registerUser(email, password, "Test Kullanıcı");
        const data = await loginUser(email, password);
        setToken(data.access_token);
        localStorage.setItem('token', data.access_token);
      }
    } catch (err) {
      alert("Hata oluştu! Bilgilerinizi kontrol edin.");
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
  };

  const handleScan = async () => {
    if (!token) return;
    setIsScanning(true);
    setMerchants([]);
    try {
      const results = await scanMerchants(center[0], center[1], radius, token);
      setMerchants(results);
    } catch (err: any) {
      alert(err.message || "Tarama sırasında hata oluştu!");
    } finally {
      setIsScanning(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-700">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400">
              <Radar size={32} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center mb-6">EsnafRadar'a Giriş Yap</h1>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">E-posta</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} 
                     className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Şifre</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} 
                     className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500" />
            </div>
            <button type="submit" className="w-full bg-emerald-500 text-white font-medium py-2 rounded-lg hover:bg-emerald-600 transition-colors">
              {isLogin ? 'Giriş Yap' : 'Kayıt Ol'}
            </button>
          </form>
          
          <p className="text-center mt-4 text-sm text-slate-400">
            {isLogin ? "Hesabın yok mu?" : "Zaten hesabın var mı?"}{" "}
            <button onClick={() => setIsLogin(!isLogin)} className="text-emerald-400 hover:underline">
              {isLogin ? 'Kayıt Ol' : 'Giriş Yap'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Audit state
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<any | null>(null);

  const handleAudit = async (merchant: any) => {
    if (!token) return;
    setIsAuditing(true);
    setAuditResult(null);
    try {
      const { auditMerchant } = await import('./api');
      const result = await auditMerchant(merchant.osm_id, merchant.name, merchant.website || null, token);
      setAuditResult({ ...result, merchantName: merchant.name });
    } catch (err: any) {
      alert(err.message || "Röntgen çekilirken hata oluştu!");
    } finally {
      setIsAuditing(false);
    }
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCenter([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          alert("Konum alınamadı. Lütfen tarayıcı izinlerini kontrol edin.");
        }
      );
    } else {
      alert("Tarayıcınız konum özelliğini desteklemiyor.");
    }
  };

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
                  {auditResult.opportunities.map((opp: str, i: number) => (
                    <span key={i} className="bg-emerald-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      + {opp}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-700 bg-slate-900/50 flex justify-end">
              <button className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-600 transition-colors mr-2" onClick={() => setAuditResult(null)}>Kapat</button>
              <button className="bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600 transition-colors">Listeme Kaydet (CRM)</button>
            </div>
          </div>
        </div>
      )}

      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400">
            <Radar size={24} />
            <span className="text-xl font-bold">EsnafRadar</span>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <User size={18} />
            <span className="text-sm">Çıkış Yap</span>
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sol Panel: Kontroller */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Radar Hedefi</h2>
                <button 
                  onClick={handleGetLocation} 
                  className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-emerald-400 transition-colors"
                >
                  📍 Konumumu Bul
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Enlem (Latitude)</label>
                  <input type="number" step="0.0001" value={center[0]} onChange={e => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) setCenter([val, center[1]]);
                    }} 
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Boylam (Longitude)</label>
                  <input type="number" step="0.0001" value={center[1]} onChange={e => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) setCenter([center[0], val]);
                    }} 
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Yarıçap (Metre): {radius}m</label>
                  <input type="range" min="100" max="2000" step="100" value={radius} onChange={e => setRadius(parseInt(e.target.value))} 
                         className="w-full accent-emerald-500" />
                </div>
                
                <button 
                  onClick={handleScan}
                  disabled={isScanning || isAuditing}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-500 text-white font-medium py-3 rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {isScanning ? (
                    <span className="animate-pulse">Taranıyor...</span>
                  ) : (
                    <>
                      <Search size={18} />
                      Taramayı Başlat
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Bulunan Esnaflar Listesi (Özet) */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 h-[300px] overflow-y-auto">
              <h2 className="text-lg font-bold mb-4">Sonuçlar ({merchants.length})</h2>
              {merchants.length === 0 ? (
                <p className="text-slate-500 text-sm text-center mt-8">Henüz tarama yapılmadı.</p>
              ) : (
                <div className="space-y-3">
                  {merchants.map(m => (
                    <div key={m.osm_id} className="p-3 bg-slate-900 rounded-lg border border-slate-700 hover:border-emerald-500/50 transition-colors cursor-pointer" onClick={() => handleAudit(m)}>
                      <h3 className="font-medium text-sm truncate">{m.name}</h3>
                      <p className="text-xs text-slate-500 capitalize">{m.category}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sağ Panel: Harita */}
          <div className="lg:col-span-3">
            <MapRadar 
              center={center} 
              radius={radius} 
              merchants={merchants} 
              isScanning={isScanning} 
              onAudit={handleAudit}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
