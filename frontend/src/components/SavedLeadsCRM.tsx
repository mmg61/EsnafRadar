import React, { useState, useEffect } from 'react';
import {
  getSavedLeads,
  updateLeadStatus,
  deleteLead,
  addLeadNote,
  updateLeadNote,
  deleteLeadNote,
  logLeadOutreach,
  exportLeadsCsv
} from '../api';
import {
  Trash2,
  ExternalLink,
  Phone,
  MessageSquare,
  Building2,
  Search,
  Download,
  StickyNote,
  History,
  Plus,
  Edit3,
  Check,
  X,
  Mail,
  CheckCircle2,
  AlertCircle,
  FileSearch
} from 'lucide-react';

interface LeadNote {
  id: number;
  saved_lead_id: number;
  user_id: number;
  content: string;
  created_at: string;
  updated_at?: string;
}

interface OutreachLog {
  id: number;
  saved_lead_id: number;
  channel: string;
  message_content: string;
  is_ai_generated: boolean;
  sent_at: string;
}

interface SavedLead {
  id: number;
  status: string;
  opportunity_score: number;
  saved_at: string;
  notes?: LeadNote[];
  outreach_logs?: OutreachLog[];
  merchant: {
    id: number;
    osm_id: string;
    name: string;
    latitude?: number;
    longitude?: number;
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
  onInspectMerchant?: (merchant: any) => void;
}

const statusOptions = [
  { value: 'new', label: 'Yeni', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { value: 'contacted', label: 'İletişime Geçildi', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  { value: 'interested', label: 'İlgileniyor', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  { value: 'converted', label: 'Satış Yapıldı', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { value: 'rejected', label: 'Reddedildi', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
];

export const SavedLeadsCRM: React.FC<SavedLeadsCRMProps> = ({
  token,
  onLeadCountChange,
  onInspectMerchant
}) => {
  const [leads, setLeads] = useState<SavedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isExporting, setIsExporting] = useState(false);

  // Bildirim (Toast) ve silme onay durumları
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmDeleteLeadId, setConfirmDeleteLeadId] = useState<number | null>(null);

  // Detay / Not Defteri & İletişim Geçmişi çekmecesi durumu
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<'notes' | 'outreach'>('notes');
  const [newNoteText, setNewNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3500);
  };

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const data = await getSavedLeads(token);
      setLeads(data);
      if (onLeadCountChange) onLeadCountChange(data.length);
    } catch (err: any) {
      showToast('error', err.message || 'Müşteri listesi yüklenemedi.');
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
      setLeads(prev => prev.map(lead => (lead.id === leadId ? { ...lead, status: newStatus } : lead)));
      showToast('success', 'Müşteri aşaması güncellendi.');
    } catch (err: any) {
      showToast('error', err.message || 'Durum güncellenirken hata oluştu.');
    }
  };

  const handleDelete = async (leadId: number) => {
    try {
      await deleteLead(leadId, token);
      const updated = leads.filter(l => l.id !== leadId);
      setLeads(updated);
      setConfirmDeleteLeadId(null);
      if (selectedLeadId === leadId) setSelectedLeadId(null);
      if (onLeadCountChange) onLeadCountChange(updated.length);
      showToast('success', 'Müşteri kaydı listeden silindi.');
    } catch (err: any) {
      showToast('error', err.message || 'Silme işlemi sırasında hata oluştu.');
    }
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      await exportLeadsCsv(token);
      showToast('success', 'Müşteri listesi CSV olarak indirildi.');
    } catch (err: any) {
      showToast('error', err.message || 'Dışa aktarım başarısız oldu.');
    } finally {
      setIsExporting(false);
    }
  };

  const getCustomPitchMessage = (lead: SavedLead, channel: 'WhatsApp' | 'Email') => {
    const audit = lead.merchant.audit_data;
    if (channel === 'WhatsApp' && audit?.sales_pitch_whatsapp) {
      return audit.sales_pitch_whatsapp;
    }
    if (channel === 'Email' && audit?.sales_pitch_email) {
      return audit.sales_pitch_email;
    }
    return `Merhaba ${lead.merchant.name || 'Yetkili'}, EsnafRadar üzerinden işletmenizin dijital varlığını inceledik. Dijital görünürlük ve web çözümlerimiz hakkında bilgi vermek isteriz.`;
  };

  const handleWhatsAppOutreach = async (lead: SavedLead) => {
    const phone = lead.merchant.phone;
    if (!phone) return;
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.startsWith('90')
      ? cleanPhone
      : cleanPhone.startsWith('0')
        ? '9' + cleanPhone
        : '90' + cleanPhone;
    const msgText = getCustomPitchMessage(lead, 'WhatsApp');
    const waUrl = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msgText)}`;

    window.open(waUrl, '_blank', 'noopener,noreferrer');

    try {
      const logEntry = await logLeadOutreach(
        lead.id,
        'WhatsApp',
        msgText,
        Boolean(lead.merchant.audit_data?.sales_pitch_whatsapp),
        token
      );
      setLeads(prev =>
        prev.map(l =>
          l.id === lead.id
            ? {
                ...l,
                status: l.status === 'new' ? 'contacted' : l.status,
                outreach_logs: [logEntry, ...(l.outreach_logs || [])]
              }
            : l
        )
      );
    } catch (_) {}
  };

  const handleEmailOutreach = async (lead: SavedLead) => {
    const email = lead.merchant.email;
    if (!email) return;
    const msgText = getCustomPitchMessage(lead, 'Email');
    const subject = encodeURIComponent(`${lead.merchant.name} - Dijital Görünürlük ve Teknik Analiz Raporu`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${encodeURIComponent(msgText)}`;

    try {
      const logEntry = await logLeadOutreach(
        lead.id,
        'Email',
        msgText,
        Boolean(lead.merchant.audit_data?.sales_pitch_email),
        token
      );
      setLeads(prev =>
        prev.map(l =>
          l.id === lead.id
            ? {
                ...l,
                status: l.status === 'new' ? 'contacted' : l.status,
                outreach_logs: [logEntry, ...(l.outreach_logs || [])]
              }
            : l
        )
      );
    } catch (_) {}
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId || !newNoteText.trim() || isSavingNote) return;
    setIsSavingNote(true);
    try {
      const note = await addLeadNote(selectedLeadId, newNoteText.trim(), token);
      setLeads(prev =>
        prev.map(l =>
          l.id === selectedLeadId ? { ...l, notes: [note, ...(l.notes || [])] } : l
        )
      );
      setNewNoteText('');
      showToast('success', 'Görüşme notu kaydedildi.');
    } catch (err: any) {
      showToast('error', err.message || 'Not kaydedilemedi.');
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleSaveEditedNote = async (leadId: number, noteId: number) => {
    if (!editingNoteText.trim()) return;
    try {
      const updated = await updateLeadNote(leadId, noteId, editingNoteText.trim(), token);
      setLeads(prev =>
        prev.map(l =>
          l.id === leadId
            ? { ...l, notes: (l.notes || []).map(n => (n.id === noteId ? updated : n)) }
            : l
        )
      );
      setEditingNoteId(null);
      setEditingNoteText('');
      showToast('success', 'Not güncellendi.');
    } catch (err: any) {
      showToast('error', err.message || 'Not güncellenemedi.');
    }
  };

  const handleRemoveNote = async (leadId: number, noteId: number) => {
    try {
      await deleteLeadNote(leadId, noteId, token);
      setLeads(prev =>
        prev.map(l =>
          l.id === leadId ? { ...l, notes: (l.notes || []).filter(n => n.id !== noteId) } : l
        )
      );
      showToast('success', 'Not silindi.');
    } catch (err: any) {
      showToast('error', err.message || 'Not silinemedi.');
    }
  };

  const selectedLead = leads.find(l => l.id === selectedLeadId) || null;

  const filteredLeads = leads.filter(lead => {
    const q = search.toLowerCase();
    const matchesSearch =
      lead.merchant.name.toLowerCase().includes(q) ||
      (lead.merchant.category && lead.merchant.category.toLowerCase().includes(q)) ||
      (lead.merchant.address && lead.merchant.address.toLowerCase().includes(q));
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 relative">
      {/* Bildirim Çubuğu */}
      {feedback && (
        <div
          className={`fixed bottom-6 right-6 z-[9998] flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-slate-900 border-emerald-500/50 text-emerald-300'
              : 'bg-slate-900 border-rose-500/50 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Üst Filtre, Durum Sekmeleri & CSV Dışa Aktarım Barı */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="İşletme adı, sektör veya adres ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            maxLength={100}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-700'
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
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border cursor-pointer ${
                  statusFilter === opt.value
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'bg-slate-900 text-slate-400 hover:text-white border-slate-700'
                }`}
              >
                {opt.label} ({count})
              </button>
            );
          })}

          {leads.length > 0 && (
            <button
              onClick={handleExportCsv}
              disabled={isExporting}
              className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download size={14} />
              <span>{isExporting ? 'Aktarılıyor...' : 'CSV / Excel İndir'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Lead Listesi */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 animate-pulse">
          Kayıtlı müşteriler yükleniyor...
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-12 text-center">
          <Building2 size={48} className="mx-auto text-slate-500 mb-3" />
          <h3 className="text-lg font-bold text-slate-300">Henüz Kayıtlı Müşteri Yok</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
            Harita radarı üzerinden işletmeleri tarayıp Dijital Röntgen ekranındaki
            <span className="text-emerald-400 font-semibold"> "Listeme Kaydet (CRM)"</span> butonuna tıklayarak potansiyel müşterilerinizi buraya ekleyebilirsiniz.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLeads.map(lead => {
            const notesCount = lead.notes?.length || 0;
            const outreachCount = lead.outreach_logs?.length || 0;
            const lastNote = notesCount > 0 ? lead.notes![0] : null;

            return (
              <div
                key={lead.id}
                className="bg-slate-800 rounded-xl border border-slate-700 hover:border-emerald-500/40 transition-all p-5 flex flex-col justify-between shadow-lg"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-base text-white truncate">{lead.merchant.name}</h3>
                      <p className="text-xs text-slate-400 capitalize">{lead.merchant.category || 'Yerel İşletme'}</p>
                    </div>
                    <span className="text-xs font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                      {lead.opportunity_score}/100 Puan
                    </span>
                  </div>

                  {/* İletişim & Konum Bilgileri */}
                  <div className="space-y-1.5 text-xs text-slate-300 my-3 bg-slate-900/60 p-3 rounded-lg border border-slate-700/50">
                    {lead.merchant.address && (
                      <p className="truncate text-slate-400">Adres: {lead.merchant.address}</p>
                    )}
                    {lead.merchant.phone ? (
                      <p className="text-emerald-400 font-medium">Tel: {lead.merchant.phone}</p>
                    ) : (
                      <p className="text-slate-500 italic">Tel: Belirtilmemiş</p>
                    )}
                    {lead.merchant.email && (
                      <p className="text-slate-300 truncate">E-posta: {lead.merchant.email}</p>
                    )}
                    {lead.merchant.website ? (
                      <p className="truncate">
                        <a
                          href={lead.merchant.website.startsWith('http') ? lead.merchant.website : `https://${lead.merchant.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:underline inline-flex items-center gap-1"
                        >
                          {lead.merchant.website.replace(/^https?:\/\//, '')}
                          <ExternalLink size={12} />
                        </a>
                      </p>
                    ) : (
                      <p className="text-rose-400 font-medium">Web sitesi bulunmuyor (Yüksek Fırsat)</p>
                    )}
                  </div>

                  {/* Son Not Özeti */}
                  {lastNote && (
                    <div className="mb-3 px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-700/70 text-xs">
                      <p className="text-[11px] text-emerald-400 font-semibold mb-0.5">Son Görüşme Notu:</p>
                      <p className="text-slate-300 line-clamp-2">{lastNote.content}</p>
                    </div>
                  )}
                </div>

                {/* Alt Kısım: Durum Yönetimi, Notlar ve İletişim Eylemleri */}
                <div className="pt-3 border-t border-slate-700/80 space-y-2.5">
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

                  {/* Not Defteri, İletişim Kayıtları ve Röntgen Butonları */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLeadId(lead.id);
                        setDetailTab('notes');
                      }}
                      className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
                    >
                      <StickyNote size={13} className="text-emerald-400" />
                      <span>Notlar ({notesCount})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLeadId(lead.id);
                        setDetailTab('outreach');
                      }}
                      className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
                    >
                      <History size={13} className="text-blue-400" />
                      <span>İletişim ({outreachCount})</span>
                    </button>
                  </div>

                  {/* Doğrudan İletişim & Silme Çubuğu */}
                  <div className="flex items-center gap-2">
                    {lead.merchant.phone ? (
                      <button
                        type="button"
                        onClick={() => handleWhatsAppOutreach(lead)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2 rounded-lg transition-colors cursor-pointer"
                      >
                        <MessageSquare size={14} />
                        <span>WhatsApp</span>
                      </button>
                    ) : (
                      <button
                        disabled
                        className="flex-1 flex items-center justify-center gap-1 bg-slate-700/50 text-slate-500 text-xs py-2 rounded-lg cursor-not-allowed"
                      >
                        <Phone size={13} />
                        <span>Tel Yok</span>
                      </button>
                    )}

                    {lead.merchant.email && (
                      <button
                        type="button"
                        onClick={() => handleEmailOutreach(lead)}
                        title="E-posta Gönder"
                        className="p-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg transition-colors cursor-pointer"
                      >
                        <Mail size={15} />
                      </button>
                    )}

                    {onInspectMerchant && (
                      <button
                        type="button"
                        onClick={() => onInspectMerchant(lead.merchant)}
                        title="Dijital Röntgen Raporunu Aç"
                        className="p-2 bg-slate-900 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                      >
                        <FileSearch size={15} />
                      </button>
                    )}

                    {confirmDeleteLeadId === lead.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDelete(lead.id)}
                          className="px-2 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold rounded-lg cursor-pointer"
                        >
                          Sil
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteLeadId(null)}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteLeadId(lead.id)}
                        className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Listeden Sil"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Not Defteri ve İletişim Geçmişi Modalı */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-slate-800 w-full max-w-2xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="bg-slate-900 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedLead.merchant.name}</h3>
                <p className="text-xs text-slate-400">Müşteri Not Defteri ve İletişim Kayıtları</p>
              </div>
              <button
                onClick={() => {
                  setSelectedLeadId(null);
                  setEditingNoteId(null);
                }}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Sekmeler */}
            <div className="flex border-b border-slate-700 bg-slate-900/50 px-6 pt-2 gap-3">
              <button
                type="button"
                onClick={() => setDetailTab('notes')}
                className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                  detailTab === 'notes'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <StickyNote size={14} />
                <span>Görüşme Notları ({selectedLead.notes?.length || 0})</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('outreach')}
                className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                  detailTab === 'outreach'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <History size={14} />
                <span>İletişim Geçmişi ({selectedLead.outreach_logs?.length || 0})</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {detailTab === 'notes' ? (
                <>
                  <form onSubmit={handleAddNote} className="space-y-2">
                    <textarea
                      rows={3}
                      value={newNoteText}
                      onChange={e => setNewNoteText(e.target.value)}
                      placeholder="Görüşme detayları, karar verici ismi, geri dönüş tarihi vb. notunuzu yazınız..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSavingNote || !newNoteText.trim()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>{isSavingNote ? 'Ekleniyor...' : 'Not Ekle'}</span>
                      </button>
                    </div>
                  </form>

                  <div className="space-y-3 pt-2">
                    {!selectedLead.notes || selectedLead.notes.length === 0 ? (
                      <p className="text-center text-xs text-slate-500 py-6">
                        Bu müşteri için henüz görüşme notu eklenmemiş.
                      </p>
                    ) : (
                      selectedLead.notes.map(note => (
                        <div
                          key={note.id}
                          className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-2"
                        >
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>
                              {new Date(note.created_at).toLocaleString('tr-TR', {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNoteId(note.id);
                                  setEditingNoteText(note.content);
                                }}
                                className="text-slate-400 hover:text-emerald-400 cursor-pointer"
                                title="Düzenle"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveNote(selectedLead.id, note.id)}
                                className="text-slate-400 hover:text-rose-400 cursor-pointer"
                                title="Sil"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {editingNoteId === note.id ? (
                            <div className="space-y-2">
                              <textarea
                                rows={3}
                                value={editingNoteText}
                                onChange={e => setEditingNoteText(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingNoteId(null)}
                                  className="px-3 py-1 rounded bg-slate-800 text-slate-300 text-xs cursor-pointer"
                                >
                                  İptal
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditedNote(selectedLead.id, note.id)}
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                                >
                                  <Check size={12} />
                                  <span>Kaydet</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                              {note.content}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  {!selectedLead.outreach_logs || selectedLead.outreach_logs.length === 0 ? (
                    <p className="text-center text-xs text-slate-500 py-6">
                      Bu müşteriyle henüz WhatsApp veya E-posta üzerinden kayıtlı bir iletişim başlatılmamış.
                    </p>
                  ) : (
                    selectedLead.outreach_logs.map(log => (
                      <div
                        key={log.id}
                        className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-emerald-400">
                            Kanal: {log.channel}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(log.sent_at).toLocaleString('tr-TR', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                          {log.message_content}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
