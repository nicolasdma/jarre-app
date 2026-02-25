# Self-Hosting Jarre

## Prerequisites
- Node.js 20+
- npm 10+
- A Supabase project (cloud or local Docker)
- DeepSeek API key (for evaluations, content generation)
- Gemini API key (for voice sessions)

## Quick Start

```bash
git clone https://github.com/nicolasdemaria/jarre.git
cd jarre
npm install
cp .env.example .env.local
# Fill in your API keys (see below)
npm run dev
# Open http://localhost:3000
```

## Supabase Setup

### Option A: Supabase Cloud (Recommended)
1. Create a project at https://supabase.com/dashboard
2. Go to Settings → API to find your keys
3. Run migrations:
```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

### Option B: Local Docker
```bash
npx supabase init
npx supabase start
# Use the local URL and keys printed in the terminal
```

## Environment Variables

```bash
cp .env.example .env.local
```

Fill in the required values:

| Variable | Required | Where to get it |
|----------|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Same as above |
| `SUPABASE_SECRET_KEY` | Yes | Same as above (secret / service_role key) |
| `DEEPSEEK_API_KEY` | Yes | https://platform.deepseek.com/api_keys |
| `GEMINI_API_KEY` | Yes (for voice) | https://aistudio.google.com/apikey |
| `DEEPL_API_KEY` | No | https://www.deepl.com/pro-api (translation) |

## Database Migrations

The `supabase/migrations/` directory contains 72 migration files that create the full schema (41 tables).

```bash
# If using Supabase Cloud:
npx supabase db push

# If using local Docker:
npx supabase db reset
```

## Running in Development

```bash
npm run dev
```

Open http://localhost:3000. Create an account, paste a YouTube URL into the dashboard, and the pipeline will generate a full course.

## Production Deployment

### Vercel (Recommended)
1. Push your repo to GitHub
2. Import in Vercel: https://vercel.com/import
3. Set environment variables in Vercel dashboard
4. Deploy

### Other platforms
Jarre is a standard Next.js 16 app. Any platform that supports Next.js will work:
```bash
npm run build
npm start
```

## Troubleshooting

- **"DEEPSEEK_API_KEY is not configured"**: Make sure `.env.local` has the key and restart the dev server.
- **"Voice service not configured"**: Set `GEMINI_API_KEY` in `.env.local`.
- **Database errors**: Run `npx supabase db push` to apply all migrations.
- **Build errors**: Make sure you're on Node.js 20+ and run `npm install` first.
