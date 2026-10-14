import React, { useState, useEffect } from 'react';
import { getSavedLeads, updateLeadStatus, deleteLead } from '../api';
import { Trash2, ExternalLink, Phone, MessageSquare, Building2, Search } from 'lucide-react';

interface SavedLead {
  id: number;
  status: string;
  opportunity_score: number;
  saved_at: string;
  merchant: {
    id: number;
    osm_id: string;
    name: string;
    category?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    audit_data?: any;
  };
}

interface SavedLeadsCRMProps {
  token: string;
  onLeadCountChange?: (count: number) => void;
}

const statusOptions = [
  { value: 'new', label: 'Yeni', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { value: 'contacted', label: 'İletişime Geçildi', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  { value: 'interested', label: 'İlgileniyor', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  { value: 'converted', label: 'Satış Yapıldı 🎉', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { value: 'rejected', label: 'Reddedildi', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
];

export const SavedLeadsCRM: React.FC<SavedLeadsCRMProps> = ({ token, onLeadCountChange }) => {
  const [leads, setLeads] = useState<SavedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const data = await getSavedLeads(token);
      setLeads(data);
      if (onLeadCountChange) onLeadCountChange(data.length);
    } catch (err: any) {
      alert(err.message || 'Leadler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [token]);

  const handleStatusChange = async (leadId: number, newStatus: string) => {
    try {
      await updateLeadStatus(leadId, newStatus, token);
      setLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, status: newStatus } : lead));
    } catch (err: any) {
      alert('Durum güncellenirken hata oluştu');
    }
  };

  const handleDelete = async (leadId: number) => {
    if (!window.confirm('Bu esnafı kayıtlı listenizden silmek istediğinize emin misiniz?')) return;
    try {
      await deleteLead(leadId, token);
      const updated = leads.filter(l => l.id !== leadId);
      setLeads(updated);
      if (onLeadCountChange) onLeadCountChange(updated.length);
    } catch (err: any) {
      alert('Silinirken hata oluştu');
    }
  };

  const getWhatsAppLink = (phone?: string, name?: string) => {
    if (!phone) return null;
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.startsWith('90') ? cleanPhone : cleanPhone.startsWith('0') ? '9' + cleanPhone : '90' + cleanPhone;
    const msg = encodeURIComponent(`Merhaba ${name || 'Yetkili'}, EsnafRadar üzerinden işletmenizin dijital varlığını inceledik. Hizmetlerimiz hakkında bilgi vermek isteriz.`);
    return `https://wa.me/${phoneWithCountry}?text=${msg}`;
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.merchant.name.toLowerCase().includes(search.toLowerCase()) ||
      (lead.merchant.category && lead.merchant.category.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Üst Filtre & İstatistik Barı */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="İşletme adı veya sektör ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            maxLength={100}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Durum Sekmeleri */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === 'all' ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-700'
            }`}
          >
            Hepsi ({leads.length})
          </button>
          {statusOptions.map(opt => {
            const count = leads.filter(l => l.status === opt.value).length;
            return (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  statusFilter === opt.value
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'bg-slate-900 text-slate-400 hover:text-white border-slate-700'
                }`}
              >
                {opt.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Lead Listesi */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 animate-pulse">
          Kayıtlı leadler yükleniyor...
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-12 text-center">
          <Building2 size={48} className="mx-auto text-slate-500 mb-3" />
          <h3 className="text-lg font-bold text-slate-300">Henüz Kayıtlı Müşteri Yok</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
            Harita radarı üzerinden esnafları tarayıp "Dijital Röntgen Çek" ekranındaki 
            <span className="text-emerald-400 font-semibold"> "Listeme Kaydet (CRM)"</span> butonuna tıklayarak potansiyel müşterilerinizi buraya ekleyebilirsiniz.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLeads.map(lead => {
            const waLink = getWhatsAppLink(lead.merchant.phone, lead.merchant.name);
            return (
              <div
                key={lead.id}
                className="bg-slate-800 rounded-xl border border-slate-700 hover:border-emerald-500/40 transition-all p-5 flex flex-col justify-between shadow-lg"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-bold text-lg text-white line-clamp-1">{lead.merchant.name}</h3>
                      <p className="text-xs text-slate-400 capitalize">{lead.merchant.category || 'Yerel İşletme'}</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {lead.opportunity_score}/100 Puan
                      </span>
                    </div>
                  </div>

                  {/* İletişim & Konum Bilgileri */}
                  <div className="space-y-1.5 text-xs text-slate-300 my-4 bg-slate-900/60 p-3 rounded-lg border border-slate-700/50">
                    {lead.merchant.address && (
                      <p className="truncate text-slate-400">📍 {lead.merchant.address}</p>
                    )}
                    {lead.merchant.phone ? (
                      <p className="text-emerald-400 font-medium">📞 {lead.merchant.phone}</p>
                    ) : (
                      <p className="text-slate-500 italic">📞 Telefon bilgisi yok</p>
                    )}
                    {lead.merchant.website ? (
                      <p className="truncate">
                        <a
                          href={lead.merchant.website.startsWith('http') ? lead.merchant.website : `http://${lead.merchant.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:underline flex items-center gap-1 inline-flex"
                        >
                          🌐 {lead.merchant.website.replace(/^https?:\/\//, '')}
                          <ExternalLink size={12} />
                        </a>
                      </p>
                    ) : (
                      <p className="text-rose-400">🌐 Web sitesi bulunamadı (Fırsat!)</p>
                    )}
                  </div>
                </div>

                {/* Alt Kısım: Durum Yönetimi & Eylemler */}
                <div className="pt-3 border-t border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">Aşama:</span>
                    <select
                      value={lead.status}
                      onChange={e => handleStatusChange(lead.id, e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-xs rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      {statusOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    {waLink ? (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
                      >
                        <MessageSquare size={14} />
                        WhatsApp Mesajı
                      </a>
                    ) : (
                      <button
                        disabled
                        className="flex-1 flex items-center justify-center gap-1 bg-slate-700/50 text-slate-500 text-xs py-2 rounded-lg cursor-not-allowed"
                      >
                        <Phone size={14} />
                        Tel Yok
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(lead.id)}
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Listeden Sil"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
