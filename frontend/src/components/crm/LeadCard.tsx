import React from 'react';
import {
  Trash2,
  ExternalLink,
  Phone,
  MessageSquare,
  StickyNote,
  History,
  X,
  Mail,
  FileSearch,
  Bell,
  Clock
} from 'lucide-react';
import type { Merchant, SavedLead } from '../../types';
import { LEAD_STATUS_OPTIONS } from './crmConstants';

interface LeadCardProps {
  lead: SavedLead;
  nowMs: number;
  confirmDeleteLeadId: number | null;
  onSetConfirmDelete: (id: number | null) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, status: string) => void;
  onToggleReminderComplete: (lead: SavedLead, completed: boolean) => void;
  onOpenModal: (lead: SavedLead, tab: 'notes' | 'reminder' | 'outreach') => void;
  onWhatsAppOutreach: (lead: SavedLead) => void;
  onEmailOutreach: (lead: SavedLead) => void;
  onInspectMerchant?: (merchant: Merchant) => void;
}

export const LeadCard: React.FC<LeadCardProps> = ({
  lead,
  nowMs,
  confirmDeleteLeadId,
  onSetConfirmDelete,
  onDelete,
  onStatusChange,
  onToggleReminderComplete,
  onOpenModal,
  onWhatsAppOutreach,
  onEmailOutreach,
  onInspectMerchant
}) => {
  const notesCount = lead.notes?.length || 0;
  const outreachCount = lead.outreach_logs?.length || 0;
  const lastNote = notesCount > 0 && lead.notes ? lead.notes[0] : null;
  const hasReminder = Boolean(lead.reminder_at);
  const reminderMs = lead.reminder_at ? new Date(lead.reminder_at).getTime() : 0;
  const isReminderDue = hasReminder && !lead.reminder_completed && reminderMs <= nowMs;

  return (
    <div
      className={`bg-[var(--theme-surface)] rounded-xl border transition-all p-5 flex flex-col justify-between shadow-lg ${
        isReminderDue
          ? 'border-amber-500/70 ring-1 ring-amber-500/30'
          : 'border-[var(--theme-border)] hover:border-[var(--theme-primary)]/50'
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h3 className="font-bold text-base text-[var(--theme-contrast)] truncate">{lead.merchant.name}</h3>
            <p className="text-xs text-[var(--theme-contrast)]/80 capitalize">{lead.merchant.category || 'Yerel İşletme'}</p>
          </div>
          <span className="text-xs font-black px-2 py-0.5 rounded bg-[var(--theme-muted)] text-[var(--theme-contrast)] border border-[var(--theme-border)] shrink-0">
            {lead.opportunity_score}/100 Puan
          </span>
        </div>

        {hasReminder && lead.reminder_at && (
          <div
            className={`mb-3 px-3 py-2.5 rounded-lg border text-xs flex items-start justify-between gap-2 ${
              lead.reminder_completed
                ? 'bg-[var(--theme-canvas)] border-[var(--theme-border)] text-[var(--theme-contrast)]'
                : isReminderDue
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-400'
                  : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
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
                  {new Date(lead.reminder_at).toLocaleString('tr-TR', {
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
                onClick={() => onToggleReminderComplete(lead, true)}
                title="Arandı / Tamamlandı Olarak İşaretle"
                className="px-2 py-1 rounded bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] font-bold text-[11px] shrink-0 cursor-pointer"
              >
                Tamamla
              </button>
            )}
          </div>
        )}

        <div className="space-y-1.5 text-xs text-[var(--theme-contrast)] my-3 bg-[var(--theme-canvas)] p-3 rounded-lg border border-[var(--theme-border)]">
          {lead.merchant.address && (
            <p className="truncate text-[var(--theme-contrast)]/80">Adres: {lead.merchant.address}</p>
          )}
          {lead.merchant.phone ? (
            <p className="text-[var(--theme-contrast)] font-semibold">Tel: {lead.merchant.phone}</p>
          ) : (
            <p className="text-[var(--theme-contrast)]/60 italic">Tel: Belirtilmemiş</p>
          )}
          {lead.merchant.email && (
            <p className="text-[var(--theme-contrast)] truncate">E-posta: {lead.merchant.email}</p>
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

        {lastNote && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-[var(--theme-canvas)] border border-[var(--theme-border)] text-xs">
            <p className="text-[11px] text-[var(--theme-primary)] font-semibold mb-0.5">Son Görüşme Notu:</p>
            <p className="text-[var(--theme-contrast)] line-clamp-2">{lastNote.content}</p>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-[var(--theme-border)] space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-[var(--theme-contrast)]/80">Aşama:</span>
          <select
            value={lead.status}
            onChange={e => onStatusChange(lead.id, e.target.value)}
            className="bg-[var(--theme-canvas)] border border-[var(--theme-border)] text-xs rounded-lg px-2.5 py-1 text-[var(--theme-contrast)] focus:outline-none focus:border-[var(--theme-primary)] cursor-pointer"
          >
            {LEAD_STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => onOpenModal(lead, 'notes')}
            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-[var(--theme-canvas)] hover:bg-[var(--theme-muted)] text-[var(--theme-contrast)] border border-[var(--theme-border)] text-[11px] font-medium transition-colors cursor-pointer"
          >
            <StickyNote size={12} className="text-[var(--theme-primary)] shrink-0" />
            <span>Notlar ({notesCount})</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenModal(lead, 'reminder')}
            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-[var(--theme-canvas)] hover:bg-[var(--theme-muted)] text-[var(--theme-contrast)] border border-[var(--theme-border)] text-[11px] font-medium transition-colors cursor-pointer"
          >
            <Bell size={12} className="text-[var(--theme-primary)] shrink-0" />
            <span>Hatırlatıcı</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenModal(lead, 'outreach')}
            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-[var(--theme-canvas)] hover:bg-[var(--theme-muted)] text-[var(--theme-contrast)] border border-[var(--theme-border)] text-[11px] font-medium transition-colors cursor-pointer"
          >
            <History size={12} className="text-blue-400 shrink-0" />
            <span>İletişim ({outreachCount})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {lead.merchant.phone ? (
            <button
              type="button"
              onClick={() => onWhatsAppOutreach(lead)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] text-xs font-semibold py-2 rounded-lg transition-colors cursor-pointer"
            >
              <MessageSquare size={14} />
              <span>WhatsApp</span>
            </button>
          ) : (
            <button
              disabled
              className="flex-1 flex items-center justify-center gap-1 bg-[var(--theme-muted)] text-[var(--theme-contrast)]/60 text-xs py-2 rounded-lg cursor-not-allowed"
            >
              <Phone size={13} />
              <span>Tel Yok</span>
            </button>
          )}

          {lead.merchant.email && (
            <button
              type="button"
              onClick={() => onEmailOutreach(lead)}
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
              className="px-2.5 py-2 bg-[var(--theme-canvas)] hover:bg-[var(--theme-muted)] text-[var(--theme-contrast)] border border-[var(--theme-border)] rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium"
            >
              <FileSearch size={14} />
              <span>İnceleme</span>
            </button>
          )}

          {confirmDeleteLeadId === lead.id ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onDelete(lead.id)}
                className="px-2 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold rounded-lg cursor-pointer"
              >
                Sil
              </button>
              <button
                type="button"
                onClick={() => onSetConfirmDelete(null)}
                className="p-1.5 text-[var(--theme-contrast)]/80 hover:text-[var(--theme-contrast)] rounded-lg cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onSetConfirmDelete(lead.id)}
              className="p-2 text-[var(--theme-contrast)]/80 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
              title="Listeden Sil"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
