/**
 * POST /api/curriculum/[id]/materialize
 *
 * Materialize a curriculum resource by providing a YouTube URL.
 * Starts the pipeline and links it to the curriculum resource.
 *
 * Body: { curriculumResourceId: string, youtubeUrl: string }
 * Returns: { jobId: string }
 */

import { randomUUID } from 'node:crypto';
import { withAuth } from '@/lib/api/middleware';
import { badRequest, notFound, jsonOk } from '@/lib/api/errors';
import { TABLES } from '@/lib/db/tables';
import { startPipeline } from '@/lib/pipeline/orchestrator';
import { extractYouTubeVideoId } from '@/lib/pipeline/stages/resolve-youtube';
import { getUserLanguage } from '@/lib/db/queries/user';

export const POST = withAuth<{ id: string }>(async (request, { supabase, user, params }) => {
  const curriculumId = params.id;
  const body = await request.json();
  const { curriculumResourceId, youtubeUrl } = body as {
    curriculumResourceId?: string;
    youtubeUrl?: string;
  };

  if (!curriculumResourceId || typeof curriculumResourceId !== 'string') {
    throw badRequest('curriculumResourceId is required');
  }

  if (!youtubeUrl || typeof youtubeUrl !== 'string') {
    throw badRequest('youtubeUrl is required');
  }

  // Validate YouTube URL
  const videoId = extractYouTubeVideoId(youtubeUrl);
  if (!videoId) {
    throw badRequest('Invalid YouTube URL');
  }

  // Verify curriculum belongs to user
  const { data: curriculum, error: currErr } = await supabase
    .from(TABLES.curricula)
    .select('id')
    .eq('id', curriculumId)
    .eq('user_id', user.id)
    .single();

  if (currErr || !curriculum) {
    throw notFound('Curriculum not found');
  }

  // Verify resource exists and belongs to this curriculum
  const { data: resource, error: resErr } = await supabase
    .from(TABLES.curriculumResources)
    .select('id, status, title')
    .eq('id', curriculumResourceId)
    .eq('curriculum_id', curriculumId)
    .single();

  if (resErr || !resource) {
    throw notFound('Curriculum resource not found');
  }

  if (resource.status === 'processing') {
    throw badRequest('This resource is already being processed');
  }

  if (resource.status === 'materialized') {
    throw badRequest('This resource is already materialized');
  }

  const language = await getUserLanguage(supabase, user.id);

  // Update curriculum resource status
  const { error: updateErr } = await supabase
    .from(TABLES.curriculumResources)
    .update({
      status: 'processing',
      youtube_url: youtubeUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', curriculumResourceId);

  if (updateErr) {
    throw new Error(`Failed to update curriculum resource: ${updateErr.message}`);
  }

  // Start pipeline
  const jobId = randomUUID();
  await startPipeline({
    jobId,
    userId: user.id,
    url: youtubeUrl,
    title: resource.title,
    targetLanguage: language,
    curriculumResourceId,
  });

  // Link pipeline job to curriculum resource
  await supabase
    .from(TABLES.curriculumResources)
    .update({ pipeline_job_id: jobId })
    .eq('id', curriculumResourceId);

  return jsonOk({ jobId });
});
