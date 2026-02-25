/**
 * Jarre - Voice Session Token Route
 *
 * Creates an ephemeral auth token for client-side Gemini Live API connection.
 * The API key never leaves the server — the system instruction and audio config
 * are locked into the token via liveConnectConstraints.
 *
 * POST /api/voice/token
 * Body: { systemInstruction: string }
 * Response: { token: string }
 */

import { NextResponse } from 'next/server';
import { GoogleGenAI, Modality } from '@google/genai';
import { withAuth } from '@/lib/api/middleware';
import { badRequest, jsonOk } from '@/lib/api/errors';
import { createLogger } from '@/lib/logger';
import { GEMINI_VOICE_MODEL, GEMINI_VOICE_NAME } from '@/lib/constants';
import { checkTokenBudget, checkVoiceTimeBudget } from '@/lib/api/rate-limit';

const log = createLogger('VoiceToken');

const MAX_SYSTEM_INSTRUCTION_BYTES = 50_000;

export const POST = withAuth(async (request, { supabase, user, byokKeys }) => {
  // Check token budget before issuing voice token
  const budget = await checkTokenBudget(supabase, user.id, !!byokKeys.deepseek);
  if (!budget.allowed) {
    return NextResponse.json(
      { error: 'Monthly token limit exceeded', used: budget.used, limit: budget.limit },
      { status: 429 },
    );
  }

  // Check voice time budget (free tier only)
  const voiceBudget = await checkVoiceTimeBudget(supabase, user.id, !!byokKeys.gemini);
  if (!voiceBudget.allowed) {
    return NextResponse.json(
      { error: 'Monthly voice time limit exceeded', remainingSeconds: 0 },
      { status: 429 },
    );
  }

  const apiKey = byokKeys.gemini || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    log.error('GEMINI_API_KEY not configured');
    throw new Error('Voice service not configured');
  }

  const body = await request.json();
  const { systemInstruction } = body;

  if (!systemInstruction || typeof systemInstruction !== 'string') {
    throw badRequest('systemInstruction is required');
  }

  if (new TextEncoder().encode(systemInstruction).length > MAX_SYSTEM_INSTRUCTION_BYTES) {
    throw badRequest(`systemInstruction exceeds ${MAX_SYSTEM_INSTRUCTION_BYTES} byte limit`);
  }

  const client = new GoogleGenAI({
    apiKey,
    httpOptions: { apiVersion: 'v1alpha' },
  });

  const authToken = await client.authTokens.create({
    config: {
      uses: 1,
      expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      liveConnectConstraints: {
        model: GEMINI_VOICE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: GEMINI_VOICE_NAME },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      },
    },
  });

  log.info('Ephemeral voice token issued');

  return jsonOk({
    token: authToken.name,
    remainingSeconds: voiceBudget.remainingSeconds,
  });
});
