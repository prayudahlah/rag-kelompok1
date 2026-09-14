import { useState, useCallback } from "react";
import type { Message, HistorySession } from "../types/chat";
import { sendQuestion } from "../services/chatService";
import { saveSession, loadHistory, deleteSession } from "../services/historyService";

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `msg-${Date.now()}-${idCounter}`;
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistorySession[]>(() => loadHistory());

  const sendMessage = useCallback(async (question: string) => {
    const userMessage: Message = {
      id: nextId(),
      role: "user",
      content: question,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    setError(null);

    try {
      const response = await sendQuestion(question);

      const assistantMessage: Message = {
        id: nextId(),
        role: "assistant",
        content: response.answer,
        sources: response.sources,
        timestamp: new Date(),
      };

      setMessages((prev) => {
        const updated = [...prev, assistantMessage];
        saveSession(updated);
        setHistory(loadHistory());
        return updated;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan tidak diketahui.");
    } finally {
      setLoading(false);
    }
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  const loadSession = useCallback((session: HistorySession) => {
    setMessages(session.messages);
    setError(null);
  }, []);

  const deleteHistorySession = useCallback((sessionId: string) => {
    deleteSession(sessionId);
    setHistory(loadHistory());
  }, []);

  const refreshHistory = useCallback(() => {
    setHistory(loadHistory());
  }, []);

  return {
    messages,
    loading,
    error,
    history,
    sendMessage,
    clearChat,
    dismissError,
    loadSession,
    deleteHistorySession,
    refreshHistory,
  };
}
