import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  message: string;
  onRetry: () => void;
}

export function ErrorCard({ message, onRetry }: Props) {
  return (
    <div className="error-card">
      <div className="error-card__icon">
        <AlertTriangle size={20} strokeWidth={2} />
      </div>
      <div className="error-card__content">
        <h3 className="error-card__title">Tidak dapat memperoleh jawaban</h3>
        <p className="error-card__desc">
          {message || "Terjadi masalah saat menghubungi server. Silakan coba lagi."}
        </p>
        <button className="error-card__retry" onClick={onRetry}>
          <RefreshCw size={14} strokeWidth={2} />
          Coba lagi
        </button>
      </div>
    </div>
  );
}
