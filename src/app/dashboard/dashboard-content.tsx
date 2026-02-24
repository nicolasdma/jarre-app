'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowUp } from 'lucide-react';
import type { Language } from '@/lib/translations';
import { PipelineCourseCard, type PipelineCourseData } from './pipeline-course-card';

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

type PipelineStatus = 'idle' | 'submitting' | 'polling' | 'completed' | 'failed';

interface DashboardStats {
  totalCourses: number;
  totalSections: number;
  evaluatedCount: number;
  avgScore: number;
}

interface DashboardContentProps {
  courses: PipelineCourseData[];
  language: Language;
  stats: DashboardStats;
}

export function DashboardContent({ courses, language, stats }: DashboardContentProps) {
  const router = useRouter();
  const [url, setUrl] = useState('');

  // Pipeline state
  const [status, setStatus] = useState<PipelineStatus>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [stagesCompleted, setStagesCompleted] = useState(0);
  const [totalStages, setTotalStages] = useState(6);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [resourceId, setResourceId] = useState<string | null>(null);

  const isProcessing = status === 'submitting' || status === 'polling';
  const labels = STAGE_LABELS[language] || STAGE_LABELS.es;
  const progressPercent = totalStages > 0 ? Math.round((stagesCompleted / totalStages) * 100) : 0;

  const handleSubmit = async () => {
    const trimmed = url.trim();
    if (!trimmed || isProcessing) return;

    setStatus('submitting');
    setError(null);
    setNeedsAuth(false);

    try {
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });

      if (res.status === 401) {
        setNeedsAuth(true);
        setStatus('failed');
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Error creating course');
        setStatus('failed');
        return;
      }

      const data = await res.json();

      if (data.alreadyExists) {
        setResourceId(data.resourceId);
        setStatus('completed');
        return;
      }

      setJobId(data.jobId);
      setStatus('polling');
    } catch {
      setError(language === 'es' ? 'Error de conexión' : 'Connection error');
      setStatus('failed');
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

  // Auto-navigate on completion
  useEffect(() => {
    if (status === 'completed' && resourceId) {
      router.push(`/learn/${resourceId}`);
    }
  }, [status, resourceId, router]);

  const resetPipeline = () => {
    setStatus('idle');
    setJobId(null);
    setError(null);
    setNeedsAuth(false);
    setUrl('');
    setStagesCompleted(0);
    setCurrentStage(null);
    setResourceId(null);
  };

  return (
    <>
      {/* Hero Input */}
      <div className="mb-12">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="relative"
        >
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isProcessing}
            placeholder={language === 'es' ? 'Aprende cualquier cosa' : 'Learn anything'}
            className="w-full pl-5 pr-14 py-4 bg-j-surface border border-j-border rounded-full text-j-text text-base placeholder:text-j-text-tertiary focus:border-j-accent focus:outline-none disabled:opacity-60 transition-colors"
          />
          <button
            type="submit"
            disabled={!url.trim() || isProcessing}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-j-text text-j-bg hover:bg-j-accent transition-colors disabled:opacity-30 disabled:hover:bg-j-text"
          >
            <ArrowUp size={18} />
          </button>
        </form>

        {/* Inline progress */}
        {isProcessing && (
          <div className="mt-4 px-2">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 h-1 bg-j-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-j-accent rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(progressPercent, 5)}%` }}
                />
              </div>
              <span className="font-mono text-[10px] text-j-text-tertiary shrink-0">
                {stagesCompleted}/{totalStages}
              </span>
            </div>
            {currentStage && (
              <p className="font-mono text-[11px] text-j-text-secondary animate-pulse">
                {labels[currentStage] || currentStage}
              </p>
            )}
            {status === 'submitting' && (
              <p className="font-mono text-[11px] text-j-text-secondary animate-pulse">
                {language === 'es' ? 'Iniciando pipeline...' : 'Starting pipeline...'}
              </p>
            )}
          </div>
        )}

        {/* Auth required */}
        {status === 'failed' && needsAuth && (
          <div className="mt-4 px-2 flex items-center gap-3">
            <p className="text-sm text-j-text-secondary flex-1">
              {language === 'es'
                ? 'Inicia sesión para generar cursos.'
                : 'Log in to generate courses.'}
              {' '}
              <Link href="/login" className="text-j-accent hover:underline">
                {language === 'es' ? 'Iniciar sesión' : 'Log in'}
              </Link>
            </p>
          </div>
        )}

        {/* Error */}
        {status === 'failed' && !needsAuth && error && (
          <div className="mt-4 px-2 flex items-center gap-3">
            <p className="text-sm text-j-error flex-1">{error}</p>
            <button
              onClick={resetPipeline}
              className="font-mono text-[11px] tracking-[0.15em] uppercase text-j-text-tertiary hover:text-j-text transition-colors shrink-0"
            >
              {language === 'es' ? 'Reintentar' : 'Retry'}
            </button>
          </div>
        )}

        {/* Completed (brief flash before redirect) */}
        {status === 'completed' && (
          <div className="mt-4 px-2">
            <p className="font-mono text-[11px] text-j-accent">
              {language === 'es' ? 'Curso creado — redirigiendo...' : 'Course created — redirecting...'}
            </p>
          </div>
        )}

      </div>

      {/* Section header */}
      {courses.length > 0 && (
        <h2 className="font-mono text-[10px] tracking-[0.2em] text-j-text-tertiary uppercase mb-6">
          {language === 'es' ? 'Cursos' : 'Courses'}
          <span className="ml-2 text-j-text-secondary">({courses.length})</span>
        </h2>
      )}

      {/* Course grid */}
      {courses.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <PipelineCourseCard key={course.id} course={course} language={language} />
          ))}
        </div>
      )}

      {/* Empty state — only when idle and no courses */}
      {courses.length === 0 && status === 'idle' && (
        <div className="text-center py-12">
          <p className="text-sm text-j-text-tertiary">
            {language === 'es'
              ? 'Pega un link de YouTube arriba para generar tu primer curso.'
              : 'Paste a YouTube link above to generate your first course.'}
          </p>
        </div>
      )}
    </>
  );
}
