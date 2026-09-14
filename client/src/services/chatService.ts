import type { ChatResponse } from "../types/chat";
import { findMockResponse } from "../data/mock";

const API_URL = import.meta.env.VITE_API_URL || "";

export async function sendQuestion(question: string): Promise<ChatResponse> {
  const useMock = import.meta.env.VITE_USE_MOCK === "true";

  if (useMock) {
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 800 + 400));
    return findMockResponse(question);
  }

  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  if (!res.ok) {
    throw new Error(`Server error: ${res.status}`);
  }

  return res.json();
}
