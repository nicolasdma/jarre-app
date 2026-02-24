/**
 * CurriculumForm - Modal form for generating an AI curriculum
 *
 * 3 fields: topic, current level, hours per week.
 * Submits to POST /api/curriculum, then redirects to the curriculum page.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import type { Language } from '@/lib/translations';

interface CurriculumFormProps {
  language: Language;
  onClose: () => void;
}

const LEVELS = [
  { value: 'beginner', labelEs: 'Principiante', labelEn: 'Beginner' },
  { value: 'intermediate', labelEs: 'Intermedio', labelEn: 'Intermediate' },
  { value: 'advanced', labelEs: 'Avanzado', labelEn: 'Advanced' },
];

export function CurriculumForm({ language, onClose }: CurriculumFormProps) {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('beginner');
  const [hours, setHours] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEs = language === 'es';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/curriculum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          currentLevel: level,
          hoursPerWeek: hours,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Error generating curriculum');
        setIsSubmitting(false);
        return;
      }

      const data = await res.json();
      router.push(`/curriculum/${data.curriculumId}`);
    } catch {
      setError(isEs ? 'Error de conexión' : 'Connection error');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-j-bg border border-j-border p-8">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 text-j-text-tertiary hover:text-j-text transition-colors disabled:opacity-30"
        >
          <X size={18} />
        </button>

        <h2 className="text-2xl font-light text-j-text mb-2">
          {isEs ? 'Genera tu currícula' : 'Generate your curriculum'}
        </h2>
        <p className="text-sm text-j-text-tertiary mb-8">
          {isEs
            ? 'La IA diseñará un plan de estudio personalizado con recursos reales.'
            : 'AI will design a personalized study plan with real resources.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Topic */}
          <div>
            <label className="block font-mono text-[10px] tracking-[0.2em] text-j-text-tertiary uppercase mb-2">
              {isEs ? 'Tema' : 'Topic'}
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={isSubmitting}
              placeholder={isEs ? 'Machine Learning, NLP, Distributed Systems...' : 'Machine Learning, NLP, Distributed Systems...'}
              className="w-full px-4 py-3 bg-j-bg border border-j-border text-j-text text-sm placeholder:text-j-text-tertiary focus:border-j-accent focus:outline-none disabled:opacity-60 transition-colors"
            />
          </div>

          {/* Level */}
          <div>
            <label className="block font-mono text-[10px] tracking-[0.2em] text-j-text-tertiary uppercase mb-2">
              {isEs ? 'Nivel actual' : 'Current level'}
            </label>
            <div className="flex gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setLevel(l.value)}
                  disabled={isSubmitting}
                  className={`flex-1 px-3 py-2.5 text-xs font-mono border transition-colors disabled:opacity-60 ${
                    level === l.value
                      ? 'border-j-accent text-j-accent bg-j-accent/5'
                      : 'border-j-border text-j-text-tertiary hover:border-j-text-secondary'
                  }`}
                >
                  {isEs ? l.labelEs : l.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Hours per week */}
          <div>
            <label className="block font-mono text-[10px] tracking-[0.2em] text-j-text-tertiary uppercase mb-2">
              {isEs ? 'Horas por semana' : 'Hours per week'}
              <span className="ml-2 text-j-text-secondary">{hours}h</span>
            </label>
            <input
              type="range"
              min={1}
              max={40}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              disabled={isSubmitting}
              className="w-full accent-j-accent"
            />
            <div className="flex justify-between text-[10px] font-mono text-j-text-tertiary mt-1">
              <span>1h</span>
              <span>40h</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-j-error">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!topic.trim() || isSubmitting}
            className="w-full py-3 bg-j-text text-j-bg font-mono text-xs tracking-[0.15em] uppercase hover:bg-j-accent transition-colors disabled:opacity-30 disabled:hover:bg-j-text"
          >
            {isSubmitting
              ? (isEs ? 'Diseñando currícula...' : 'Designing curriculum...')
              : (isEs ? 'Generar currícula' : 'Generate curriculum')}
          </button>

          {isSubmitting && (
            <p className="text-center text-[11px] font-mono text-j-text-tertiary animate-pulse">
              {isEs ? 'Esto puede tomar ~30 segundos' : 'This may take ~30 seconds'}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
