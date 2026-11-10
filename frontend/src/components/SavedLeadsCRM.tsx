import React, { useState, useEffect } from 'react';
import {
  getSavedLeads,
  updateLeadStatus,
  deleteLead,
  addLeadNote,
  updateLeadNote,
  deleteLeadNote,
  logLeadOutreach,
  exportLeadsCsv,
  updateLeadReminder
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
  FileSearch,
  Bell,
  Clock,
  CalendarClock
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

export interface SavedLead {
  id: number;
  status: string;
  opportunity_score: number;
  saved_at: string;
  reminder_at?: string | null;
  reminder_note?: string | null;
  reminder_completed?: boolean;
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
  onRemindersUpdated?: () => void;
}

const statusOptions = [
  { value: 'new', label: 'Yeni', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { value: 'contacted', label: 'İletişime Geçildi', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  { value: 'interested', label: 'İlgileniyor', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  { value: 'converted', label: 'Satış Yapıldı', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { value: 'rejected', label: 'Reddedildi', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
];

function toLocalDatetimeInputValue(dateObj: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}T${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
}

export const SavedLeadsCRM: React.FC<SavedLeadsCRMProps> = ({
  token,
  onLeadCountChange,
  onInspectMerchant,
  onRemindersUpdated
}) => {
  const [leads, setLeads] = useState<SavedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isExporting, setIsExporting] = useState(false);

  // Bildirim (Toast) ve silme onay durumları
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmDeleteLeadId, setConfirmDeleteLeadId] = useState<number | null>(null);

  // Detay / Not Defteri, Hatırlatıcı & İletişim Geçmişi çekmecesi durumu
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<'notes' | 'reminder' | 'outreach'>('notes');
  const [newNoteText, setNewNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // Hatırlatıcı form durumları
  const [reminderDateInput, setReminderDateInput] = useState('');
  const [reminderNoteInput, setReminderNoteInput] = useState('');
  const [isSavingReminder, setIsSavingReminder] = useState(false);

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

  const openLeadModal = (lead: SavedLead, tab: 'notes' | 'reminder' | 'outreach') => {
    setSelectedLeadId(lead.id);
    setDetailTab(tab);
    if (lead.reminder_at) {
      const dt = new Date(lead.reminder_at);
      if (!isNaN(dt.getTime())) {
        setReminderDateInput(toLocalDatetimeInputValue(dt));
      } else {
        setReminderDateInput('');
      }
    } else {
      const tomorrow10 = new Date();
      tomorrow10.setDate(tomorrow10.getDate() + 1);
      tomorrow10.setHours(10, 0, 0, 0);
      setReminderDateInput(toLocalDatetimeInputValue(tomorrow10));
    }
    setReminderNoteInput(lead.reminder_note || '');
  };

  const applyReminderPreset = (preset: '1h' | 'tomorrow10' | 'tomorrow14' | '3d' | '1w') => {
    const d = new Date();
    if (preset === '1h') {
      d.setHours(d.getHours() + 1);
    } else if (preset === 'tomorrow10') {
      d.setDate(d.getDate() + 1);
      d.setHours(10, 0, 0, 0);
    } else if (preset === 'tomorrow14') {
      d.setDate(d.getDate() + 1);
      d.setHours(14, 0, 0, 0);
    } else if (preset === '3d') {
      d.setDate(d.getDate() + 3);
      d.setHours(11, 0, 0, 0);
    } else if (preset === '1w') {
      d.setDate(d.getDate() + 7);
      d.setHours(11, 0, 0, 0);
    }
    setReminderDateInput(toLocalDatetimeInputValue(d));
  };

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId || !reminderDateInput || isSavingReminder) return;
    setIsSavingReminder(true);
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
      const isoDate = new Date(reminderDateInput).toISOString();
      const updated = await updateLeadReminder(
        selectedLeadId,
        {
          reminder_at: isoDate,
          reminder_note: reminderNoteInput.trim() || 'Geri arama / teklif takibi yapılacak',
          reminder_completed: false
        },
        token
      );
      setLeads(prev => prev.map(l => (l.id === selectedLeadId ? updated : l)));
      if (onRemindersUpdated) onRemindersUpdated();
      showToast('success', 'Geri arama hatırlatıcısı kaydedildi.');
    } catch (err: any) {
      showToast('error', err.message || 'Hatırlatıcı kaydedilemedi.');
    } finally {
      setIsSavingReminder(false);
    }
  };

  const handleToggleReminderComplete = async (lead: SavedLead, completed: boolean) => {
    if (!lead.reminder_at) return;
    try {
      const updated = await updateLeadReminder(
        lead.id,
        {
          reminder_at: lead.reminder_at,
          reminder_note: lead.reminder_note || null,
          reminder_completed: completed
        },
        token
      );
      setLeads(prev => prev.map(l => (l.id === lead.id ? updated : l)));
      if (onRemindersUpdated) onRemindersUpdated();
      showToast('success', completed ? 'Hatırlatıcı tamamlandı olarak işaretlendi.' : 'Hatırlatıcı tekrar aktif edildi.');
    } catch (err: any) {
      showToast('error', err.message || 'Hatırlatıcı güncellenemedi.');
    }
  };

  const handleClearReminder = async (leadId: number) => {
    setIsSavingReminder(true);
    try {
      const updated = await updateLeadReminder(
        leadId,
        {
          reminder_at: null,
          reminder_note: null,
          reminder_completed: false
        },
        token
      );
      setLeads(prev => prev.map(l => (l.id === leadId ? updated : l)));
      setReminderDateInput('');
      setReminderNoteInput('');
      if (onRemindersUpdated) onRemindersUpdated();
      showToast('success', 'Hatırlatıcı kaldırıldı.');
    } catch (err: any) {
      showToast('error', err.message || 'Hatırlatıcı silinemedi.');
    } finally {
      setIsSavingReminder(false);
    }
  };

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
      if (onRemindersUpdated) onRemindersUpdated();
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
  const nowMs = Date.now();

  const activeReminders = leads.filter(l => l.reminder_at && !l.reminder_completed);
  const dueReminders = activeReminders.filter(l => new Date(l.reminder_at!).getTime() <= nowMs);

  const filteredLeads = leads.filter(lead => {
    const q = search.toLowerCase();
    const matchesSearch =
      lead.merchant.name.toLowerCase().includes(q) ||
      (lead.merchant.category && lead.merchant.category.toLowerCase().includes(q)) ||
      (lead.merchant.address && lead.merchant.address.toLowerCase().includes(q));
    if (!matchesSearch) return false;
    if (statusFilter === 'reminders') {
      return Boolean(lead.reminder_at && !lead.reminder_completed);
    }
    return statusFilter === 'all' || lead.status === statusFilter;
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

      {/* Zamanı Gelen Hatırlatıcı Uyarı Bandı */}
      {dueReminders.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Bell size={20} className="text-amber-400 shrink-0 mt-0.5 animate-bounce" />
            <div>
              <h4 className="text-sm font-bold text-amber-200">
                Geri Arama Zamanı Gelen {dueReminders.length} Müşteri Var
              </h4>
              <p className="text-xs text-amber-300/80 mt-0.5">
                {dueReminders.map(d => d.merchant.name).join(', ')} için planlanan takip zamanı geldi.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter('reminders')}
            className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shrink-0 cursor-pointer"
          >
            Hatırlatıcıları Göster
          </button>
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

          <button
            onClick={() => setStatusFilter('reminders')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border inline-flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'reminders'
                ? 'bg-amber-500 text-slate-950 border-amber-500'
                : activeReminders.length > 0
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/40 hover:bg-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-700'
            }`}
          >
            <Bell size={13} />
            <span>Hatırlatıcılar ({activeReminders.length})</span>
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
          <h3 className="text-lg font-bold text-slate-300">Kayıtlı Müşteri Bulunamadı</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
            Harita üzerinden işletmeleri tarayıp İnceleme Raporu ekranındaki
            <span className="text-emerald-400 font-semibold"> "Müşteri Adaylarına Kaydet"</span> butonuna tıklayarak potansiyel müşterilerinizi buraya ekleyebilirsiniz.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLeads.map(lead => {
            const notesCount = lead.notes?.length || 0;
            const outreachCount = lead.outreach_logs?.length || 0;
            const lastNote = notesCount > 0 ? lead.notes![0] : null;
            const hasReminder = Boolean(lead.reminder_at);
            const reminderMs = lead.reminder_at ? new Date(lead.reminder_at).getTime() : 0;
            const isReminderDue = hasReminder && !lead.reminder_completed && reminderMs <= nowMs;

            return (
              <div
                key={lead.id}
                className={`bg-slate-800 rounded-xl border transition-all p-5 flex flex-col justify-between shadow-lg ${
                  isReminderDue
                    ? 'border-amber-500/70 ring-1 ring-amber-500/30'
                    : 'border-slate-700 hover:border-emerald-500/40'
                }`}
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

                  {/* Hatırlatıcı Kutusu (Varsa) */}
                  {hasReminder && (
                    <div
                      className={`mb-3 px-3 py-2.5 rounded-lg border text-xs flex items-start justify-between gap-2 ${
                        lead.reminder_completed
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : isReminderDue
                            ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                            : 'bg-sky-500/10 border-sky-500/30 text-sky-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-bold text-[11px]">
                          <Clock size={12} />
                          <span>
                            {lead.reminder_completed
                              ? 'Tamamlandı: '
                              : isReminderDue
                                ? 'Arama Zamanı Geldi: '
                                : 'Hatırlatıcı: '}
                            {new Date(lead.reminder_at!).toLocaleString('tr-TR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        {lead.reminder_note && (
                          <p className="text-[11px] opacity-90 mt-1 line-clamp-2">{lead.reminder_note}</p>
                        )}
                      </div>
                      {!lead.reminder_completed && (
                        <button
                          type="button"
                          onClick={() => handleToggleReminderComplete(lead, true)}
                          title="Arandı / Tamamlandı Olarak İşaretle"
                          className="px-2 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] shrink-0 cursor-pointer"
                        >
                          Tamamla
                        </button>
                      )}
                    </div>
                  )}

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

                {/* Alt Kısım: Durum Yönetimi, Notlar, Hatırlatıcı ve İletişim Eylemleri */}
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

                  {/* Not Defteri, Hatırlatıcı ve İletişim Kayıtları Butonları */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => openLeadModal(lead, 'notes')}
                      className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      <StickyNote size={12} className="text-emerald-400 shrink-0" />
                      <span>Notlar ({notesCount})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openLeadModal(lead, 'reminder')}
                      className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                        hasReminder && !lead.reminder_completed
                          ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40'
                          : 'bg-slate-900 hover:bg-slate-700 text-slate-200 border-slate-700'
                      }`}
                    >
                      <Bell size={12} className="text-amber-400 shrink-0" />
                      <span>Hatırlatıcı</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openLeadModal(lead, 'outreach')}
                      className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      <History size={12} className="text-blue-400 shrink-0" />
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
                        title="İşletme İnceleme Raporunu ve Hazır Teklifleri Aç"
                        className="px-2.5 py-2 bg-slate-900 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium"
                      >
                        <FileSearch size={14} />
                        <span>İnceleme</span>
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

      {/* Not Defteri, Hatırlatıcı ve İletişim Geçmişi Modalı */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-slate-800 w-full max-w-2xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="bg-slate-900 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedLead.merchant.name}</h3>
                <p className="text-xs text-slate-400">Müşteri Not Defteri, Geri Arama Hatırlatıcısı ve İletişim Kayıtları</p>
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
            <div className="flex border-b border-slate-700 bg-slate-900/50 px-6 pt-2 gap-4">
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
                onClick={() => setDetailTab('reminder')}
                className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                  detailTab === 'reminder'
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <CalendarClock size={14} />
                <span>Geri Arama Hatırlatıcısı</span>
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
              {detailTab === 'notes' && (
                <>
                  <form onSubmit={handleAddNote} className="space-y-2">
                    <textarea
                      rows={3}
                      value={newNoteText}
                      onChange={e => setNewNoteText(e.target.value)}
                      placeholder="Görüşme detayları, karar verici ismi, fiyat teklifi vb. notunuzu yazınız..."
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
              )}

              {detailTab === 'reminder' && (
                <form onSubmit={handleSaveReminder} className="space-y-5">
                  <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-4 space-y-3">
                    <label className="block text-xs font-bold text-slate-200">
                      Hızlı Zaman Seçimi
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => applyReminderPreset('1h')}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium cursor-pointer"
                      >
                        1 Saat Sonra
                      </button>
                      <button
                        type="button"
                        onClick={() => applyReminderPreset('tomorrow10')}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium cursor-pointer"
                      >
                        Yarın 10:00
                      </button>
                      <button
                        type="button"
                        onClick={() => applyReminderPreset('tomorrow14')}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium cursor-pointer"
                      >
                        Yarın 14:00
                      </button>
                      <button
                        type="button"
                        onClick={() => applyReminderPreset('3d')}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium cursor-pointer"
                      >
                        3 Gün Sonra
                      </button>
                      <button
                        type="button"
                        onClick={() => applyReminderPreset('1w')}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium cursor-pointer"
                      >
                        1 Hafta Sonra
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Tarih ve Saat
                      </label>
                      <input
                        type="datetime-local"
                        value={reminderDateInput}
                        onChange={e => setReminderDateInput(e.target.value)}
                        required
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Hatırlatma Notu
                      </label>
                      <input
                        type="text"
                        value={reminderNoteInput}
                        onChange={e => setReminderNoteInput(e.target.value)}
                        placeholder="Örn: İşletme sahibiyle fiyat görüşülecek"
                        maxLength={140}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      {selectedLead.reminder_at && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleReminderComplete(selectedLead, !selectedLead.reminder_completed)}
                            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 text-xs font-semibold cursor-pointer"
                          >
                            {selectedLead.reminder_completed ? 'Tekrar Aktif Et' : 'Arandı / Tamamlandı İşaretle'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleClearReminder(selectedLead.id)}
                            disabled={isSavingReminder}
                            className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold cursor-pointer"
                          >
                            Hatırlatıcıyı Kaldır
                          </button>
                        </>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingReminder || !reminderDateInput}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Bell size={14} />
                      <span>{isSavingReminder ? 'Kaydediliyor...' : 'Hatırlatıcıyı Kaydet'}</span>
                    </button>
                  </div>
                </form>
              )}

              {detailTab === 'outreach' && (
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
