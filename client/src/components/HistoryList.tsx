import { FileText, Trash2, MessageSquare } from "lucide-react";
import type { HistorySession } from "../types/chat";

interface Props {
  sessions: HistorySession[];
  onSelect: (session: HistorySession) => void;
  onDelete: (sessionId: string) => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistoryList({ sessions, onSelect, onDelete }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="history-empty">
        <FileText size={40} strokeWidth={1.5} />
        <h3>Belum ada riwayat</h3>
        <p>Mulai chat untuk menyimpan riwayat percakapan Anda.</p>
      </div>
    );
  }

  return (
    <div className="history">
      <div className="history__header">
        <h2 className="history__title">Riwayat Percakapan</h2>
        <span className="history__count">{sessions.length} sesi</span>
      </div>

      <div className="history__list">
        {sessions.map((session) => (
          <div key={session.id} className="history-card">
            <button className="history-card__main" onClick={() => onSelect(session)}>
              <div className="history-card__icon">
                <MessageSquare size={16} strokeWidth={2} />
              </div>
              <div className="history-card__info">
                <div className="history-card__title">{session.title}</div>
                <div className="history-card__meta">
                  <span>{formatTime(session.timestamp)}</span>
                  <span>·</span>
                  <span>{session.messages.length} pesan</span>
                </div>
              </div>
            </button>
            <button
              className="history-card__delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(session.id);
              }}
              title="Hapus sesi ini"
            >
              <Trash2 size={14} strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
