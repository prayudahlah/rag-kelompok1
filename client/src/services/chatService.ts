import type { ChatResponse, Message } from "../types/chat";
import { findMockResponse } from "../data/mock";

const API_URL = import.meta.env.VITE_API_URL || "";

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export async function sendQuestion(
  question: string,
  history: Message[] = [],
): Promise<ChatResponse> {
  const useMock = import.meta.env.VITE_USE_MOCK === "true";

  if (useMock) {
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 800 + 400));
    return findMockResponse(question);
  }

  const historyMessages: HistoryMessage[] = history
    .filter((msg) => msg.role === "user" || msg.role === "assistant")
    .slice(-6)
    .map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      history: historyMessages.length > 0 ? historyMessages : undefined,
    }),
  });

  if (!res.ok) {
    throw new Error(`Server error: ${res.status}`);
  }

  return res.json();
}
