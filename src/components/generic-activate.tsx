/**
 * GenericActivate - Generic ACTIVATE component for auto-generated resources
 *
 * Renders an advance organizer from activate_data JSONB.
 * Mimics the style of hand-crafted TSX components (e.g., kz2h-micrograd.tsx).
 */

interface ActivateData {
  summary: string;
  sections: Array<{
    number: number;
    title: string;
    description: string;
  }>;
  keyConcepts: string[];
  insight: string;
}

interface GenericActivateProps {
  data: ActivateData;
  title: string;
  pendingTranslation?: boolean;
}

export function GenericActivate({ data, title, pendingTranslation }: GenericActivateProps) {
  return (
    <article className="mx-auto max-w-3xl px-8 py-16 relative">
      {pendingTranslation && (
        <div className="absolute inset-0 z-10 flex items-start justify-center pt-32 pointer-events-none">
          <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-j-text-tertiary bg-j-bg/80 border border-j-border px-4 py-2 backdrop-blur-sm animate-pulse">
            Traduciendo contenido…
          </span>
        </div>
      )}
      <div className={pendingTranslation ? 'opacity-40 select-none' : ''}>
      {/* Hero */}
      <header className="mb-20">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-px bg-j-accent" />
          <span className="font-mono text-[10px] tracking-[0.2em] text-j-text-tertiary uppercase">
            Curso Auto-Generado · YouTube
          </span>
        </div>

        <h1 className="text-4xl font-light text-j-text mb-4">
          {title}
        </h1>

        <p className="text-j-text-secondary leading-relaxed max-w-xl">
          {data.summary}
        </p>
      </header>

      {/* Sections Preview */}
      <div className="mb-16">
        <p className="font-mono text-[10px] tracking-[0.2em] text-j-text-tertiary uppercase mb-8">
          Lo que vas a aprender
        </p>

        <div className="space-y-6">
          {data.sections.map((section) => (
            <div key={section.number} className="flex items-start gap-4">
              <span className="font-mono text-3xl font-light text-j-border flex-shrink-0 w-10 text-right">
                {section.number.toString().padStart(2, '0')}
              </span>
              <div className="pt-1">
                <h2 className="text-lg text-j-text mb-1">{section.title}</h2>
                <p className="text-sm text-j-text-secondary leading-relaxed">
                  {section.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Concepts */}
      <div className="mb-16">
        <p className="font-mono text-[10px] tracking-[0.2em] text-j-text-tertiary uppercase mb-6">
          Conceptos Clave
        </p>
        <div className="flex flex-wrap gap-2">
          {data.keyConcepts.map((concept) => (
            <span
              key={concept}
              className="px-3 py-1.5 text-xs font-mono border border-j-border text-j-text-secondary"
            >
              {concept}
            </span>
          ))}
        </div>
      </div>

      {/* Insight */}
      <div className="border-l-2 border-j-accent pl-6 py-2">
        <p className="font-mono text-[10px] tracking-[0.2em] text-j-accent uppercase mb-2">
          Insight
        </p>
        <p className="text-j-text leading-relaxed">
          {data.insight}
        </p>
      </div>
      </div>
    </article>
  );
}
