import type { ChatResponse, Message, SearchMode } from "../types/chat";

const API_URL = import.meta.env.VITE_API_URL || "";

interface ApiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SendOptions {
  k?: number;
  mode?: SearchMode;
}

export async function sendQuestion(
  question: string,
  history: Message[] = [],
  options: SendOptions = {},
): Promise<ChatResponse> {
  const messages: ApiMessage[] = [
    ...history
      .filter((msg) => msg.role === "user" || msg.role === "assistant")
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    { role: "user", content: question },
  ];

  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      k: options.k ?? 6,
      mode: options.mode ?? "hybrid",
    }),
  });

  if (!res.ok) {
    let detail = `Server error: ${res.status}`;

    try {
      const body = (await res.json()) as {
        error?: { message?: string };
      };

      if (body?.error?.message) {
        detail = body.error.message;
      }
    } catch {
      // respons bukan JSON; pakai pesan default
    }

    throw new Error(detail);
  }

  return (await res.json()) as ChatResponse;
}
