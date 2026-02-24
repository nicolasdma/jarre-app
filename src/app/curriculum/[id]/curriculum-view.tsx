/**
 * CurriculumView - Client component for the curriculum accordion
 *
 * Expandable phases with resource cards.
 * Each pending resource can receive a YouTube URL to trigger materialization.
 * Processing resources poll for pipeline status.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ExternalLink,
  Play,
  FileText,
  BookOpen,
  Search,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { Language } from '@/lib/translations';
import { PIPELINE_POLL_INTERVAL_MS } from '@/lib/constants';

// ============================================================================
// TYPES
// ============================================================================

export interface CurriculumResourceData {
  id: string;
  title: string;
  resourceType: string;
  expectedChannel: string | null;
  searchQuery: string;
  estimatedHours: number;
  status: 'pending' | 'processing' | 'materialized' | 'failed';
  resourceId: string | null;
  pipelineJobId: string | null;
  youtubeUrl: string | null;
}

export interface CurriculumPhaseData {
  id: string;
  phaseNumber: number;
  title: string;
  description: string | null;
  estimatedWeeks: number;
  resources: CurriculumResourceData[];
}

interface CurriculumViewProps {
  curriculumId: string;
  phases: CurriculumPhaseData[];
  language: Language;
}

const TYPE_ICONS: Record<string, typeof Play> = {
  lecture: Play,
  paper: FileText,
  book: BookOpen,
  course: Play,
  article: FileText,
};

// ============================================================================
// COMPONENT
// ============================================================================

export function CurriculumView({ curriculumId, phases, language }: CurriculumViewProps) {
  const isEs = language === 'es';

  // Expand first phase by default
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(
    new Set(phases.length > 0 ? [phases[0].id] : []),
  );

  // Track resource states locally for optimistic updates
  const [resourceStates, setResourceStates] = useState<Record<string, CurriculumResourceData>>(() => {
    const map: Record<string, CurriculumResourceData> = {};
    for (const phase of phases) {
      for (const r of phase.resources) {
        map[r.id] = r;
      }
    }
    return map;
  });

  // URL inputs per resource
  const [urlInputs, setUrlInputs] = useState<Record<string, string>>({});
  const [activeInput, setActiveInput] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  };

  // ============================================================================
  // MATERIALIZE
  // ============================================================================

  const handleMaterialize = async (resourceId: string) => {
    const url = urlInputs[resourceId]?.trim();
    if (!url) return;

    setSubmitting(resourceId);
    setErrors((prev) => ({ ...prev, [resourceId]: '' }));

    try {
      const res = await fetch(`/api/curriculum/${curriculumId}/materialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curriculumResourceId: resourceId, youtubeUrl: url }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrors((prev) => ({ ...prev, [resourceId]: data.error || 'Error' }));
        setSubmitting(null);
        return;
      }

      const data = await res.json();

      // Optimistic update
      setResourceStates((prev) => ({
        ...prev,
        [resourceId]: {
          ...prev[resourceId],
          status: 'processing',
          pipelineJobId: data.jobId,
          youtubeUrl: url,
        },
      }));

      setActiveInput(null);
      setUrlInputs((prev) => ({ ...prev, [resourceId]: '' }));
    } catch {
      setErrors((prev) => ({
        ...prev,
        [resourceId]: isEs ? 'Error de conexión' : 'Connection error',
      }));
    } finally {
      setSubmitting(null);
    }
  };

  // ============================================================================
  // POLLING for processing resources
  // ============================================================================

  const processingResources = Object.values(resourceStates).filter(
    (r) => r.status === 'processing' && r.pipelineJobId,
  );

  const pollProcessing = useCallback(async () => {
    for (const resource of processingResources) {
      if (!resource.pipelineJobId) continue;

      try {
        const res = await fetch(`/api/pipeline/${resource.pipelineJobId}`);
        if (!res.ok) continue;

        const data = await res.json();

        if (data.status === 'completed') {
          setResourceStates((prev) => ({
            ...prev,
            [resource.id]: {
              ...prev[resource.id],
              status: 'materialized',
              resourceId: data.resourceId,
            },
          }));
        } else if (data.status === 'failed') {
          setResourceStates((prev) => ({
            ...prev,
            [resource.id]: {
              ...prev[resource.id],
              status: 'failed',
            },
          }));
        }
      } catch {
        // Ignore polling errors
      }
    }
  }, [processingResources]);

  useEffect(() => {
    if (processingResources.length === 0) return;

    const interval = setInterval(pollProcessing, PIPELINE_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [processingResources.length, pollProcessing]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-4">
      {phases.map((phase) => {
        const isExpanded = expandedPhases.has(phase.id);
        const phaseResources = phase.resources.map((r) => resourceStates[r.id] || r);
        const materializedCount = phaseResources.filter((r) => r.status === 'materialized').length;

        return (
          <div key={phase.id} className="border border-j-border">
            {/* Phase header */}
            <button
              onClick={() => togglePhase(phase.id)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-j-surface/50 transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                <span className="font-mono text-2xl font-light text-j-border shrink-0">
                  {String(phase.phaseNumber).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <h3 className="text-base text-j-text truncate">{phase.title}</h3>
                  <div className="flex gap-3 font-mono text-[10px] text-j-text-tertiary mt-0.5">
                    <span>{phase.estimatedWeeks} {isEs ? 'semanas' : 'weeks'}</span>
                    <span>{phaseResources.length} {isEs ? 'recursos' : 'resources'}</span>
                    {materializedCount > 0 && (
                      <span className="text-j-accent">{materializedCount} {isEs ? 'listos' : 'ready'}</span>
                    )}
                  </div>
                </div>
              </div>

              <ChevronDown
                size={18}
                className={`text-j-text-tertiary transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Phase content */}
            {isExpanded && (
              <div className="border-t border-j-border">
                {phase.description && (
                  <p className="px-5 pt-4 text-sm text-j-text-secondary">{phase.description}</p>
                )}

                <div className="p-5 space-y-3">
                  {phaseResources.map((resource) => (
                    <ResourceCard
                      key={resource.id}
                      resource={resource}
                      language={language}
                      isActiveInput={activeInput === resource.id}
                      urlValue={urlInputs[resource.id] || ''}
                      isSubmitting={submitting === resource.id}
                      error={errors[resource.id]}
                      onToggleInput={() =>
                        setActiveInput((prev) => (prev === resource.id ? null : resource.id))
                      }
                      onUrlChange={(value) =>
                        setUrlInputs((prev) => ({ ...prev, [resource.id]: value }))
                      }
                      onSubmit={() => handleMaterialize(resource.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// RESOURCE CARD
// ============================================================================

interface ResourceCardProps {
  resource: CurriculumResourceData;
  language: Language;
  isActiveInput: boolean;
  urlValue: string;
  isSubmitting: boolean;
  error?: string;
  onToggleInput: () => void;
  onUrlChange: (value: string) => void;
  onSubmit: () => void;
}

function ResourceCard({
  resource,
  language,
  isActiveInput,
  urlValue,
  isSubmitting,
  error,
  onToggleInput,
  onUrlChange,
  onSubmit,
}: ResourceCardProps) {
  const isEs = language === 'es';
  const Icon = TYPE_ICONS[resource.resourceType] || FileText;

  return (
    <div className="border border-j-border/50 p-4">
      <div className="flex items-start gap-3">
        <Icon size={16} className="text-j-text-tertiary mt-0.5 shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {resource.status === 'materialized' && resource.resourceId ? (
                <Link
                  href={`/learn/${resource.resourceId}`}
                  className="text-sm text-j-accent hover:underline"
                >
                  {resource.title}
                </Link>
              ) : (
                <p className="text-sm text-j-text">{resource.title}</p>
              )}

              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                {resource.expectedChannel && (
                  <span className="font-mono text-[10px] text-j-text-tertiary">
                    {resource.expectedChannel}
                  </span>
                )}
                <span className="font-mono text-[10px] text-j-text-tertiary">
                  ~{resource.estimatedHours}h
                </span>
                <span className="font-mono text-[10px] text-j-text-tertiary capitalize">
                  {resource.resourceType}
                </span>
              </div>
            </div>

            {/* Status badge */}
            <div className="shrink-0">
              {resource.status === 'materialized' && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-j-accent">
                  <Check size={12} />
                  {isEs ? 'Listo' : 'Ready'}
                </span>
              )}
              {resource.status === 'processing' && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-j-text-secondary animate-pulse">
                  <Loader2 size={12} className="animate-spin" />
                  {isEs ? 'Procesando' : 'Processing'}
                </span>
              )}
              {resource.status === 'failed' && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-j-error">
                  <AlertCircle size={12} />
                  {isEs ? 'Error' : 'Failed'}
                </span>
              )}
              {resource.status === 'pending' && (
                <button
                  onClick={onToggleInput}
                  className="font-mono text-[10px] tracking-[0.1em] text-j-text-tertiary hover:text-j-accent transition-colors"
                >
                  {isEs ? 'Materializar' : 'Materialize'}
                </button>
              )}
            </div>
          </div>

          {/* Search query hint */}
          {(resource.status === 'pending' || resource.status === 'failed') && isActiveInput && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-[11px] text-j-text-tertiary">
                <Search size={12} />
                <span className="font-mono">{resource.searchQuery}</span>
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(resource.searchQuery)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-j-accent hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink size={10} />
                </a>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onSubmit();
                }}
                className="flex gap-2"
              >
                <input
                  type="url"
                  value={urlValue}
                  onChange={(e) => onUrlChange(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="https://youtube.com/watch?v=..."
                  className="flex-1 px-3 py-2 text-xs bg-j-bg border border-j-border text-j-text placeholder:text-j-text-tertiary focus:border-j-accent focus:outline-none disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={!urlValue.trim() || isSubmitting}
                  className="px-4 py-2 text-xs font-mono bg-j-text text-j-bg hover:bg-j-accent transition-colors disabled:opacity-30"
                >
                  {isSubmitting ? '...' : 'Go'}
                </button>
              </form>

              {error && <p className="text-[11px] text-j-error">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
