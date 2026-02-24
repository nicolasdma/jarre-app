/**
 * POST /api/pipeline
 *
 * Start a new YouTube → Course pipeline job.
 * Body: { url: string, title?: string }
 * Returns: { jobId, status: 'queued' }
 */

import { randomUUID } from 'node:crypto';
import { withAuth } from '@/lib/api/middleware';
import { badRequest } from '@/lib/api/errors';
import { jsonOk } from '@/lib/api/errors';
import { startPipeline } from '@/lib/pipeline/orchestrator';
import { extractYouTubeVideoId } from '@/lib/pipeline/stages/resolve-youtube';
import { getUserLanguage } from '@/lib/db/queries/user';

export const POST = withAuth(async (request, { supabase, user }) => {
  const body = await request.json();
  const { url, title } = body as { url?: string; title?: string };

  if (!url || typeof url !== 'string') {
    throw badRequest('URL is required');
  }

  // Validate it's a YouTube URL
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    throw badRequest('Invalid YouTube URL. Supported formats: youtube.com/watch?v=... or youtu.be/...');
  }

  // Get user's preferred language
  const language = await getUserLanguage(supabase, user.id);

  const jobId = randomUUID();
  await startPipeline({
    jobId,
    userId: user.id,
    url,
    title,
    targetLanguage: language,
  });

  return jsonOk({ jobId, status: 'queued' });
});
