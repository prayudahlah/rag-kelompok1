import { Shield, User } from "lucide-react";
import type { Message } from "../types/chat";
import { SourceCard } from "./SourceCard";

interface Props {
  message: Message;
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  const timeStr = message.timestamp.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`chat-message ${isUser ? "chat-message--user" : "chat-message--assistant"}`}>
      <div className={`message__avatar ${isUser ? "message__avatar--user" : "message__avatar--ai"}`}>
        {isUser ? <User size={18} strokeWidth={2} /> : <Shield size={18} strokeWidth={2} />}
      </div>

      <div className="message__body">
        <div className={`message__bubble ${isUser ? "message__bubble--user" : "message__bubble--assistant"}`}>
          {message.content}
        </div>

        <div className="message__meta">
          <span className="message__time">{timeStr}</span>
        </div>

        {!isUser && message.sources && message.sources.length > 0 && (
          <SourceCard sources={message.sources} />
        )}
      </div>
    </div>
  );
}
