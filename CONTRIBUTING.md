# Contributing to Jarre

## Getting Started

1. Fork the repository and clone your fork.
2. Copy `.env.example` to `.env.local` and fill in your own API keys:
   - **Supabase**: Create a project at [supabase.com](https://supabase.com) and copy the URL + keys.
   - **DeepSeek**: Get an API key at [platform.deepseek.com](https://platform.deepseek.com).
   - **Gemini** (optional, for voice): Get a key at [ai.google.dev](https://ai.google.dev).
   - **DeepL** (optional, for translation): Get a key at [deepl.com/pro-api](https://www.deepl.com/pro-api).
3. Run the Supabase migrations: `npx supabase db push`
4. Install dependencies: `npm install`
5. Start the dev server: `npm run dev`

## Project Structure

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a detailed overview.

Key directories:
- `src/app/` — Next.js App Router pages and API routes
- `src/components/` — React components
- `src/lib/` — Shared logic (LLM clients, Supabase, utilities)
- `src/types/` — TypeScript type definitions
- `supabase/migrations/` — Database schema migrations

## Code Style

- TypeScript strict mode
- Kebab-case file names, PascalCase components
- Tailwind CSS for styling
- Server Components by default, Client Components only when needed
- All constants in `src/lib/constants.ts` — no magic numbers

## Before Submitting a PR

- Ensure the build passes: `npm run build`
- Run lint: `npm run lint`
- Write a clear PR description explaining *why*, not just *what*
- Keep changes focused — one feature or fix per PR

## Commit Messages

Format: `[Area] description` (e.g., `[Review] Fix card scheduling edge case`)

Keep messages under 140 characters.
