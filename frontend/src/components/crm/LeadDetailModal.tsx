import React from 'react';
import {
  Trash2,
  StickyNote,
  History,
  Plus,
  Edit3,
  Check,
  X,
  Bell,
  CalendarClock
} from 'lucide-react';
import type { SavedLead } from '../../types';

interface LeadDetailModalProps {
  lead: SavedLead;
  detailTab: 'notes' | 'reminder' | 'outreach';
  onSelectTab: (tab: 'notes' | 'reminder' | 'outreach') => void;
  onClose: () => void;
  newNoteText: string;
  onNewNoteTextChange: (val: string) => void;
  isSavingNote: boolean;
  onAddNote: (e: React.FormEvent) => void;
  editingNoteId: number | null;
  editingNoteText: string;
  onStartEditNote: (noteId: number, content: string) => void;
  onCancelEditNote: () => void;
  onEditingNoteTextChange: (val: string) => void;
  onSaveEditedNote: (leadId: number, noteId: number) => void;
  onRemoveNote: (leadId: number, noteId: number) => void;
  reminderDateInput: string;
  onReminderDateInputChange: (val: string) => void;
  reminderNoteInput: string;
  onReminderNoteInputChange: (val: string) => void;
  isSavingReminder: boolean;
  onApplyReminderPreset: (preset: '1h' | 'tomorrow10' | 'tomorrow14' | '3d' | '1w') => void;
  onSaveReminder: (e: React.FormEvent) => void;
  onToggleReminderComplete: (lead: SavedLead, completed: boolean) => void;
  onClearReminder: (leadId: number) => void;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  lead,
  detailTab,
  onSelectTab,
  onClose,
  newNoteText,
  onNewNoteTextChange,
  isSavingNote,
  onAddNote,
  editingNoteId,
  editingNoteText,
  onStartEditNote,
  onCancelEditNote,
  onEditingNoteTextChange,
  onSaveEditedNote,
  onRemoveNote,
  reminderDateInput,
  onReminderDateInputChange,
  reminderNoteInput,
  onReminderNoteInputChange,
  isSavingReminder,
  onApplyReminderPreset,
  onSaveReminder,
  onToggleReminderComplete,
  onClearReminder
}) => {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-[var(--theme-surface)] w-full max-w-2xl rounded-2xl border border-[var(--theme-border)] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="bg-[var(--theme-canvas)] px-6 py-4 border-b border-[var(--theme-border)] flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[var(--theme-contrast)]">{lead.merchant.name}</h3>
            <p className="text-xs text-[var(--theme-contrast)]/80">
              Müşteri Not Defteri, Geri Arama Hatırlatıcısı ve İletişim Kayıtları
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-[var(--theme-surface)] hover:bg-[var(--theme-muted)] text-[var(--theme-contrast)]/80 hover:text-[var(--theme-contrast)] border border-[var(--theme-border)] cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex border-b border-[var(--theme-border)] bg-[var(--theme-canvas)] px-6 pt-2 gap-4">
          <button
            type="button"
            onClick={() => onSelectTab('notes')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              detailTab === 'notes'
                ? 'border-[var(--theme-primary)] text-[var(--theme-primary)]'
                : 'border-transparent text-[var(--theme-contrast)]/80 hover:text-[var(--theme-contrast)]'
            }`}
          >
            <StickyNote size={14} />
            <span>Görüşme Notları ({lead.notes?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('reminder')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              detailTab === 'reminder'
                ? 'border-amber-500 text-amber-500'
                : 'border-transparent text-[var(--theme-contrast)]/80 hover:text-[var(--theme-contrast)]'
            }`}
          >
            <CalendarClock size={14} />
            <span>Geri Arama Hatırlatıcısı</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('outreach')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              detailTab === 'outreach'
                ? 'border-[var(--theme-primary)] text-[var(--theme-primary)]'
                : 'border-transparent text-[var(--theme-contrast)]/80 hover:text-[var(--theme-contrast)]'
            }`}
          >
            <History size={14} />
            <span>İletişim Geçmişi ({lead.outreach_logs?.length || 0})</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {detailTab === 'notes' && (
            <>
              <form onSubmit={onAddNote} className="space-y-2">
                <textarea
                  rows={3}
                  value={newNoteText}
                  onChange={e => onNewNoteTextChange(e.target.value)}
                  placeholder="Görüşme detayları, karar verici ismi, fiyat teklifi vb. notunuzu yazınız..."
                  className="w-full bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-xl p-3 text-xs text-[var(--theme-contrast)] placeholder-[var(--theme-contrast)]/50 focus:outline-none focus:border-[var(--theme-primary)]"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingNote || !newNoteText.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>{isSavingNote ? 'Ekleniyor...' : 'Not Ekle'}</span>
                  </button>
                </div>
              </form>

              <div className="space-y-3 pt-2">
                {!lead.notes || lead.notes.length === 0 ? (
                  <p className="text-center text-xs text-[var(--theme-contrast)]/60 py-6">
                    Bu müşteri için henüz görüşme notu eklenmemiş.
                  </p>
                ) : (
                  lead.notes.map(note => (
                    <div
                      key={note.id}
                      className="bg-[var(--theme-canvas)] p-4 rounded-xl border border-[var(--theme-border)] space-y-2"
                    >
                      <div className="flex items-center justify-between text-[11px] text-[var(--theme-contrast)]/80">
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
                            onClick={() => onStartEditNote(note.id, note.content)}
                            className="text-[var(--theme-contrast)]/80 hover:text-[var(--theme-primary)] cursor-pointer"
                            title="Düzenle"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveNote(lead.id, note.id)}
                            className="text-[var(--theme-contrast)]/80 hover:text-rose-400 cursor-pointer"
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
                            onChange={e => onEditingNoteTextChange(e.target.value)}
                            className="w-full bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-lg p-2.5 text-xs text-[var(--theme-contrast)] focus:outline-none focus:border-[var(--theme-primary)]"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={onCancelEditNote}
                              className="px-3 py-1 rounded bg-[var(--theme-surface)] text-[var(--theme-contrast)] border border-[var(--theme-border)] text-xs cursor-pointer"
                            >
                              İptal
                            </button>
                            <button
                              type="button"
                              onClick={() => onSaveEditedNote(lead.id, note.id)}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded bg-[var(--theme-primary)] text-[var(--theme-on-primary)] text-xs font-semibold cursor-pointer"
                            >
                              <Check size={12} />
                              <span>Kaydet</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--theme-contrast)] whitespace-pre-wrap leading-relaxed">
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
            <form onSubmit={onSaveReminder} className="space-y-5">
              <div className="bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-xl p-4 space-y-3">
                <label className="block text-xs font-bold text-[var(--theme-contrast)]">
                  Hızlı Zaman Seçimi
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: '1h' as const, label: '1 Saat Sonra' },
                    { key: 'tomorrow10' as const, label: 'Yarın 10:00' },
                    { key: 'tomorrow14' as const, label: 'Yarın 14:00' },
                    { key: '3d' as const, label: '3 Gün Sonra' },
                    { key: '1w' as const, label: '1 Hafta Sonra' },
                  ].map(preset => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => onApplyReminderPreset(preset.key)}
                      className="px-3 py-1.5 rounded-lg bg-[var(--theme-surface)] hover:bg-[var(--theme-muted)] text-[var(--theme-contrast)] border border-[var(--theme-border)] text-xs font-medium cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1.5">
                    Tarih ve Saat
                  </label>
                  <input
                    type="datetime-local"
                    value={reminderDateInput}
                    onChange={e => onReminderDateInputChange(e.target.value)}
                    required
                    className="w-full bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--theme-contrast)] focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1.5">
                    Hatırlatma Notu
                  </label>
                  <input
                    type="text"
                    value={reminderNoteInput}
                    onChange={e => onReminderNoteInputChange(e.target.value)}
                    placeholder="Örn: İşletme sahibiyle fiyat görüşülecek"
                    maxLength={140}
                    className="w-full bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--theme-contrast)] placeholder-[var(--theme-contrast)]/50 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  {lead.reminder_at && (
                    <>
                      <button
                        type="button"
                        onClick={() => onToggleReminderComplete(lead, !lead.reminder_completed)}
                        className="px-3.5 py-2 rounded-xl bg-[var(--theme-canvas)] hover:bg-[var(--theme-muted)] text-[var(--theme-contrast)] border border-[var(--theme-border)] text-xs font-semibold cursor-pointer"
                      >
                        {lead.reminder_completed ? 'Tekrar Aktif Et' : 'Arandı / Tamamlandı İşaretle'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onClearReminder(lead.id)}
                        disabled={isSavingReminder}
                        className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold cursor-pointer"
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
              {!lead.outreach_logs || lead.outreach_logs.length === 0 ? (
                <p className="text-center text-xs text-[var(--theme-contrast)]/60 py-6">
                  Bu müşteriyle henüz WhatsApp veya E-posta üzerinden kayıtlı bir iletişim başlatılmamış.
                </p>
              ) : (
                lead.outreach_logs.map(log => (
                  <div
                    key={log.id}
                    className="bg-[var(--theme-canvas)] p-4 rounded-xl border border-[var(--theme-border)] space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--theme-primary)]">
                        Kanal: {log.channel}
                      </span>
                      <span className="text-[11px] text-[var(--theme-contrast)]/80">
                        {new Date(log.sent_at).toLocaleString('tr-TR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--theme-contrast)] whitespace-pre-wrap leading-relaxed bg-[var(--theme-surface)] p-3 rounded-lg border border-[var(--theme-border)]">
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
  );
};
