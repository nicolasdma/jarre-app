'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Language } from '@/lib/translations';

const STAGE_LABELS: Record<string, Record<string, string>> = {
  es: {
    resolve: 'Descargando transcripción...',
    segment: 'Segmentando contenido...',
    content: 'Generando secciones...',
    video_map: 'Mapeando video...',
    concepts: 'Enlazando conceptos...',
    write_db: 'Guardando en base de datos...',
  },
  en: {
    resolve: 'Downloading transcript...',
    segment: 'Segmenting content...',
    content: 'Generating sections...',
    video_map: 'Mapping video...',
    concepts: 'Linking concepts...',
    write_db: 'Writing to database...',
  },
};

export function CreateCourseModal({
  onClose,
  language,
  onComplete,
}: {
  onClose: () => void;
  language: Language;
  onComplete: () => void;
}) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle'); // idle | polling | completed | failed
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [stagesCompleted, setStagesCompleted] = useState(0);
  const [totalStages, setTotalStages] = useState(6);
  const [error, setError] = useState<string | null>(null);
  const [resourceId, setResourceId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!url.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), title: title.trim() || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Error creating course');
        setSubmitting(false);
        return;
      }

      const data = await res.json();
      setJobId(data.jobId);
      setStatus('polling');
    } catch {
      setError(language === 'es' ? 'Error de conexión' : 'Connection error');
    } finally {
      setSubmitting(false);
    }
  };

  // Poll for pipeline status
  useEffect(() => {
    if (status !== 'polling' || !jobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/pipeline/${jobId}`);
        if (!res.ok) return;

        const data = await res.json();
        setCurrentStage(data.currentStage);
        setStagesCompleted(data.stagesCompleted);
        setTotalStages(data.totalStages);

        if (data.status === 'completed') {
          setStatus('completed');
          setResourceId(data.resourceId);
          clearInterval(interval);
        } else if (data.status === 'failed') {
          setStatus('failed');
          setError(data.error || 'Pipeline failed');
          clearInterval(interval);
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [status, jobId]);

  const progressPercent = totalStages > 0 ? Math.round((stagesCompleted / totalStages) * 100) : 0;
  const labels = STAGE_LABELS[language] || STAGE_LABELS.es;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-j-bg border border-j-border w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg text-j-text">
            {language === 'es' ? 'Crear Curso desde YouTube' : 'Create Course from YouTube'}
          </h2>
          <button
            onClick={onClose}
            className="text-j-text-tertiary hover:text-j-text transition-colors text-xl"
          >
            ×
          </button>
        </div>

        {status === 'idle' && (
          <>
            <div className="space-y-4">
              <div>
                <label className="font-mono text-[10px] tracking-[0.2em] text-j-text-tertiary uppercase block mb-2">
                  YouTube URL *
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-3 py-2 border border-j-border bg-transparent text-j-text text-sm focus:border-j-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] tracking-[0.2em] text-j-text-tertiary uppercase block mb-2">
                  {language === 'es' ? 'Título (opcional)' : 'Title (optional)'}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={language === 'es' ? 'Se detecta automáticamente' : 'Auto-detected from video'}
                  className="w-full px-3 py-2 border border-j-border bg-transparent text-j-text text-sm focus:border-j-accent focus:outline-none"
                />
              </div>
            </div>

            {error && (
              <p className="mt-4 text-sm text-j-error">{error}</p>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={onClose}
                className="px-4 py-2 font-mono text-[11px] tracking-[0.15em] uppercase text-j-text-tertiary hover:text-j-text transition-colors"
              >
                {language === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !url.trim()}
                className="px-4 py-2 font-mono text-[11px] tracking-[0.15em] uppercase bg-j-accent text-j-text-on-accent hover:bg-j-accent-hover transition-colors disabled:opacity-50"
              >
                {submitting
                  ? (language === 'es' ? 'Creando...' : 'Creating...')
                  : (language === 'es' ? 'Crear Curso' : 'Create Course')}
              </button>
            </div>
          </>
        )}

        {(status === 'polling' || status === 'completed' || status === 'failed') && (
          <div className="space-y-4">
            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] tracking-[0.15em] text-j-text-tertiary uppercase">
                  {language === 'es' ? 'Progreso' : 'Progress'}
                </span>
                <span className="font-mono text-[10px] text-j-text-tertiary">
                  {stagesCompleted}/{totalStages}
                </span>
              </div>
              <div className="w-full h-2 bg-j-border overflow-hidden">
                <div
                  className="h-full bg-j-accent transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Current stage */}
            {status === 'polling' && currentStage && (
              <p className="text-sm text-j-text-secondary animate-pulse">
                {labels[currentStage] || currentStage}
              </p>
            )}

            {/* Completed */}
            {status === 'completed' && (
              <div className="text-center py-4">
                <p className="text-j-accent mb-4">
                  {language === 'es' ? '¡Curso creado exitosamente!' : 'Course created successfully!'}
                </p>
                <button
                  onClick={() => {
                    if (resourceId) {
                      router.push(`/learn/${resourceId}`);
                    } else {
                      onComplete();
                    }
                  }}
                  className="px-6 py-2 font-mono text-[11px] tracking-[0.15em] uppercase bg-j-accent text-j-text-on-accent hover:bg-j-accent-hover transition-colors"
                >
                  {language === 'es' ? 'Ir al Curso →' : 'Go to Course →'}
                </button>
              </div>
            )}

            {/* Failed */}
            {status === 'failed' && (
              <div className="py-4">
                <p className="text-j-error text-sm mb-2">
                  {language === 'es' ? 'Error en el pipeline:' : 'Pipeline error:'}
                </p>
                <p className="text-xs text-j-text-secondary">{error}</p>
                <button
                  onClick={() => {
                    setStatus('idle');
                    setJobId(null);
                    setError(null);
                    setStagesCompleted(0);
                  }}
                  className="mt-4 px-4 py-2 font-mono text-[11px] tracking-[0.15em] uppercase border border-j-border text-j-text-tertiary hover:text-j-text transition-colors"
                >
                  {language === 'es' ? 'Intentar de nuevo' : 'Try again'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
