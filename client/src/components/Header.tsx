import { Menu, Settings, Trash2 } from "lucide-react";
import type { AppMode } from "../types/chat";

interface Props {
  mode: AppMode;
  hasMessages: boolean;
  onToggleMode: () => void;
  onToggleSidebar: () => void;
  onClearChat: () => void;
}

export function Header({ mode, hasMessages, onToggleMode, onToggleSidebar, onClearChat }: Props) {
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

        <button
          className={`header__mode-toggle header__mode-toggle--${mode}`}
          onClick={onToggleMode}
          title={mode === "mock" ? "Beralih ke Live Mode" : "Beralih ke Demo Mode"}
        >
          <span className="header__mode-dot" />
          {mode === "mock" ? "Demo" : "Live"}
        </button>

        <button className="header__settings-btn" title="Pengaturan">
          <Settings size={18} strokeWidth={1.8} />
        </button>
      </div>
    </header>
  );
}
