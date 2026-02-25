# Jarre — Open-Source & Monetization Plan

## Context

Jarre is a full-stack AI-powered learning platform: ~42K lines TypeScript, 41 Supabase tables, 72 migrations, 42 API routes, DeepSeek V3 + Gemini Live voice. The goal is to open-source the app while keeping the backend data private and building a sustainable monetization model.

---

## Architecture Decision: What's Public vs Private

| Layer | Public (repo) | Private (your infra) |
|---|---|---|
| Frontend + components | Yes | — |
| API routes (Next.js) | Yes | — |
| LLM prompts + rubrics | Yes | — |
| DB schema + migrations | Yes | — |
| Supabase instance + data | — | Yes |
| API keys (DeepSeek, Gemini) | — | Yes |
| User data | — | Yes |

**Rationale on prompts**: Prompts from Cursor, Devin, v0, and Windsurf have all leaked (30K+ star repo on GitHub compiles them). Your real moat is the complete product experience — pipeline, FSRS, mastery levels, 10 rubrics, 7 voice modes — not the prompts themselves. Keeping them public builds trust and invites contributions.

---

## License: AGPLv3

**Why AGPL over MIT:**
- Prevents companies from forking, hosting as SaaS, and never contributing back
- Cal.com, Plausible, Grafana all use AGPL for exactly this reason
- MIT is too permissive — anyone can sell your product without giving back
- AGPL requires anyone who modifies and hosts it to share their changes

**Action**: Change `package.json` license from `"MIT"` to `"AGPL-3.0-only"`, add `LICENSE` file.

---

## Monetization: 3-Tier Model

### Tier 1 — Self-hosted (Free, AGPL)
- Clone repo, bring your own Supabase + API keys
- Full feature parity — no artificial limitations
- Target: developers, contributors, privacy-conscious users
- Docs: `SELF_HOSTING.md` with step-by-step guide

### Tier 2 — BYOK on hosted app (Free)
- User signs up on your hosted instance (your Supabase)
- Goes to Settings → enters their own DeepSeek + Gemini keys
- Keys stored **encrypted in localStorage** (never sent to your server)
- Frontend injects keys via headers → API routes use them
- Target: power users who want the hosted convenience without paying

### Tier 3 — Managed (Paid, ~$8/month)
- Everything included — user doesn't configure anything
- Uses your API keys with a generous monthly token cap
- Token usage dashboard (you already have `token_usage` table + `/api/user/token-usage`)
- Target: students, educators, anyone who wants simplicity
- Payment: Stripe subscription

### Token Cap Strategy (Tier 3)
Based on your `TOKEN_BUDGETS` constants, a typical learning session uses:
- Pipeline ingest: ~20K tokens (one-time per resource)
- Evaluation cycle: ~8K tokens
- Voice session scoring: ~8K tokens
- Review session: ~2K tokens
- Daily active use estimate: ~30-50K tokens

**Recommended cap**: 500K tokens/month (~$8/month covers DeepSeek + Gemini costs with margin). This allows ~10-15 active learning sessions/month which is reasonable for a student.

---

## Implementation Phases

### Phase 1 — Repo Hygiene & License (Day 1-2)

**Files to create/modify:**

1. **`LICENSE`** — Full AGPLv3 text
2. **`package.json`** — Change `"license": "MIT"` → `"AGPL-3.0-only"`
3. **`.env.example`** — Already good, minor improvements:
   - Add comments explaining where to get each key
   - Add `NEXT_PUBLIC_APP_MODE=self-hosted` variable (explained below)
4. **`SELF_HOSTING.md`** — Step-by-step:
   - Create Supabase project (cloud or Docker)
   - Copy `.env.example` → `.env.local`, fill in keys
   - Run migrations: `npx supabase db push`
   - Get API keys: DeepSeek dashboard, Google AI Studio
   - `npm install && npm run dev`
5. **`README.md`** — Add:
   - Architecture diagram (text-based)
   - Screenshots/GIFs of the product
   - Quick start (< 30 seconds to understand what this is)
   - Clear "Self-host" vs "Use hosted version" paths
6. **Audit** — Verify no hardcoded credentials remain in repo

---

### Phase 2 — App Mode System + BYOK (Week 1-2)

The core architectural change: introduce `APP_MODE` to handle the 3 tiers.

#### 2A. App Mode Configuration

New file: `src/lib/config.ts`
```typescript
export type AppMode = 'self-hosted' | 'managed';

export const APP_MODE: AppMode =
  (process.env.NEXT_PUBLIC_APP_MODE as AppMode) || 'self-hosted';

export const IS_MANAGED = APP_MODE === 'managed';
```

**Behavior by mode:**
- `self-hosted`: API keys come from `.env.local`. No billing. No BYOK UI (keys are already in env).
- `managed`: API keys come from env (your keys) OR user's BYOK keys via headers. Billing active. Settings page shows BYOK option.

#### 2B. BYOK Key Management (Client-Side)

New file: `src/lib/byok.ts`
```typescript
// Keys stored in localStorage, encrypted with Web Crypto API
// Never sent to server except as Authorization headers for LLM calls
export function saveApiKey(provider: 'deepseek' | 'gemini', key: string): void
export function getApiKey(provider: 'deepseek' | 'gemini'): string | null
export function clearApiKeys(): void
export function validateKey(provider: string, key: string): Promise<boolean>
```

**Security model:**
- Keys encrypted at rest in localStorage using AES-GCM (Web Crypto API)
- Keys travel as custom headers: `X-DeepSeek-Key`, `X-Gemini-Key`
- Server-side: API routes check for BYOK headers first, fall back to env vars
- Keys never logged, never stored in DB, never in cookies

#### 2C. Middleware Enhancement

Modify `src/lib/api/middleware.ts` to extract BYOK keys:

```typescript
interface AuthContext<P> {
  supabase: SupabaseClient;
  user: User;
  params: P;
  apiKeys: {  // NEW
    deepseek: string;
    gemini: string;
  };
}
```

The middleware resolves API keys in this priority:
1. BYOK header (`X-DeepSeek-Key`) — if present and managed mode
2. Environment variable (`DEEPSEEK_API_KEY`) — fallback

#### 2D. DeepSeek Client Modification

Modify `src/lib/llm/deepseek.ts` — `callDeepSeek()` receives API key as parameter instead of reading from env directly:

```typescript
export async function callDeepSeek(params: {
  messages: DeepSeekMessage[];
  apiKey?: string;  // NEW — BYOK override
  // ... rest stays the same
}): Promise<{ content: string; tokensUsed: number }>
```

Same pattern for Gemini voice token route.

#### 2E. Settings UI (Managed mode only)

New page: `/settings` (or section in existing settings)
- Input fields for DeepSeek + Gemini API keys
- "Test connection" button (validates key with a minimal API call)
- Keys saved to localStorage on success
- "Clear keys" button
- Visual indicator: "Using your keys" vs "Using managed service"
- Link to docs on how to get API keys

---

### Phase 3 — Token Tracking & Limits (Week 2-3)

You already have `token_usage` table and `/api/user/token-usage`. Build on this:

#### 3A. Token Tracking Enhancement

- Ensure every LLM call logs tokens to `token_usage` table (audit existing routes)
- Add category labels matching `TOKEN_BUDGETS` keys
- Track Gemini voice separately (voice minutes → estimated tokens)

#### 3B. Usage Limits (Managed tier only)

New file: `src/lib/api/rate-limit.ts`
```typescript
const MONTHLY_TOKEN_CAP = 500_000;

export async function checkTokenBudget(
  supabase: SupabaseClient,
  userId: string
): Promise<{ allowed: boolean; remaining: number; used: number }>
```

- Check before each LLM call in API routes
- Return 429 with `{ error: 'Monthly token limit reached', used, limit }` when exceeded
- BYOK users: no limit (they're paying their own API costs)
- Self-hosted: no limit (their keys, their money)

#### 3C. Usage Dashboard Component

Enhance existing token usage display:
- Monthly usage bar (used / cap)
- Breakdown by category (voice, evaluation, pipeline, review)
- "Upgrade to increase limit" CTA (for managed free tier, if you add one)
- "Bring your own key to remove limits" CTA

---

### Phase 4 — Stripe Billing (Week 3-5)

#### 4A. Stripe Integration

- `npm install stripe @stripe/stripe-js`
- New env vars: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`
- Webhook route: `/api/webhooks/stripe`
- New DB columns: `user_profiles.stripe_customer_id`, `user_profiles.subscription_status`, `user_profiles.subscription_tier`

#### 4B. Billing Routes

- `POST /api/billing/checkout` — Creates Stripe checkout session
- `POST /api/billing/portal` — Opens Stripe customer portal
- `GET /api/billing/status` — Returns current subscription

#### 4C. Subscription Logic

```
User signs up → Free managed (very low cap, e.g., 50K tokens = ~1-2 sessions as trial)
  → Enters BYOK keys → Unlimited (free)
  → Subscribes $8/month → 500K tokens/month
```

#### 4D. Migration

```sql
ALTER TABLE user_profiles ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE user_profiles ADD COLUMN subscription_status TEXT DEFAULT 'free';
ALTER TABLE user_profiles ADD COLUMN subscription_tier TEXT DEFAULT 'free';
```

---

### Phase 5 — Community & Distribution (Ongoing, not a "phase")

**GitHub Discussions**: Enable in repo settings. No Discord. A dead Discord is worse than no Discord.

**Good first issues**: Create 3-5 genuinely approachable issues:
- Typo fixes in translations
- Missing unit tests for pure functions (`fsrs.ts`, `mastery.ts`)
- A single isolated UI component improvement
- NOT "add caching to pipeline" — the codebase has 41 tables, 50 routes, barrier is high

**Product Hunt / Show HN**: NOT now. Only when:
- README has screenshots/demo GIF
- 10-20 organic GitHub stars
- 2-3 real user testimonials
- Landing page exists

**Twitter/X "Build in public"**: Already your daily operation per campaign.md. Not a separate phase. Continue with your pillar structure (40% what you built, 30% what you learned, 30% opinions).

**Blog**: Deferred to month 2-3 per your campaign.md. Twitter threads first, expand to long-form later when landing page exists.

---

## File Changes Summary

### New Files
| File | Purpose |
|---|---|
| `LICENSE` | AGPLv3 full text |
| `SELF_HOSTING.md` | Step-by-step self-hosting guide |
| `src/lib/config.ts` | App mode configuration |
| `src/lib/byok.ts` | BYOK key management (client-side) |
| `src/lib/api/rate-limit.ts` | Token budget enforcement |
| `src/app/settings/page.tsx` | Settings page (BYOK keys UI) |
| `src/app/api/billing/checkout/route.ts` | Stripe checkout |
| `src/app/api/billing/portal/route.ts` | Stripe portal |
| `src/app/api/billing/status/route.ts` | Subscription status |
| `src/app/api/webhooks/stripe/route.ts` | Stripe webhook |

### Modified Files
| File | Change |
|---|---|
| `package.json` | License → AGPL-3.0-only |
| `.env.example` | Add APP_MODE, Stripe vars |
| `README.md` | Architecture diagram, quick start, screenshots |
| `src/lib/api/middleware.ts` | Extract BYOK headers, add apiKeys to context |
| `src/lib/llm/deepseek.ts` | Accept apiKey parameter |
| `src/app/api/voice/token/route.ts` | Accept BYOK Gemini key |
| `src/lib/constants.ts` | Add MONTHLY_TOKEN_CAP, FREE_TRIAL_CAP |
| All ~20 API routes that call DeepSeek | Pass apiKey from context |

### New Dependencies
| Package | Purpose |
|---|---|
| `stripe` | Server-side Stripe SDK |
| `@stripe/stripe-js` | Client-side Stripe |

### New DB Migration
| Table | Columns |
|---|---|
| `user_profiles` | `stripe_customer_id`, `subscription_status`, `subscription_tier` |

---

## Decision Log

| Decision | Choice | Reasoning |
|---|---|---|
| License | AGPLv3 | Prevents SaaS free-riding; Cal.com/Plausible precedent |
| Prompts | Public in repo | Leaks are inevitable; moat is product experience, not prompts |
| BYOK storage | localStorage (encrypted) | Keys never touch your server; simplest secure approach |
| Token cap | 500K/month at $8 | Covers ~10-15 active sessions; good margin over API costs |
| Discord | No | Dead Discord worse than none; GitHub Discussions instead |
| Product Hunt | Deferred | One-shot; needs stars + testimonials + landing page first |
| Blog | Deferred month 2-3 | Twitter threads first; expand to long-form later |
| Free trial | 50K tokens | Enough for 1-2 full sessions to demo value |
