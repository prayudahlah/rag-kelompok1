import { Shield, MessageSquare, FileText, Info, ShieldCheck } from "lucide-react";
import type { ActivePage } from "../types/chat";

interface Props {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  collapsed?: boolean;
}

export function Sidebar({ activePage, onNavigate, collapsed }: Props) {
  const navItems = [
    { id: "chat" as const, label: "Chat", icon: MessageSquare },
    { id: "riwayat" as const, label: "Riwayat", icon: FileText },
    { id: "tentang" as const, label: "Tentang", icon: Info },
  ];

  return (
    <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}>
      <div className="sidebar__header">
        <div className="sidebar__logo">
          <Shield size={28} strokeWidth={2} />
        </div>
        {!collapsed && (
          <div className="sidebar__brand">
            <h1 className="sidebar__title">PDP Assistant</h1>
            <span className="sidebar__subtitle">UU 27/2022 &amp; PP 71/2019</span>
          </div>
        )}
      </div>

      <nav className="sidebar__nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              className={`sidebar__nav-item ${isActive ? "sidebar__nav-item--active" : ""}`}
              onClick={() => onNavigate(item.id)}
              title={item.label}
            >
              <Icon size={20} strokeWidth={1.8} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__status sidebar__status--live">
          <ShieldCheck size={16} strokeWidth={2} />
          {!collapsed && (
            <div className="sidebar__status-text">
              <span className="sidebar__status-label">Live Mode</span>
              <span className="sidebar__status-desc">Terhubung ke server</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
