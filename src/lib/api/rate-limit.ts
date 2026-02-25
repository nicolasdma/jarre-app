/**
 * Jarre - Token Budget Rate Limiting
 *
 * Enforces monthly token budgets for managed mode:
 * - Self-hosted: always allowed (no limits)
 * - BYOK users: always allowed (no limits)
 * - Managed free trial: 50K tokens/month
 * - Managed paid: 500K tokens/month
 *
 * Queries the token_usage table for current month consumption.
 */

import { IS_SELF_HOSTED } from '@/lib/config';
import { TABLES } from '@/lib/db/tables';
import { createLogger } from '@/lib/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

const log = createLogger('RateLimit');

const FREE_TRIAL_LIMIT = 50_000;
const PAID_LIMIT = 500_000;

export interface BudgetCheck {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

/**
 * Check if a user has remaining token budget.
 *
 * Returns { allowed: true } for self-hosted, BYOK, or users within budget.
 * Returns { allowed: false } when managed users exceed their monthly cap.
 */
export async function checkTokenBudget(
  supabase: SupabaseClient,
  userId: string,
  hasByokKeys: boolean,
): Promise<BudgetCheck> {
  // Self-hosted and BYOK users have no limits
  if (IS_SELF_HOSTED || hasByokKeys) {
    return { allowed: true, used: 0, limit: Infinity, remaining: Infinity };
  }

  // Get current month boundaries (UTC)
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  // Sum tokens for current month
  const { data, error } = await supabase
    .from(TABLES.tokenUsage)
    .select('tokens')
    .eq('user_id', userId)
    .gte('created_at', monthStart.toISOString())
    .lt('created_at', monthEnd.toISOString());

  if (error) {
    log.error('Failed to check token budget:', error.message);
    // Fail open — don't block users if we can't check
    return { allowed: true, used: 0, limit: PAID_LIMIT, remaining: PAID_LIMIT };
  }

  const used = (data || []).reduce((sum, row) => sum + (row.tokens || 0), 0);

  // Check subscription status for paid vs free limit
  const { data: profile } = await supabase
    .from(TABLES.userProfiles)
    .select('subscription_status')
    .eq('id', userId)
    .single();

  const limit = profile?.subscription_status === 'active' ? PAID_LIMIT : FREE_TRIAL_LIMIT;

  const remaining = Math.max(0, limit - used);
  const allowed = used < limit;

  if (!allowed) {
    log.info(`User ${userId} exceeded token budget: ${used}/${limit}`);
  }

  return { allowed, used, limit, remaining };
}
