import { Shield } from "lucide-react";

export function LoadingIndicator() {
  return (
    <div className="chat-message chat-message--assistant">
      <div className="message__avatar message__avatar--ai">
        <Shield size={18} strokeWidth={2} />
      </div>
      <div className="message__body">
        <div className="message__bubble message__bubble--assistant message__bubble--loading">
          <div className="loading">
            <span className="loading__text">Memproses jawaban...</span>
            <div className="loading__dots">
              <span className="loading__dot loading__dot--active" />
              <span className="loading__dot loading__dot--active" />
              <span className="loading__dot loading__dot--active" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
