import { Shield, ArrowRight } from "lucide-react";

interface Props {
  onSend: (question: string) => void;
}

const sampleQuestions = [
  "Apa itu data pribadi?",
  "Apa saja hak subjek data pribadi?",
  "Siapa yang mengatur pelindungan data pribadi?",
  "Apa sanksi pelanggaran UU PDP?",
];

export function WelcomeScreen({ onSend }: Props) {
  return (
    <div className="welcome">
      <div className="welcome__icon">
        <Shield size={56} strokeWidth={1.5} />
      </div>
      <h2 className="welcome__title">Selamat datang di PDP Assistant</h2>
      <p className="welcome__desc">
        Tanyakan apa saja tentang UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.
      </p>

      <div className="welcome__samples">
        <p className="welcome__samples-label">Contoh pertanyaan:</p>
        <div className="welcome__samples-grid">
          {sampleQuestions.map((q) => (
            <button
              key={q}
              className="welcome__sample-card"
              onClick={() => onSend(q)}
            >
              <span className="welcome__sample-text">{q}</span>
              <ArrowRight size={16} strokeWidth={2} className="welcome__sample-arrow" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
