import { useState, useEffect } from "react";
import { Shield } from "lucide-react";

const steps = [
  "Mencari pasal yang relevan...",
  "Mengolah jawaban...",
  "Menyusun jawaban...",
];

export function LoadingIndicator() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="chat-message chat-message--assistant">
      <div className="message__avatar message__avatar--ai">
        <Shield size={18} strokeWidth={2} />
      </div>
      <div className="message__body">
        <div className="message__bubble message__bubble--assistant message__bubble--loading">
          <div className="loading">
            <span className="loading__text">{steps[step]}</span>
            <div className="loading__dots">
              {steps.map((_, i) => (
                <span key={i} className={`loading__dot ${i <= step ? "loading__dot--active" : ""}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
