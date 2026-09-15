import { Menu, Trash2 } from "lucide-react";

interface Props {
  hasMessages: boolean;
  onToggleSidebar: () => void;
  onClearChat: () => void;
}

export function Header({ hasMessages, onToggleSidebar, onClearChat }: Props) {
  return (
    <header className="header">
      <button className="header__menu-btn" onClick={onToggleSidebar} title="Toggle sidebar">
        <Menu size={20} strokeWidth={1.8} />
      </button>

      <div className="header__title">PDP Assistant</div>

      <div className="header__actions">
        {hasMessages && (
          <button
            className="header__clear-btn"
            onClick={onClearChat}
            title="Hapus chat dan mulai ulang"
          >
            <Trash2 size={15} strokeWidth={2} />
            <span>Hapus Chat</span>
          </button>
        )}

      </div>
    </header>
  );
}
