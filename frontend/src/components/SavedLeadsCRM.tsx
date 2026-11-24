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
import type { Merchant, SavedLead } from '../types';
import {
  Building2,
  Search,
  Download,
  CheckCircle2,
  AlertCircle,
  Bell
} from 'lucide-react';
import { LeadCard } from './crm/LeadCard';
import { LEAD_STATUS_OPTIONS } from './crm/crmConstants';
import { LeadDetailModal } from './crm/LeadDetailModal';

export type { SavedLead };

interface SavedLeadsCRMProps {
  token: string;
  onLeadCountChange?: (count: number) => void;
  onInspectMerchant?: (merchant: Merchant) => void;
  onRemindersUpdated?: () => void;
}

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
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmDeleteLeadId, setConfirmDeleteLeadId] = useState<number | null>(null);

  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<'notes' | 'reminder' | 'outreach'>('notes');
  const [newNoteText, setNewNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  const [reminderDateInput, setReminderDateInput] = useState('');
  const [reminderNoteInput, setReminderNoteInput] = useState('');
  const [isSavingReminder, setIsSavingReminder] = useState(false);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 9;

  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3500);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getSavedLeads(token)
      .then(data => {
        if (cancelled) return;
        setLeads(data);
        if (onLeadCountChange) onLeadCountChange(data.length);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = (err instanceof Error ? err.message : '') || 'Müşteri listesi yüklenemedi.';
        setFeedback({ type: 'error', message: msg });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, onLeadCountChange]);

  const openLeadModal = (lead: SavedLead, tab: 'notes' | 'reminder' | 'outreach') => {
    setSelectedLeadId(lead.id);
    setDetailTab(tab);
    if (lead.reminder_at) {
      const dt = new Date(lead.reminder_at);
      setReminderDateInput(!isNaN(dt.getTime()) ? toLocalDatetimeInputValue(dt) : '');
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
    if (preset === '1h') d.setHours(d.getHours() + 1);
    else if (preset === 'tomorrow10') {
      d.setDate(d.getDate() + 1);
      d.setHours(10, 0, 0, 0);
    } else if (preset === 'tomorrow14') {
      d.setDate(d.getDate() + 1);
      d.setHours(14, 0, 0, 0);
    } else if (preset === '3d') {
      d.setDate(d.getDate() + 3);
      d.setHours(11, 0, 0, 0);
    } else {
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
    } catch (err: unknown) {
      showToast('error', (err instanceof Error ? err.message : '') || 'Hatırlatıcı kaydedilemedi.');
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
    } catch (err: unknown) {
      showToast('error', (err instanceof Error ? err.message : '') || 'Hatırlatıcı güncellenemedi.');
    }
  };

  const handleClearReminder = async (leadId: number) => {
    setIsSavingReminder(true);
    try {
      const updated = await updateLeadReminder(
        leadId,
        { reminder_at: null, reminder_note: null, reminder_completed: false },
        token
      );
      setLeads(prev => prev.map(l => (l.id === leadId ? updated : l)));
      setReminderDateInput('');
      setReminderNoteInput('');
      if (onRemindersUpdated) onRemindersUpdated();
      showToast('success', 'Hatırlatıcı kaldırıldı.');
    } catch (err: unknown) {
      showToast('error', (err instanceof Error ? err.message : '') || 'Hatırlatıcı silinemedi.');
    } finally {
      setIsSavingReminder(false);
    }
  };

  const handleStatusChange = async (leadId: number, newStatus: string) => {
    try {
      await updateLeadStatus(leadId, newStatus, token);
      setLeads(prev => prev.map(lead => (lead.id === leadId ? { ...lead, status: newStatus } : lead)));
      showToast('success', 'Müşteri aşaması güncellendi.');
    } catch (err: unknown) {
      showToast('error', (err instanceof Error ? err.message : '') || 'Durum güncellenirken hata oluştu.');
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
    } catch (err: unknown) {
      showToast('error', (err instanceof Error ? err.message : '') || 'Silme işlemi sırasında hata oluştu.');
    }
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      await exportLeadsCsv(token);
      showToast('success', 'Müşteri listesi CSV olarak indirildi.');
    } catch (err: unknown) {
      showToast('error', (err instanceof Error ? err.message : '') || 'Dışa aktarım başarısız oldu.');
    } finally {
      setIsExporting(false);
    }
  };

  const getCustomPitchMessage = (lead: SavedLead, channel: 'WhatsApp' | 'Email') => {
    const audit = lead.merchant.audit_data;
    if (channel === 'WhatsApp' && audit?.sales_pitch_whatsapp) return audit.sales_pitch_whatsapp;
    if (channel === 'Email' && audit?.sales_pitch_email) return audit.sales_pitch_email;
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
    window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msgText)}`, '_blank', 'noopener,noreferrer');

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
    } catch {
      // Iletisim kaydi opsiyonel
    }
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
    } catch {
      // Iletisim kaydi opsiyonel
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId || !newNoteText.trim() || isSavingNote) return;
    setIsSavingNote(true);
    try {
      const note = await addLeadNote(selectedLeadId, newNoteText.trim(), token);
      setLeads(prev =>
        prev.map(l => (l.id === selectedLeadId ? { ...l, notes: [note, ...(l.notes || [])] } : l))
      );
      setNewNoteText('');
      showToast('success', 'Görüşme notu kaydedildi.');
    } catch (err: unknown) {
      showToast('error', (err instanceof Error ? err.message : '') || 'Not kaydedilemedi.');
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
          l.id === leadId ? { ...l, notes: (l.notes || []).map(n => (n.id === noteId ? updated : n)) } : l
        )
      );
      setEditingNoteId(null);
      setEditingNoteText('');
      showToast('success', 'Not güncellendi.');
    } catch (err: unknown) {
      showToast('error', (err instanceof Error ? err.message : '') || 'Not güncellenemedi.');
    }
  };

  const handleRemoveNote = async (leadId: number, noteId: number) => {
    try {
      await deleteLeadNote(leadId, noteId, token);
      setLeads(prev =>
        prev.map(l => (l.id === leadId ? { ...l, notes: (l.notes || []).filter(n => n.id !== noteId) } : l))
      );
      showToast('success', 'Not silindi.');
    } catch (err: unknown) {
      showToast('error', (err instanceof Error ? err.message : '') || 'Not silinemedi.');
    }
  };

  const selectedLead = leads.find(l => l.id === selectedLeadId) || null;
  const activeReminders = leads.filter(l => l.reminder_at && !l.reminder_completed);
  const dueReminders = activeReminders.filter(l => l.reminder_at && new Date(l.reminder_at).getTime() <= nowMs);

  const filteredLeads = leads.filter(lead => {
    const q = search.toLowerCase();
    const matchesSearch =
      lead.merchant.name.toLowerCase().includes(q) ||
      (lead.merchant.category && lead.merchant.category.toLowerCase().includes(q)) ||
      (lead.merchant.address && lead.merchant.address.toLowerCase().includes(q));
    if (!matchesSearch) return false;
    if (statusFilter === 'reminders') return Boolean(lead.reminder_at && !lead.reminder_completed);
    return statusFilter === 'all' || lead.status === statusFilter;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedLeads = filteredLeads.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  return (
    <div className="space-y-6 relative">
      {feedback && (
        <div
          className={`fixed bottom-6 right-6 z-[9998] flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-[var(--theme-canvas)] border-[var(--theme-border)] text-[var(--theme-contrast)]'
              : 'bg-[var(--theme-canvas)] border-rose-500/50 text-rose-400'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 size={16} className="text-[var(--theme-primary)] shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {dueReminders.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Bell size={20} className="text-amber-400 shrink-0 mt-0.5 animate-bounce" />
            <div>
              <h4 className="text-sm font-bold text-amber-400">
                Geri Arama Zamanı Gelen {dueReminders.length} Müşteri Var
              </h4>
              <p className="text-xs text-[var(--theme-contrast)]/80 mt-0.5">
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

      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between bg-[var(--theme-surface)] p-4 rounded-xl border border-[var(--theme-border)]">
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-2.5 text-[var(--theme-contrast)]/80" size={18} />
          <input
            type="text"
            placeholder="İşletme adı, sektör veya adres ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            maxLength={100}
            className="w-full bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-lg pl-10 pr-4 py-2 text-sm text-[var(--theme-contrast)] focus:outline-none focus:border-[var(--theme-primary)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)] border-[var(--theme-border)]'
                : 'bg-[var(--theme-canvas)] text-[var(--theme-contrast)]/80 hover:text-[var(--theme-contrast)] border-[var(--theme-border)]'
            }`}
          >
            Hepsi ({leads.length})
          </button>

          <button
            onClick={() => setStatusFilter('reminders')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border inline-flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'reminders'
                ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)] border-[var(--theme-border)]'
                : 'bg-[var(--theme-canvas)] text-[var(--theme-contrast)]/80 hover:text-[var(--theme-contrast)] border-[var(--theme-border)]'
            }`}
          >
            <Bell size={13} />
            <span>Hatırlatıcılar ({activeReminders.length})</span>
          </button>

          {LEAD_STATUS_OPTIONS.map(opt => {
            const count = leads.filter(l => l.status === opt.value).length;
            return (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border cursor-pointer ${
                  statusFilter === opt.value
                    ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)] border-[var(--theme-border)]'
                    : 'bg-[var(--theme-canvas)] text-[var(--theme-contrast)]/80 hover:text-[var(--theme-contrast)] border-[var(--theme-border)]'
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
              className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--theme-canvas)] hover:bg-[var(--theme-muted)] text-[var(--theme-contrast)] border border-[var(--theme-border)] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download size={14} />
              <span>{isExporting ? 'Aktarılıyor...' : 'CSV / Excel İndir'}</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--theme-contrast)]/80 animate-pulse">
          Kayıtlı müşteriler yükleniyor...
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-2xl p-12 text-center">
          <Building2 size={48} className="mx-auto text-[var(--theme-contrast)]/60 mb-3" />
          <h3 className="text-lg font-bold text-[var(--theme-contrast)]">Kayıtlı Müşteri Bulunamadı</h3>
          <p className="text-[var(--theme-contrast)]/70 text-sm mt-1 max-w-md mx-auto">
            Harita üzerinden işletmeleri tarayıp İnceleme Raporu ekranındaki
            <span className="text-[var(--theme-primary)] font-semibold"> &quot;Müşteri Listeme Kaydet&quot;</span> butonuna tıklayarak potansiyel müşterilerinizi buraya ekleyebilirsiniz.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedLeads.map(lead => (
              <LeadCard
                key={lead.id}
                lead={lead}
                nowMs={nowMs}
                confirmDeleteLeadId={confirmDeleteLeadId}
                onSetConfirmDelete={setConfirmDeleteLeadId}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
                onToggleReminderComplete={handleToggleReminderComplete}
                onOpenModal={openLeadModal}
                onWhatsAppOutreach={handleWhatsAppOutreach}
                onEmailOutreach={handleEmailOutreach}
                onInspectMerchant={onInspectMerchant}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-[var(--theme-surface)] px-4 py-3 rounded-xl border border-[var(--theme-border)]">
              <span className="text-xs font-semibold text-[var(--theme-contrast)]">
                Toplam {filteredLeads.length} müşteri • Sayfa {safePage} / {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg bg-[var(--theme-canvas)] hover:bg-[var(--theme-muted)] text-[var(--theme-contrast)] border border-[var(--theme-border)] text-xs font-semibold disabled:opacity-40 cursor-pointer"
                >
                  Önceki
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] border border-[var(--theme-border)] text-xs font-semibold disabled:opacity-40 cursor-pointer"
                >
                  Sonraki
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          detailTab={detailTab}
          onSelectTab={setDetailTab}
          onClose={() => {
            setSelectedLeadId(null);
            setEditingNoteId(null);
          }}
          newNoteText={newNoteText}
          onNewNoteTextChange={setNewNoteText}
          isSavingNote={isSavingNote}
          onAddNote={handleAddNote}
          editingNoteId={editingNoteId}
          editingNoteText={editingNoteText}
          onStartEditNote={(noteId, content) => {
            setEditingNoteId(noteId);
            setEditingNoteText(content);
          }}
          onCancelEditNote={() => setEditingNoteId(null)}
          onEditingNoteTextChange={setEditingNoteText}
          onSaveEditedNote={handleSaveEditedNote}
          onRemoveNote={handleRemoveNote}
          reminderDateInput={reminderDateInput}
          onReminderDateInputChange={setReminderDateInput}
          reminderNoteInput={reminderNoteInput}
          onReminderNoteInputChange={setReminderNoteInput}
          isSavingReminder={isSavingReminder}
          onApplyReminderPreset={applyReminderPreset}
          onSaveReminder={handleSaveReminder}
          onToggleReminderComplete={handleToggleReminderComplete}
          onClearReminder={handleClearReminder}
        />
      )}
    </div>
  );
};
