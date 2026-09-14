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

export function saveSession(messages: Message[]): HistorySession | null {
  if (messages.length === 0) return null;

  const firstUserMsg = messages.find((m) => m.role === "user");
  const title = firstUserMsg?.content.slice(0, 60) || "Percakapan baru";

  const session: HistorySession = {
    id: `session-${Date.now()}`,
    title,
    timestamp: new Date().toISOString(),
    messages,
  };

  const history = loadHistory();
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

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}
