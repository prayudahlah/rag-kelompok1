import { Shield, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "../types/chat";
import { SourceCard } from "./SourceCard";
import "../markdown.css";

interface Props {
  message: Message;
}

/**
 * Ubah penanda sitasi [S1], [S2], ... menjadi tautan markdown
 * yang mengarah ke kartu sumber (#source-1, #source-2, ...).
 */
function withCitationLinks(content: string): string {
  return content.replace(
    /\[S(\d+)\]/g,
    (_match, number: string) => `[[S${number}]](#source-${number})`,
  );
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
          {isUser ? (
            message.content
          ) : (
            <div className="markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {withCitationLinks(message.content)}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {!isUser && (message.usedFallback || message.notice) && (
          <div className="message__notice">
            {message.notice ?? "Mode fallback: pencarian kata kunci (FTS)."}
          </div>
        )}

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
