import { useState, useCallback, useRef } from "react";
import type { Message, HistorySession } from "../types/chat";
import { sendQuestion } from "../services/chatService";
import { saveSession, loadHistory, deleteSession } from "../services/historyService";

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `msg-${Date.now()}-${idCounter}`;
}

const HISTORY_WINDOW = 6;

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistorySession[]>(() => loadHistory());
  const messagesRef = useRef<Message[]>([]);

  const sendMessage = useCallback(async (question: string) => {
    const userMessage: Message = {
      id: nextId(),
      role: "user",
      content: question,
      timestamp: new Date(),
    };

    const currentMessages = messagesRef.current;
    const historyForRewrite = currentMessages.slice(-HISTORY_WINDOW);

    setMessages((prev) => {
      messagesRef.current = [...prev, userMessage];
      return [...prev, userMessage];
    });
    setLoading(true);
    setError(null);

    try {
      const response = await sendQuestion(question, historyForRewrite);

      const assistantMessage: Message = {
        id: nextId(),
        role: "assistant",
        content: response.answer,
        sources: response.sources,
        timestamp: new Date(),
      };

      setMessages((prev) => {
        const updated = [...prev, assistantMessage];
        messagesRef.current = updated;
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
    messagesRef.current = [];
    setMessages([]);
    setError(null);
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  const loadSession = useCallback((session: HistorySession) => {
    messagesRef.current = session.messages;
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
