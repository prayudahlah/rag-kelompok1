import { useState } from "react";
import { ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import type { Source } from "../types/chat";

interface Props {
  sources: Source[];
}

export function SourceCard({ sources }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (sources.length === 0) return null;

  return (
    <div className="source-section">
      <div className="source-section__label">
        <BookOpen size={14} strokeWidth={2} />
        <span>Sumber Jawaban</span>
      </div>

      <div className="source-section__list">
        {sources.map((source, index) => (
          <SourceItem key={source.chunk_id} source={source} defaultOpen={index === 0 && sources.length <= 2} />
        ))}
      </div>

      {sources.length > 2 && (
        <button className="source-section__toggle" onClick={() => setExpanded(!expanded)}>
          {expanded ? (
            <>
              <ChevronUp size={14} /> Sembunyikan sumber lainnya
            </>
          ) : (
            <>
              <ChevronDown size={14} /> Tampilkan {sources.length - 2} sumber lainnya
            </>
          )}
        </button>
      )}
    </div>
  );
}

function SourceItem({ source, defaultOpen }: { source: Source; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  const snippet =
    source.text.length > 200 ? source.text.substring(0, 200) + "..." : source.text;

  return (
    <div className={`source-card ${open ? "source-card--open" : ""}`}>
      <button className="source-card__header" onClick={() => setOpen(!open)}>
        <div className="source-card__meta">
          <span className="source-card__doc">UU No. 27 Tahun 2022</span>
          {source.bab && (
            <span className="source-card__bab">
              {source.bab} — {source.bab_title}
            </span>
          )}
          <span className="source-card__pasal">
            {source.pasal}
            {source.ayat ? ` • Angka ${source.ayat.replace(/[()]/g, "")}` : ""}
          </span>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="source-card__body">
          <blockquote className="source-card__quote">{snippet}</blockquote>
          <div className="source-card__page">Halaman {source.page_start}</div>
        </div>
      )}
    </div>
  );
}
