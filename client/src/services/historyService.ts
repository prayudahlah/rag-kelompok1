import type { HistorySession, Message } from "../types/chat";

const STORAGE_KEY = "pdp-chat-history";
const MAX_SESSIONS = 20;

export function loadHistory(): HistorySession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

export function saveSession(messages: Message[], existingSessionId?: string | null): HistorySession | null {
  if (messages.length === 0) return null;

  const firstUserMsg = messages.find((m) => m.role === "user");
  const title = firstUserMsg?.content.slice(0, 60) || "Percakapan baru";

  const history = loadHistory();

  if (existingSessionId) {
    const idx = history.findIndex((s) => s.id === existingSessionId);
    if (idx !== -1) {
      history[idx] = {
        ...history[idx],
        title,
        timestamp: new Date().toISOString(),
        messages,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_SESSIONS)));
      return history[idx];
    }
  }

  const session: HistorySession = {
    id: `session-${Date.now()}`,
    title,
    timestamp: new Date().toISOString(),
    messages,
  };

  history.unshift(session);

  const trimmed = history.slice(0, MAX_SESSIONS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));

  return session;
}

export function deleteSession(sessionId: string): void {
  const history = loadHistory();
  const filtered = history.filter((s) => s.id !== sessionId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

