import { useState } from "react";
import { ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import type { Source } from "../types/chat";

interface Props {
  sources: Source[];
}

function pageLabel(source: Source): string {
  if (source.page_end && source.page_end > source.page_start) {
    return `Halaman ${source.page_start}-${source.page_end}`;
  }

  return `Halaman ${source.page_start}`;
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
          <SourceItem
            key={source.chunk_id}
            source={source}
            anchor={index + 1}
            defaultOpen={index === 0 && sources.length <= 2}
          />
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

interface SourceItemProps {
  source: Source;
  anchor: number;
  defaultOpen: boolean;
}

function SourceItem({ source, anchor, defaultOpen }: SourceItemProps) {
  const [open, setOpen] = useState(defaultOpen);

  const snippet =
    source.text.length > 200 ? source.text.substring(0, 200) + "..." : source.text;

  const pasalLabel = source.pasal
    ? source.ayat
      ? `${source.pasal} ayat ${source.ayat}`
      : source.angka != null
        ? `${source.pasal} angka ${source.angka}`
        : source.pasal
    : null;

  return (
    <div
      id={`source-${anchor}`}
      className={`source-card ${open ? "source-card--open" : ""}`}
    >
      <button className="source-card__header" onClick={() => setOpen(!open)}>
        <div className="source-card__meta">
          <span className="source-card__doc">
            [{anchor}] {source.document_title || source.document_id}
          </span>
          {source.context_header && (
            <span className="source-card__context">{source.context_header}</span>
          )}
          {source.bab && (
            <span className="source-card__bab">
              {source.bab}
              {source.bab_title ? ` — ${source.bab_title}` : ""}
            </span>
          )}
          {pasalLabel && <span className="source-card__pasal">{pasalLabel}</span>}
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="source-card__body">
          <blockquote className="source-card__quote">{snippet}</blockquote>
          <div className="source-card__page">{pageLabel(source)}</div>
        </div>
      )}
    </div>
  );
}
