# Party Games (Kiss Marry Kill & More)

A real-time multiplayer party game app with 20+ game modes. Create a room, share the code, and play with friends.

## Game Modes

- **Smash Marry Kill** -- Pick one to smash, marry, or kill from 3 people
- **Red Flag / Green Flag** -- Rate each person green or red
- **Smash or Pass** -- Quick binary choice on each person
- **Would You Rather** -- Pick between two options (anonymous)
- **Most Likely To** -- Vote for the friend who fits each prompt
- **Who Said This** -- Guess who wrote the anonymous quote

## Features

- Real-time game updates via Supabase Realtime
- 20+ game modes — voting, trivia, board games, and more
- Player photo uploads for avatars
- Player-submitted questions in lobby
- Anonymous confessions during gameplay
- Timed rounds with auto-submit
- Game history and leaderboards
- Dark/light theme support
- CSV/Excel import for participant lists and custom questions
- Mobile-friendly responsive design

## Tech Stack

- Next.js 16 (App Router)
- React 19
- Supabase (Postgres + Realtime)
- Tailwind CSS 4
- TypeScript
- Zod (input validation)

## Getting Started

```bash
pnpm install
cp .env.example .env.local  # Add your Supabase credentials
pnpm dev
```

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` -- Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` -- Supabase anon/public key

## Database Setup

The schema is defined entirely by the migrations in `supabase/migrations/`
(`0001_base_schema.sql` plus everything after it). Apply them to a fresh Supabase
project with the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push   # applies every migration in supabase/migrations/ in order
```

That also creates the `avatars` storage bucket and its policies (the base
migration handles it), so there's no manual bucket step.

Once Supabase is connected to GitHub, new migrations apply automatically — on the
preview branch when a PR opens, and on prod when you merge. **Make every schema
change as a new timestamped migration file; never edit the schema in the SQL
Editor** (manual edits aren't tracked and drift the database out of sync). See
[CONTRIBUTING.md](CONTRIBUTING.md) for the full migration conventions.

## Scripts

- `pnpm dev` -- Start development server
- `pnpm build` -- Production build
- `pnpm start` -- Start production server
- `pnpm lint` -- Run ESLint
- `pnpm format:check` -- Check Prettier formatting
- `pnpm format` -- Auto-format with Prettier
- `pnpm typecheck` -- Run TypeScript type checking
