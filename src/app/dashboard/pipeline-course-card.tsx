import Link from 'next/link';
import Image from 'next/image';
import { Play } from 'lucide-react';
import type { Language } from '@/lib/translations';
import { extractYoutubeId } from '@/lib/utils/youtube';

export interface PipelineCourseData {
  id: string;
  title: string;
  type: string;
  url: string | null;
  summary: string | null;
  sectionCount: number;
  createdAt: string;
  isOwner: boolean;
  evalStats: {
    bestScore: number;
    evalCount: number;
  } | null;
  progress: {
    activeSection: number;
    completedSections: number[];
  } | null;
}

function relativeDate(dateStr: string, lang: Language): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return lang === 'es' ? 'Hoy' : 'Today';
  if (days === 1) return lang === 'es' ? 'Ayer' : 'Yesterday';
  if (days < 7) return lang === 'es' ? `Hace ${days} días` : `${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return lang === 'es' ? `Hace ${weeks} sem` : `${weeks}w ago`;
  }
  const months = Math.floor(days / 30);
  return lang === 'es' ? `Hace ${months} mes${months > 1 ? 'es' : ''}` : `${months}mo ago`;
}

export function PipelineCourseCard({
  course,
  language,
}: {
  course: PipelineCourseData;
  language: Language;
}) {
  const videoId = extractYoutubeId(course.url);
  const thumbnailUrl = videoId
    ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    : null;

  return (
    <Link
      href={`/learn/${course.id}`}
      className={`group block overflow-hidden rounded-lg border bg-j-surface transition-all hover:shadow-md ${
        course.isOwner
          ? 'border-j-accent/40 hover:border-j-accent'
          : 'border-j-border hover:border-j-accent/60'
      }`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-j-border/30 overflow-hidden">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={course.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Play size={32} className="text-j-text-tertiary" />
          </div>
        )}

        {/* Eval badge overlay */}
        {course.evalStats && (
          <div className="absolute top-2 right-2 bg-j-bg/90 backdrop-blur-sm px-2 py-0.5 rounded font-mono text-[10px] text-j-accent">
            {course.evalStats.bestScore}%
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-5 h-5 rounded-full bg-j-accent/10 flex items-center justify-center shrink-0">
            <Play size={10} className="text-j-accent ml-px" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium text-j-text group-hover:text-j-accent transition-colors line-clamp-2 leading-snug">
              {course.title}
            </h3>
            <p className="font-mono text-[10px] text-j-text-tertiary mt-1.5">
              {course.sectionCount} {course.sectionCount === 1
                ? (language === 'es' ? 'sección' : 'section')
                : (language === 'es' ? 'secciones' : 'sections')}
              {' · '}
              {relativeDate(course.createdAt, language)}
            </p>
            {course.progress && (
              <p className="font-mono text-[10px] text-j-accent mt-1">
                {language === 'es' ? 'Sección' : 'Section'} {course.progress.activeSection}/{course.sectionCount}
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
