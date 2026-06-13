# Anime Who Said This — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add anime quote support to the Who Said This game mode, allowing hosts to include anime quotes (fetched from Yurippe + Jikan APIs) alongside or instead of player-submitted quotes, with multiple-choice voting from same-anime characters.

**Architecture:** Anime quotes are fetched server-side via a new API route that calls Yurippe for quotes and Jikan for character lists. Quotes are cached in an `anime_quote_pool` table during the lobby phase. At game start, anime pool entries become rounds with `anime_metadata` JSONB. Voting uses a new `anime_choice` text column on votes. Jikan responses are cached in two tables to avoid redundant API calls.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase (Postgres), TypeScript, Zod validation, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-06-13-anime-who-said-this-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/schema.sql` | Modify | Add new tables and columns |
| `src/types/index.ts` | Modify | Add AnimeMetadata, AnimeQuotePoolEntry types; extend Game, Round, Vote |
| `src/lib/anime-quotes.ts` | Create | Yurippe + Jikan API integration, fuzzy matching, quote filtering |
| `src/lib/who-said-this.ts` | Modify | Add anime round building, anime vote tallying, extend mergeActiveRound |
| `src/lib/validation.ts` | Modify | Add anime quote schemas, extend createVoteSchema and createGameSchema |
| `src/app/api/anime-quotes/route.ts` | Create | POST endpoint to fetch and store anime quotes |
| `src/app/api/anime-quotes/reroll/route.ts` | Create | POST endpoint to reroll a single anime quote |
| `src/app/api/votes/route.ts` | Modify | Handle anime_choice for anime WST rounds |
| `src/app/api/games/[code]/start/route.ts` | Modify | Build rounds from anime pool + player pool |
| `src/app/api/games/route.ts` | Modify | Accept wst_quote_source in game creation |
| `src/app/create/page.tsx` | Modify | Add quote source toggle for WST games |
| `src/app/host/[code]/page.tsx` | Modify | Add anime quote preview, re-roll, fetch-more in lobby |
| `src/app/game/[code]/page.tsx` | Modify | Add multiple-choice voting UI for anime rounds |
| `src/components/VoteResults.tsx` | Modify | Add AnimeWstRoundResults component |

---

### Task 1: Database Schema Changes

**Files:**
- Modify: `supabase/schema.sql`

This task adds all new tables and columns. Run the SQL in the Supabase SQL editor or add to the schema file.

- [ ] **Step 1: Add migration SQL to schema.sql**

Append the following after the existing schema (after the `ALTER PUBLICATION` line at the end of the file):

```sql
-- ============================================================================
-- Anime Who Said This — schema additions
-- ============================================================================

-- Jikan API response cache (avoid redundant lookups)
CREATE TABLE jikan_search_cache (
  show_name text PRIMARY KEY,
  mal_id integer,
  cached_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE jikan_anime_cache (
  mal_id integer PRIMARY KEY,
  show_name text NOT NULL,
  characters jsonb NOT NULL,
  cached_at timestamptz NOT NULL DEFAULT now()
);

-- Anime quote pool (lobby phase, persists across refreshes)
CREATE TABLE anime_quote_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  quote_text text NOT NULL,
  anime_name text NOT NULL,
  correct_character text NOT NULL,
  choices jsonb NOT NULL,
  removed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE anime_quote_pool ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anime_quote_pool_public" ON anime_quote_pool FOR ALL USING (true) WITH CHECK (true);

-- New columns on existing tables
ALTER TABLE games ADD COLUMN wst_quote_source text NOT NULL DEFAULT 'player'
  CHECK (wst_quote_source IN ('player', 'anime', 'both'));

ALTER TABLE rounds ADD COLUMN anime_metadata jsonb;

ALTER TABLE votes ADD COLUMN anime_choice text;
```

- [ ] **Step 2: Verify schema file is consistent**

Read back the full schema file and confirm the new SQL is appended correctly with no syntax issues.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(schema): add anime WST tables and columns"
```

---

### Task 2: TypeScript Type Updates

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add AnimeMetadata interface**

Add after the `WstQuotePoolEntry` interface (after line 118):

```typescript
export interface AnimeMetadata {
  source: 'anime'
  anime_name: string
  correct_character: string
  choices: string[]
}

export interface AnimeQuotePoolEntry {
  id: string
  game_id: string
  quote_text: string
  anime_name: string
  correct_character: string
  choices: string[]
  removed: boolean
  created_at: string
}

export type WstQuoteSource = 'player' | 'anime' | 'both'
```

- [ ] **Step 2: Extend the Game interface**

Add `wst_quote_source` to the `Game` interface. After line 32 (`created_at: string`), add:

```typescript
  wst_quote_source?: WstQuoteSource
```

- [ ] **Step 3: Extend the Round interface**

Add `anime_metadata` to the `Round` interface. After line 74 (`ended_at: string | null`), add:

```typescript
  anime_metadata?: AnimeMetadata | null
```

- [ ] **Step 4: Extend the Vote interface**

Add `anime_choice` to the `Vote` interface. After line 91 (`target_participant_id: string | null`), add:

```typescript
  anime_choice?: string | null
```

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add anime WST types and extend Game, Round, Vote"
```

---

### Task 3: Anime Quote Fetching Library

**Files:**
- Create: `src/lib/anime-quotes.ts`

This is the core module that talks to Yurippe and Jikan APIs, handles caching, fuzzy matching, and data filtering.

- [ ] **Step 1: Create the anime-quotes.ts file**

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface YurippeQuote {
  _id: string
  character: string
  show: string
  quote: string
}

interface JikanCharacter {
  name: string
  role: string
}

export interface PreparedAnimeQuote {
  quote_text: string
  anime_name: string
  correct_character: string
  choices: string[]
}

// ---------------------------------------------------------------------------
// Blocklist — non-anime sources that appear in Yurippe
// ---------------------------------------------------------------------------

const NON_ANIME_SHOWS = new Set([
  'avatar: the last airbender',
  'the legend of korra',
  'rwby',
  'castlevania',
  'the boondocks',
  'teen titans',
  'voltron: legendary defender',
])

// ---------------------------------------------------------------------------
// Fuzzy title matching (normalized Levenshtein)
// ---------------------------------------------------------------------------

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function normalizedDistance(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 0
  return levenshtein(a.toLowerCase(), b.toLowerCase()) / maxLen
}

function titlesMatch(yurippeShow: string, jikanTitle: string): boolean {
  return normalizedDistance(yurippeShow, jikanTitle) <= 0.4
}

// ---------------------------------------------------------------------------
// Character name formatting: "Last, First" → "First Last"
// ---------------------------------------------------------------------------

function formatCharacterName(name: string): string {
  if (name.includes(', ')) {
    const [last, first] = name.split(', ', 2)
    return `${first} ${last}`
  }
  return name
}

// ---------------------------------------------------------------------------
// Jikan API helpers (with caching and rate limiting)
// ---------------------------------------------------------------------------

const JIKAN_DELAY_MS = 350
const JIKAN_CACHE_TTL_DAYS = 30

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function searchAnimeId(showName: string): Promise<number | null> {
  // Check cache first
  const { data: cached } = await supabase
    .from('jikan_search_cache')
    .select('mal_id')
    .eq('show_name', showName)
    .maybeSingle()

  if (cached !== null) {
    // Check if cache entry exists (mal_id can be null for "no match")
    return cached.mal_id
  }

  await sleep(JIKAN_DELAY_MS)
  const res = await fetch(
    `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(showName)}&limit=1`
  )

  if (!res.ok) {
    if (res.status === 429) {
      // Rate limited — wait and retry once
      await sleep(2000)
      const retry = await fetch(
        `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(showName)}&limit=1`
      )
      if (!retry.ok) return null
      const retryJson = await retry.json()
      const retryAnime = retryJson.data?.[0]
      if (!retryAnime) return null

      const title = retryAnime.title ?? ''
      const titleEn = retryAnime.title_english ?? ''
      if (!titlesMatch(showName, title) && !titlesMatch(showName, titleEn)) {
        await supabase.from('jikan_search_cache').upsert({ show_name: showName, mal_id: null, cached_at: new Date().toISOString() })
        return null
      }
      const malId = retryAnime.mal_id as number
      await supabase.from('jikan_search_cache').upsert({ show_name: showName, mal_id: malId, cached_at: new Date().toISOString() })
      return malId
    }
    return null
  }

  const json = await res.json()
  const anime = json.data?.[0]
  if (!anime) {
    await supabase.from('jikan_search_cache').upsert({ show_name: showName, mal_id: null, cached_at: new Date().toISOString() })
    return null
  }

  const title = anime.title ?? ''
  const titleEn = anime.title_english ?? ''
  if (!titlesMatch(showName, title) && !titlesMatch(showName, titleEn)) {
    await supabase.from('jikan_search_cache').upsert({ show_name: showName, mal_id: null, cached_at: new Date().toISOString() })
    return null
  }

  const malId = anime.mal_id as number
  await supabase.from('jikan_search_cache').upsert({ show_name: showName, mal_id: malId, cached_at: new Date().toISOString() })
  return malId
}

async function fetchCharacters(malId: number, showName: string): Promise<JikanCharacter[]> {
  // Check cache first
  const { data: cached } = await supabase
    .from('jikan_anime_cache')
    .select('characters')
    .eq('mal_id', malId)
    .maybeSingle()

  if (cached) {
    return cached.characters as JikanCharacter[]
  }

  await sleep(JIKAN_DELAY_MS)
  const res = await fetch(`https://api.jikan.moe/v4/anime/${malId}/characters`)

  if (!res.ok) {
    if (res.status === 429) {
      await sleep(2000)
      const retry = await fetch(`https://api.jikan.moe/v4/anime/${malId}/characters`)
      if (!retry.ok) return []
      const retryJson = await retry.json()
      const chars = (retryJson.data ?? []).map((c: { character: { name: string }; role: string }) => ({
        name: formatCharacterName(c.character.name),
        role: c.role,
      }))
      await supabase.from('jikan_anime_cache').upsert({ mal_id: malId, show_name: showName, characters: chars, cached_at: new Date().toISOString() })
      return chars
    }
    return []
  }

  const json = await res.json()
  const chars = (json.data ?? []).map((c: { character: { name: string }; role: string }) => ({
    name: formatCharacterName(c.character.name),
    role: c.role,
  }))

  await supabase.from('jikan_anime_cache').upsert({ mal_id: malId, show_name: showName, characters: chars, cached_at: new Date().toISOString() })
  return chars
}

// ---------------------------------------------------------------------------
// Quote filtering
// ---------------------------------------------------------------------------

function isValidQuote(q: YurippeQuote): boolean {
  // Filter: character === show (bad data)
  if (q.character.toLowerCase() === q.show.toLowerCase()) return false
  // Filter: non-anime sources
  if (NON_ANIME_SHOWS.has(q.show.toLowerCase())) return false
  // Filter: generic character names
  if (q.character.length <= 2) return false
  if (['narrator', 'unknown', 'n/a'].includes(q.character.toLowerCase())) return false
  // Filter: very short quotes
  if (q.quote.length < 15) return false
  return true
}

// ---------------------------------------------------------------------------
// Pick random decoys from the same anime
// ---------------------------------------------------------------------------

function pickDecoys(
  correctCharacter: string,
  allCharacters: JikanCharacter[],
  count: number
): string[] {
  // Prefer "Main" characters, then "Supporting"
  const mainChars = allCharacters
    .filter((c) => c.role === 'Main' && c.name !== correctCharacter)
  const supportChars = allCharacters
    .filter((c) => c.role === 'Supporting' && c.name !== correctCharacter)

  const pool = [...mainChars, ...supportChars]
  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count).map((c) => c.name)
}

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// ---------------------------------------------------------------------------
// Main: fetch and prepare anime quotes
// ---------------------------------------------------------------------------

export async function fetchAnimeQuotes(count: number): Promise<PreparedAnimeQuote[]> {
  // Fetch extra to compensate for filtering (~30% buffer)
  const fetchCount = Math.ceil(count * 1.4)
  const res = await fetch(`https://yurippe.vercel.app/api/quotes?random=${fetchCount}`)
  if (!res.ok) throw new Error(`Yurippe API error: ${res.status}`)

  const rawQuotes: YurippeQuote[] = await res.json()
  const validQuotes = rawQuotes.filter(isValidQuote)

  const prepared: PreparedAnimeQuote[] = []

  for (const q of validQuotes) {
    if (prepared.length >= count) break

    const correctCharacter = q.character

    // Search for anime in Jikan
    const malId = await searchAnimeId(q.show)
    if (malId === null) continue

    // Fetch character list
    const characters = await fetchCharacters(malId, q.show)
    if (characters.length < 4) continue

    // Check if the correct character is in the list (fuzzy match)
    const matchedCorrect = characters.find(
      (c) => c.name.toLowerCase() === correctCharacter.toLowerCase()
    )
    const displayCorrect = matchedCorrect?.name ?? correctCharacter

    // Pick 3 decoys from the same anime
    const decoys = pickDecoys(displayCorrect, characters, 3)
    if (decoys.length < 3) continue

    const choices = shuffleArray([displayCorrect, ...decoys])

    prepared.push({
      quote_text: q.quote,
      anime_name: q.show,
      correct_character: displayCorrect,
      choices,
    })
  }

  return prepared
}

export async function fetchSingleAnimeQuote(): Promise<PreparedAnimeQuote | null> {
  const results = await fetchAnimeQuotes(1)
  return results[0] ?? null
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/lib/anime-quotes.ts 2>&1 | head -20`

If there are type errors, fix them.

- [ ] **Step 3: Commit**

```bash
git add src/lib/anime-quotes.ts
git commit -m "feat: add anime quote fetching library with Jikan caching"
```

---

### Task 4: Validation Schema Updates

**Files:**
- Modify: `src/lib/validation.ts`

- [ ] **Step 1: Add wst_quote_source to createGameSchema**

In `src/lib/validation.ts`, add a new enum after `questionSourceEnum` (line 55):

```typescript
const wstQuoteSourceEnum = z.enum(['player', 'anime', 'both'])
```

Then add `wst_quote_source` to `createGameSchema` (after the `game_type` field on line 85):

```typescript
  wst_quote_source: wstQuoteSourceEnum.optional(),
```

- [ ] **Step 2: Add anime_choice to createVoteSchema**

Add `animeChoice` to `createVoteSchema` (after `targetParticipantId` on line 218):

```typescript
  animeChoice: z.string().max(200).optional().nullable(),
```

- [ ] **Step 3: Add anime quote API schemas**

Add at the end of the file, before the re-exports section:

```typescript
// ---------------------------------------------------------------------------
// Anime quotes (POST /api/anime-quotes)
// ---------------------------------------------------------------------------

export const fetchAnimeQuotesSchema = z.object({
  count: z.coerce.number().int().min(1).max(30),
  gameId: gameCodeString(),
  hostToken: hostTokenString(),
})

export type FetchAnimeQuotesInput = z.infer<typeof fetchAnimeQuotesSchema>

// ---------------------------------------------------------------------------
// Anime quote reroll (POST /api/anime-quotes/reroll)
// ---------------------------------------------------------------------------

export const rerollAnimeQuoteSchema = z.object({
  gameId: gameCodeString(),
  quoteId: uuidString('quoteId'),
  hostToken: hostTokenString(),
})

export type RerollAnimeQuoteInput = z.infer<typeof rerollAnimeQuoteSchema>
```

- [ ] **Step 4: Add wstQuoteSourceEnum to re-exports**

Add `wstQuoteSourceEnum` to the export block at the bottom of the file.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation.ts
git commit -m "feat(validation): add anime WST schemas"
```

---

### Task 5: Anime Quotes API Route

**Files:**
- Create: `src/app/api/anime-quotes/route.ts`

- [ ] **Step 1: Create the fetch endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchAnimeQuotes } from '@/lib/anime-quotes'
import { fetchAnimeQuotesSchema } from '@/lib/validation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const raw = await req.json()
  const parsed = fetchAnimeQuotesSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { count, gameId, hostToken } = parsed.data
  const gameCode = gameId.toUpperCase()

  // Validate host
  const { data: game } = await supabase
    .from('games')
    .select('host_token, status, game_type')
    .eq('id', gameCode)
    .maybeSingle()

  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  if (game.host_token !== hostToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  if (game.status !== 'waiting') return NextResponse.json({ error: 'Game already started' }, { status: 400 })
  if (game.game_type !== 'who_said_this') return NextResponse.json({ error: 'Game is not Who Said This' }, { status: 400 })

  try {
    const quotes = await fetchAnimeQuotes(count)

    // Store in anime_quote_pool
    if (quotes.length > 0) {
      const rows = quotes.map((q) => ({
        game_id: gameCode,
        quote_text: q.quote_text,
        anime_name: q.anime_name,
        correct_character: q.correct_character,
        choices: q.choices,
      }))

      const { error } = await supabase.from('anime_quote_pool').insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Return all non-removed quotes for this game
    const { data: pool } = await supabase
      .from('anime_quote_pool')
      .select('*')
      .eq('game_id', gameCode)
      .eq('removed', false)
      .order('created_at')

    return NextResponse.json({ quotes: pool ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch anime quotes'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/anime-quotes/route.ts
git commit -m "feat: add POST /api/anime-quotes endpoint"
```

---

### Task 6: Anime Quote Reroll API Route

**Files:**
- Create: `src/app/api/anime-quotes/reroll/route.ts`

- [ ] **Step 1: Create the reroll endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchSingleAnimeQuote } from '@/lib/anime-quotes'
import { rerollAnimeQuoteSchema } from '@/lib/validation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const raw = await req.json()
  const parsed = rerollAnimeQuoteSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { gameId, quoteId, hostToken } = parsed.data
  const gameCode = gameId.toUpperCase()

  // Validate host
  const { data: game } = await supabase
    .from('games')
    .select('host_token, status')
    .eq('id', gameCode)
    .maybeSingle()

  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  if (game.host_token !== hostToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  if (game.status !== 'waiting') return NextResponse.json({ error: 'Game already started' }, { status: 400 })

  // Mark old quote as removed
  const { error: removeError } = await supabase
    .from('anime_quote_pool')
    .update({ removed: true })
    .eq('id', quoteId)
    .eq('game_id', gameCode)

  if (removeError) return NextResponse.json({ error: removeError.message }, { status: 500 })

  // Fetch a replacement
  try {
    const newQuote = await fetchSingleAnimeQuote()
    if (!newQuote) {
      return NextResponse.json({ error: 'Could not find a replacement quote — try again' }, { status: 502 })
    }

    const { error: insertError } = await supabase.from('anime_quote_pool').insert({
      game_id: gameCode,
      quote_text: newQuote.quote_text,
      anime_name: newQuote.anime_name,
      correct_character: newQuote.correct_character,
      choices: newQuote.choices,
    })

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    // Return updated pool
    const { data: pool } = await supabase
      .from('anime_quote_pool')
      .select('*')
      .eq('game_id', gameCode)
      .eq('removed', false)
      .order('created_at')

    return NextResponse.json({ quotes: pool ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch replacement quote'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/anime-quotes/reroll/route.ts
git commit -m "feat: add POST /api/anime-quotes/reroll endpoint"
```

---

### Task 7: Extend who-said-this.ts — Anime Round Building & Tallying

**Files:**
- Modify: `src/lib/who-said-this.ts`

- [ ] **Step 1: Update mergeActiveRound to preserve anime_metadata**

In `src/lib/who-said-this.ts`, update the `mergeActiveRound` function (lines 15-25). Replace:

```typescript
export function mergeActiveRound(prev: Round | null, incoming: Round): Round {
  if (!prev || prev.id !== incoming.id) return incoming
  return {
    ...prev,
    ...incoming,
    quote_text: incoming.quote_text ?? prev.quote_text,
    quote_author_participant_id:
      incoming.quote_author_participant_id ?? prev.quote_author_participant_id,
    quote_submitted_at: incoming.quote_submitted_at ?? prev.quote_submitted_at,
  }
}
```

With:

```typescript
export function mergeActiveRound(prev: Round | null, incoming: Round): Round {
  if (!prev || prev.id !== incoming.id) return incoming
  return {
    ...prev,
    ...incoming,
    quote_text: incoming.quote_text ?? prev.quote_text,
    quote_author_participant_id:
      incoming.quote_author_participant_id ?? prev.quote_author_participant_id,
    quote_submitted_at: incoming.quote_submitted_at ?? prev.quote_submitted_at,
    anime_metadata: incoming.anime_metadata ?? prev.anime_metadata,
  }
}
```

- [ ] **Step 2: Add anime round building function**

Add the following after the `buildRoundsFromQuotePool` function (after line 130):

```typescript
export interface AnimeRoundInput {
  gameId: string
  participantIds: string[]
  animeQuotes: Array<{
    quote_text: string
    anime_name: string
    correct_character: string
    choices: string[]
  }>
  startIndex: number
  now: string
}

export function buildRoundsFromAnimePool({
  gameId,
  participantIds,
  animeQuotes,
  startIndex,
  now,
}: AnimeRoundInput) {
  const shuffled = shuffleQuotePool(animeQuotes)
  return shuffled.map((entry, index) => {
    const roundNumber = startIndex + index + 1
    const isFirst = roundNumber === 1
    return {
      game_id: gameId,
      round_number: roundNumber,
      participant_ids: participantIds,
      submitter_player_id: null,
      quote_text: entry.quote_text,
      quote_author_participant_id: null,
      quote_submitted_at: isFirst ? now : null,
      anime_metadata: {
        source: 'anime' as const,
        anime_name: entry.anime_name,
        correct_character: entry.correct_character,
        choices: entry.choices,
      },
      status: isFirst ? 'active' : 'pending',
      started_at: isFirst ? now : null,
      ended_at: null,
    }
  })
}
```

- [ ] **Step 3: Add anime vote tallying function**

Add after the existing `tallyWstVotes` function (after line 196):

```typescript
export interface AnimeWstTally {
  rows: Array<{ choice: string; count: number }>
  voterCount: number
  maxCount: number
  topGuesses: string[]
  correctCount: number
  correctCharacter: string
}

export function tallyAnimeWstVotes(
  votes: Vote[],
  choices: string[],
  correctCharacter: string
): AnimeWstTally {
  const counts = new Map<string, number>()
  for (const c of choices) counts.set(c, 0)
  let correctCount = 0

  for (const vote of votes) {
    const picked = vote.anime_choice
    if (!picked) continue
    counts.set(picked, (counts.get(picked) ?? 0) + 1)
    if (picked === correctCharacter) correctCount += 1
  }

  const rows = choices
    .map((c) => ({ choice: c, count: counts.get(c) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.choice.localeCompare(b.choice))

  const maxCount = rows.length > 0 ? rows[0].count : 0
  const topGuesses = rows.filter((r) => r.count === maxCount && maxCount > 0).map((r) => r.choice)

  return {
    rows,
    voterCount: votes.filter((v) => v.anime_choice).length,
    maxCount,
    topGuesses,
    correctCount,
    correctCharacter,
  }
}
```

- [ ] **Step 4: Extend tallyWstPlayerScores to handle anime rounds**

Replace the existing `tallyWstPlayerScores` function (lines 205-231) with:

```typescript
/** Points for picking the right name each round. */
export function tallyWstPlayerScores(
  rounds: { id: string; quote_author_participant_id?: string | null; submitter_player_id?: string | null; anime_metadata?: { correct_character: string } | null }[],
  votes: Vote[],
  players: Player[]
): WstPlayerScore[] {
  const scores = new Map<string, number>()
  for (const p of players) scores.set(p.id, 0)

  for (const round of rounds) {
    const roundVotes = votes.filter((v) => v.round_id === round.id)

    if (round.anime_metadata) {
      // Anime round: compare anime_choice against correct_character
      const correctChar = round.anime_metadata.correct_character
      for (const vote of roundVotes) {
        if (vote.anime_choice === correctChar) {
          scores.set(vote.player_id, (scores.get(vote.player_id) ?? 0) + 1)
        }
      }
    } else {
      // Player round: compare target_participant_id
      const correctId = wstCorrectParticipantIdFromRound(round, players)
      if (!correctId) continue
      for (const vote of roundVotes) {
        if (vote.target_participant_id === correctId) {
          scores.set(vote.player_id, (scores.get(vote.player_id) ?? 0) + 1)
        }
      }
    }
  }

  return [...scores.entries()]
    .map(([playerId, correctGuesses]) => ({
      playerId,
      name: players.find((p) => p.id === playerId)?.name ?? 'Unknown',
      correctGuesses,
    }))
    .sort((a, b) => b.correctGuesses - a.correctGuesses || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}
```

- [ ] **Step 5: Add helper to check if round is anime**

Add near the top of the file (after the imports):

```typescript
export function isAnimeRound(round: { anime_metadata?: unknown | null }): boolean {
  return round.anime_metadata != null
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/who-said-this.ts
git commit -m "feat: add anime round building, tallying, and scoring"
```

---

### Task 8: Update Vote API Route

**Files:**
- Modify: `src/app/api/votes/route.ts`

- [ ] **Step 1: Add anime_choice handling for WST rounds**

In `src/app/api/votes/route.ts`, update the WST block (lines 80-105). Replace:

```typescript
  if (isWhoSaidThis(gameType)) {
    if (round.submitter_player_id === playerId) {
      return NextResponse.json({ error: 'The writer does not vote on their own quote' }, { status: 400 })
    }
    if (!round.quote_text) {
      return NextResponse.json({ error: 'Waiting for the quote before voting' }, { status: 400 })
    }

    const targetParticipantId =
      typeof rawTargetParticipantId === 'string' ? rawTargetParticipantId : null
    if (!targetParticipantId) {
      return NextResponse.json({ error: 'Pick who said it' }, { status: 400 })
    }
    if (!roundIdSet.has(targetParticipantId)) {
      return NextResponse.json({ error: 'Invalid pick — name not on the list' }, { status: 400 })
    }

    row = {
      kiss_participant_id: null,
      marry_participant_id: null,
      kill_participant_id: null,
      pair_assignments: null,
      wyr_choice: null,
      target_player_id: null,
      target_participant_id: targetParticipantId,
    }
  }
```

With:

```typescript
  if (isWhoSaidThis(gameType)) {
    // Fetch full round to check for anime_metadata
    const { data: fullRound } = await supabase
      .from('rounds')
      .select('anime_metadata')
      .eq('id', roundId)
      .maybeSingle()

    const animeMetadata = fullRound?.anime_metadata as { choices: string[]; correct_character: string } | null

    if (animeMetadata) {
      // Anime round: validate anime_choice
      if (!round.quote_text) {
        return NextResponse.json({ error: 'Waiting for the quote' }, { status: 400 })
      }

      const animeChoice = typeof parsed.data.animeChoice === 'string' ? parsed.data.animeChoice : null
      if (!animeChoice) {
        return NextResponse.json({ error: 'Pick a character' }, { status: 400 })
      }
      if (!animeMetadata.choices.includes(animeChoice)) {
        return NextResponse.json({ error: 'Invalid pick — not one of the choices' }, { status: 400 })
      }

      row = {
        kiss_participant_id: null,
        marry_participant_id: null,
        kill_participant_id: null,
        pair_assignments: null,
        wyr_choice: null,
        target_player_id: null,
        target_participant_id: null,
      }
      // We'll add anime_choice to the upsert separately
    } else {
      // Player round: existing logic
      if (round.submitter_player_id === playerId) {
        return NextResponse.json({ error: 'The writer does not vote on their own quote' }, { status: 400 })
      }
      if (!round.quote_text) {
        return NextResponse.json({ error: 'Waiting for the quote before voting' }, { status: 400 })
      }

      const targetParticipantId =
        typeof rawTargetParticipantId === 'string' ? rawTargetParticipantId : null
      if (!targetParticipantId) {
        return NextResponse.json({ error: 'Pick who said it' }, { status: 400 })
      }
      if (!roundIdSet.has(targetParticipantId)) {
        return NextResponse.json({ error: 'Invalid pick — name not on the list' }, { status: 400 })
      }

      row = {
        kiss_participant_id: null,
        marry_participant_id: null,
        kill_participant_id: null,
        pair_assignments: null,
        wyr_choice: null,
        target_player_id: null,
        target_participant_id: targetParticipantId,
      }
    }
  }
```

- [ ] **Step 2: Add anime_choice to the row type and upsert**

Update the `row` type declaration (lines 70-78) to include `anime_choice`:

```typescript
  let row: {
    kiss_participant_id: string | null
    marry_participant_id: string | null
    kill_participant_id: string | null
    pair_assignments: Record<string, PairFlag> | null
    wyr_choice: WyrChoice | null
    target_player_id: string | null
    target_participant_id: string | null
    anime_choice?: string | null
  }
```

Then in the anime round branch where `row` is set, add `anime_choice`:

```typescript
      row = {
        kiss_participant_id: null,
        marry_participant_id: null,
        kill_participant_id: null,
        pair_assignments: null,
        wyr_choice: null,
        target_player_id: null,
        target_participant_id: null,
        anime_choice: animeChoice,
      }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/votes/route.ts
git commit -m "feat: handle anime_choice in vote submission"
```

---

### Task 9: Update Game Creation API

**Files:**
- Modify: `src/app/api/games/route.ts`

- [ ] **Step 1: Store wst_quote_source when creating a game**

In `src/app/api/games/route.ts`, find where the game row is inserted into the database. Add `wst_quote_source` to the insert payload. Look for the object being inserted into the `games` table and add:

```typescript
wst_quote_source: parsed.data.wst_quote_source ?? 'player',
```

The exact location will be in the insert call around the game creation section. Read the file to find the exact line.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/games/route.ts
git commit -m "feat: store wst_quote_source on game creation"
```

---

### Task 10: Update Game Start Route

**Files:**
- Modify: `src/app/api/games/[code]/start/route.ts`

- [ ] **Step 1: Import anime round building function**

Add to the imports at the top:

```typescript
import { buildRoundsFromQuotePool, buildRoundsFromAnimePool, wstAutoRoundCount } from '@/lib/who-said-this'
```

(Replace the existing import that only imports `buildRoundsFromQuotePool` and `wstAutoRoundCount`.)

- [ ] **Step 2: Replace WST start block to handle anime + player + both modes**

Replace the WST block (lines 53-104) with:

```typescript
  if (isWhoSaidThis(gameType)) {
    const wstQuoteSource = (game.wst_quote_source ?? 'player') as string

    const { data: participantsData } = await supabase
      .from('participants')
      .select('id')
      .eq('game_id', code.toUpperCase())
      .order('display_order')

    const participantIds = (participantsData ?? []).map((p) => p.id)

    let playerRoundRows: ReturnType<typeof buildRoundsFromQuotePool> = []
    let animeRoundRows: ReturnType<typeof buildRoundsFromAnimePool> = []

    // Build player quote rounds
    if (wstQuoteSource === 'player' || wstQuoteSource === 'both') {
      if (wstQuoteSource === 'player') {
        if (participantIds.length < 2) {
          return NextResponse.json({ error: 'Need at least 2 names on the list' }, { status: 400 })
        }
        const submitters = playersData.filter((p) => p.participant_id)
        if (submitters.length < 2) {
          return NextResponse.json(
            { error: 'Need at least 2 players who claimed a name from the list' },
            { status: 400 }
          )
        }
      }

      const { data: poolEntries } = await supabase
        .from('wst_quote_pool')
        .select('*')
        .eq('game_id', code.toUpperCase())

      const quotes = poolEntries ?? []
      if (wstQuoteSource === 'player' && quotes.length < 2) {
        return NextResponse.json(
          { error: 'Need at least 2 quotes in the pool before starting — players submit quotes in the lobby' },
          { status: 400 }
        )
      }

      if (quotes.length > 0) {
        const count = wstAutoRoundCount(quotes.length)
        playerRoundRows = buildRoundsFromQuotePool({
          gameId: code.toUpperCase(),
          participantIds,
          poolEntries: quotes.slice(0, count),
          now,
        })
      }
    }

    // Build anime quote rounds
    if (wstQuoteSource === 'anime' || wstQuoteSource === 'both') {
      const { data: animePool } = await supabase
        .from('anime_quote_pool')
        .select('*')
        .eq('game_id', code.toUpperCase())
        .eq('removed', false)
        .order('created_at')

      const animeQuotes = animePool ?? []
      if (wstQuoteSource === 'anime' && animeQuotes.length < 2) {
        return NextResponse.json(
          { error: 'Need at least 2 anime quotes before starting — fetch quotes in the lobby' },
          { status: 400 }
        )
      }

      if (animeQuotes.length > 0) {
        animeRoundRows = buildRoundsFromAnimePool({
          gameId: code.toUpperCase(),
          participantIds,
          animeQuotes: animeQuotes.map((q) => ({
            quote_text: q.quote_text,
            anime_name: q.anime_name,
            correct_character: q.correct_character,
            choices: q.choices as string[],
          })),
          startIndex: playerRoundRows.length,
          now,
        })
      }
    }

    // Combine and shuffle
    const allRoundRows = [...playerRoundRows, ...animeRoundRows]
    if (allRoundRows.length < 2) {
      return NextResponse.json({ error: 'Need at least 2 total quotes to start' }, { status: 400 })
    }

    // Shuffle all rounds together, then re-number
    for (let i = allRoundRows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[allRoundRows[i], allRoundRows[j]] = [allRoundRows[j], allRoundRows[i]]
    }
    allRoundRows.forEach((r, i) => {
      r.round_number = i + 1
      r.status = i === 0 ? 'active' : 'pending'
      r.started_at = i === 0 ? now : null
      r.quote_submitted_at = i === 0 ? now : null
    })

    const { error: roundError } = await supabase.from('rounds').insert(allRoundRows)
    if (roundError) return NextResponse.json({ error: roundError.message }, { status: 500 })

    const { error: gameError } = await supabase
      .from('games')
      .update({ status: 'active', current_round_number: 1, rounds_count: allRoundRows.length })
      .eq('id', code.toUpperCase())

    if (gameError) return NextResponse.json({ error: gameError.message }, { status: 500 })

    return NextResponse.json({ success: true })
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/games/[code]/start/route.ts
git commit -m "feat: handle anime + player + both quote sources on game start"
```

---

### Task 11: Game Creation Wizard — Quote Source Toggle

**Files:**
- Modify: `src/app/create/page.tsx`

- [ ] **Step 1: Add WstQuoteSource import and state**

Add to imports at the top:

```typescript
import type { ParticipantGender, ParticipantMode, GameType, PairVoteMode, QuestionSource, WstQuoteSource } from '@/types'
```

Add state variable after the existing state declarations (around line 87):

```typescript
const [wstQuoteSource, setWstQuoteSource] = useState<WstQuoteSource>('player')
```

- [ ] **Step 2: Reset wstQuoteSource when game type changes**

In the `selectGameType` function (lines 158-169), add at the top of the function body:

```typescript
  setWstQuoteSource('player')
```

- [ ] **Step 3: Add the quote source segmented control in the WST settings area**

Find the WST-specific section (lines 449-453) where it shows the "Rounds are automatic" message. Replace:

```typescript
   {isWst ? (
     <p className="text-faint text-sm leading-relaxed">
       Rounds are automatic — one turn per player who joins and claims their name. 
       The count updates in the host lobby as people join.
     </p>
   ) : (
```

With:

```typescript
   {isWst ? (
     <div className="space-y-4">
       <Field label="Quote source">
         <SegmentedControl
           value={wstQuoteSource}
           onChange={(v) => setWstQuoteSource(v)}
           options={[
             { value: 'player' as WstQuoteSource, label: 'Player Quotes', hint: 'Players submit quotes in the lobby' },
             { value: 'anime' as WstQuoteSource, label: 'Anime Quotes', hint: 'Quotes from anime characters' },
             { value: 'both' as WstQuoteSource, label: 'Both', hint: 'Mix player + anime quotes' },
           ]}
         />
       </Field>
       <p className="text-faint text-sm leading-relaxed">
         {wstQuoteSource === 'anime'
           ? 'Anime quotes are fetched in the lobby — no player submissions needed.'
           : wstQuoteSource === 'both'
             ? 'Players submit quotes and anime quotes are fetched — both are shuffled together.'
             : 'Rounds are automatic — one turn per player who joins and claims their name. The count updates in the host lobby as people join.'}
       </p>
     </div>
   ) : (
```

- [ ] **Step 4: Pass wstQuoteSource in the game creation payload**

In the `createGame` function (around line 384-395), add `wst_quote_source` to the JSON body. Find the `JSON.stringify` call and add after the `participants` field:

```typescript
  wst_quote_source: isWst ? wstQuoteSource : undefined,
```

- [ ] **Step 5: Commit**

```bash
git add src/app/create/page.tsx
git commit -m "feat: add WST quote source toggle in creation wizard"
```

---

### Task 12: Host Lobby — Anime Quote Preview

**Files:**
- Modify: `src/app/host/[code]/page.tsx`

This is the largest UI task. The host lobby needs to show anime quotes, allow re-rolling, removing, and fetching more.

- [ ] **Step 1: Add imports and state**

Add to the type imports:

```typescript
import type { Game, Participant, Player, Round, Vote, Confession, VoteAssignment, WstQuotePoolEntry, AnimeQuotePoolEntry } from '@/types'
```

Add state variables near the WST pool state (after `const [wstPool, setWstPool] = ...`):

```typescript
const [animePool, setAnimePool] = useState<AnimeQuotePoolEntry[]>([])
const [animeFetching, setAnimeFetching] = useState(false)
const [animeError, setAnimeError] = useState<string | null>(null)
```

- [ ] **Step 2: Fetch anime pool on load**

In the initial data load (around lines 128-135 where wst_quote_pool is fetched), add after the WST pool fetch:

```typescript
  // Also fetch anime quote pool
  if (isWhoSaidThis(parseGameType(gameData.game_type))) {
    const { data: aPool } = await supabase
      .from('anime_quote_pool')
      .select('*')
      .eq('game_id', gameCode)
      .eq('removed', false)
      .order('created_at')
    setAnimePool(aPool ?? [])
  }
```

- [ ] **Step 3: Add anime quote management functions**

Add these handler functions in the component body (near other handler functions):

```typescript
  const fetchAnimeQuotes = async (count: number) => {
    if (!game || animeFetching) return
    setAnimeFetching(true)
    setAnimeError(null)
    try {
      const res = await fetch('/api/anime-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count, gameId: game.id, hostToken }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAnimeError(data.error || 'Failed to fetch quotes')
        return
      }
      setAnimePool(data.quotes)
    } catch {
      setAnimeError('Network error — try again')
    } finally {
      setAnimeFetching(false)
    }
  }

  const rerollAnimeQuote = async (quoteId: string) => {
    if (!game) return
    try {
      const res = await fetch('/api/anime-quotes/reroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id, quoteId, hostToken }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to reroll')
        return
      }
      setAnimePool(data.quotes)
    } catch {
      toast.error('Network error — try again')
    }
  }

  const removeAnimeQuote = async (quoteId: string) => {
    if (!game) return
    const { error } = await supabase
      .from('anime_quote_pool')
      .update({ removed: true })
      .eq('id', quoteId)
    if (!error) {
      setAnimePool((prev) => prev.filter((q) => q.id !== quoteId))
    }
  }
```

- [ ] **Step 4: Add anime pool rendering in the lobby waiting view**

Find the WST pool status section (around lines 951-1021). After the closing `</div>` of the WST pool card (`{isWst && wstPoolStatus && (...)}`), add a new section for the anime pool:

```typescript
{isWst && (game?.wst_quote_source === 'anime' || game?.wst_quote_source === 'both') && (
  <div className="glass-card p-4 space-y-4">
    <div className="flex items-center justify-between gap-2">
      <p className="text-muted text-xs uppercase tracking-wider">Anime quotes</p>
      <span className="text-sm font-bold text-body">{animePool.length} loaded</span>
    </div>

    {animePool.length === 0 && !animeFetching && (
      <button
        onClick={() => fetchAnimeQuotes(10)}
        className="btn-primary w-full"
      >
        Fetch Anime Quotes
      </button>
    )}

    {animeFetching && (
      <div className="text-center py-6 space-y-2">
        <div className="animate-spin h-6 w-6 border-2 border-teal-400 border-t-transparent rounded-full mx-auto" />
        <p className="text-muted text-sm">Fetching quotes & characters...</p>
        <p className="text-faint text-xs">This can take 15-20 seconds</p>
      </div>
    )}

    {animeError && (
      <div className="text-red-400 text-sm text-center py-2">
        {animeError}
        <button onClick={() => fetchAnimeQuotes(10)} className="block mx-auto mt-2 text-xs underline">
          Try again
        </button>
      </div>
    )}

    {animePool.length > 0 && (
      <div className="space-y-2">
        {animePool.map((q) => (
          <div key={q.id} className="surface-inset rounded-xl px-3 py-2.5 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-body text-sm italic truncate">&ldquo;{q.quote_text}&rdquo;</p>
                <p className="text-faint text-xs mt-0.5">{q.anime_name}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => rerollAnimeQuote(q.id)}
                  className="text-xs text-muted hover:text-body px-1.5 py-0.5 rounded-lg hover:bg-white/5"
                  title="Replace with a different quote"
                >
                  🔄
                </button>
                <button
                  onClick={() => removeAnimeQuote(q.id)}
                  className="text-xs text-muted hover:text-red-400 px-1.5 py-0.5 rounded-lg hover:bg-white/5"
                  title="Remove this quote"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
        <button
          onClick={() => fetchAnimeQuotes(5)}
          disabled={animeFetching}
          className="w-full text-center text-sm font-semibold text-[var(--primary)] hover:opacity-80 transition-opacity pt-1"
        >
          {animeFetching ? 'Fetching...' : 'Fetch more quotes'}
        </button>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 5: Update canStart logic for anime mode**

Find the `canStart` variable (around lines 858-876). Update the WST condition. Replace:

```typescript
const canStart = isWst
  ? participants.length >= 2 && wstSubmitters.length >= 2 && wstPool.length >= 2
```

With:

```typescript
const wstSource = game?.wst_quote_source ?? 'player'
const animeQuoteCount = animePool.length
const playerQuoteCount = wstPool.length
const totalQuotes = (wstSource === 'player' ? 0 : animeQuoteCount) + (wstSource === 'anime' ? 0 : playerQuoteCount)
const canStart = isWst
  ? wstSource === 'anime'
    ? animeQuoteCount >= 2
    : wstSource === 'both'
      ? totalQuotes >= 2
      : participants.length >= 2 && wstSubmitters.length >= 2 && wstPool.length >= 2
```

- [ ] **Step 6: Update the start button disabled text for anime mode**

In the start button disabled message area (around lines 1342-1380), update the WST messages. Find:

```typescript
      : isWst && participants.length < 2
        ? `Need at least 2 names on the list (${participants.length}/2)`
      : isWst && wstSubmitters.length < 2
        ? `Need 2+ players who claimed a name (${wstSubmitters.length} ready)`
      : isWst && wstPool.length < 2
        ? `Need 2+ quotes in the pool (${wstPool.length} submitted)`
```

Replace with:

```typescript
      : isWst && wstSource === 'anime' && animeQuoteCount < 2
        ? `Need 2+ anime quotes (${animeQuoteCount} loaded)`
      : isWst && wstSource === 'both' && totalQuotes < 2
        ? `Need 2+ total quotes (${totalQuotes} ready)`
      : isWst && wstSource === 'player' && participants.length < 2
        ? `Need at least 2 names on the list (${participants.length}/2)`
      : isWst && wstSource === 'player' && wstSubmitters.length < 2
        ? `Need 2+ players who claimed a name (${wstSubmitters.length} ready)`
      : isWst && wstSource === 'player' && wstPool.length < 2
        ? `Need 2+ quotes in the pool (${wstPool.length} submitted)`
```

- [ ] **Step 7: Hide player quote pool section when anime-only mode**

Wrap the existing WST pool status section with a condition. Find `{isWst && wstPoolStatus && (` and change to:

```typescript
{isWst && wstPoolStatus && (game?.wst_quote_source ?? 'player') !== 'anime' && (
```

- [ ] **Step 8: Update lobby round count display for anime mode**

Find where `lobbyQuestionMax` is computed (around line 831) and update:

```typescript
const lobbyQuestionMax = isWyr || isMlt ? questionPoolCap(game) : isWst ? wstAutoRoundCount(
  (game?.wst_quote_source === 'anime' ? 0 : wstPool.length || wstSubmitters.length) +
  (game?.wst_quote_source === 'player' ? 0 : animePool.length)
) : maxRecommendedRounds(participantInputs, gameType)
```

- [ ] **Step 9: Commit**

```bash
git add src/app/host/[code]/page.tsx
git commit -m "feat: add anime quote preview and management in host lobby"
```

---

### Task 13: Player Voting UI — Multiple Choice for Anime Rounds

**Files:**
- Modify: `src/app/game/[code]/page.tsx`

- [ ] **Step 1: Add anime choice state**

Add a new state variable near the other vote state (around line 75):

```typescript
const [animeChoice, setAnimeChoice] = useState<string | null>(null)
```

Add a ref for it (near the other refs around lines 203-204):

```typescript
const animeChoiceRef = useRef(animeChoice)
animeChoiceRef.current = animeChoice
```

- [ ] **Step 2: Reset anime choice on round change**

Find where `mltTargetPlayerId` is reset when the round changes (look for `setMltTargetPlayerId(null)` in a useEffect). Add after it:

```typescript
setAnimeChoice(null)
```

- [ ] **Step 3: Import isAnimeRound**

Add to the imports from `@/lib/who-said-this`:

```typescript
import { ..., isAnimeRound, tallyAnimeWstVotes } from '@/lib/who-said-this'
```

(Add `isAnimeRound` and `tallyAnimeWstVotes` to the existing import.)

- [ ] **Step 4: Add anime multiple-choice UI in the WST voting section**

Find the WST round display section (around lines 1562-1638). This section shows the quote and the NameSearchPicker. We need to add a conditional branch for anime rounds.

Find the `canVote && !submitted` block inside the WST section (around line 1614). Replace the entire voting block (from `{canVote && !submitted ? (` through the submitted confirmation) with:

```typescript
{canVote && !submitted ? (
  currentRound.anime_metadata ? (
    // Anime round — multiple choice buttons
    <>
      <div className="grid grid-cols-1 gap-2 mt-4">
        {(currentRound.anime_metadata as { choices: string[] }).choices.map((choice) => (
          <button
            key={choice}
            onClick={() => setAnimeChoice(choice)}
            className={`text-left px-4 py-3 rounded-xl border transition-all ${
              animeChoice === choice
                ? 'border-teal-400 bg-teal-500/15 text-body'
                : 'border-white/10 bg-white/5 text-muted hover:border-white/20 hover:bg-white/8'
            }`}
          >
            {choice}
          </button>
        ))}
      </div>
      <button
        onClick={handleSubmit}
        disabled={!animeChoice}
        className={`mt-6 ${animeChoice ? 'btn-primary' : 'btn-secondary opacity-60 cursor-not-allowed'}`}
      >
        {animeChoice ? 'Submit Guess ✓' : 'Pick a character'}
      </button>
    </>
  ) : (
    // Player round — existing name search picker
    <>
      <NameSearchPicker
        options={targets.map((p) => ({ id: p.id, name: p.name }))}
        valueId={mltTargetPlayerId}
        onChange={(id) => setMltTargetPlayerId(id)}
        searchPlaceholder="Search names…"
        emptyMessage="No names match"
      />
      <button
        onClick={handleSubmit}
        disabled={!mltTargetPlayerId}
        className={`mt-6 ${mltTargetPlayerId ? 'btn-primary' : 'btn-secondary opacity-60 cursor-not-allowed'}`}
      >
        {mltTargetPlayerId ? 'Submit Guess ✓' : 'Pick who said it'}
      </button>
    </>
  )
) : canVote && submitted ? (
  <div className="glass-card border border-emerald-500/30 px-4 py-4 text-center mt-4">
    <p className="text-green-400 font-semibold">✓ Guess submitted!</p>
  </div>
) : !isSubmitter && quote ? null : null}
```

- [ ] **Step 5: Add anime name display above the quote for anime rounds**

Find the quote display card (around line 1600-1612). After the `<p className="text-faint text-xs uppercase tracking-wider mb-2">Who said this?</p>` line, add:

```typescript
{currentRound.anime_metadata && (
  <p className="text-teal-400 text-xs font-semibold mb-1">
    {(currentRound.anime_metadata as { anime_name: string }).anime_name}
  </p>
)}
```

- [ ] **Step 6: Update vote submission to send anime_choice**

Find the `handleSubmit` function and the `voteBody` construction for WST (around line 1029-1030). Replace:

```typescript
  : isWhoSaidThis(submitGameType)
  ? { targetParticipantId: mltTargetPlayerId }
```

With:

```typescript
  : isWhoSaidThis(submitGameType)
  ? currentRound?.anime_metadata
    ? { animeChoice: animeChoiceRef.current }
    : { targetParticipantId: mltTargetPlayerId }
```

- [ ] **Step 7: Update auto-submit to handle anime rounds**

Find the auto-submit logic for WST (search for where `mltTargetPlayerIdRef` is used in auto-submit). Add a branch for anime rounds. If no anime choice was made and it's an anime round, auto-submit should pick a random choice:

Find the auto-submit handler and add, before the WST auto-submit logic:

```typescript
// Anime WST auto-submit: pick random choice if not selected
if (isWhoSaidThis(submitGameType) && currentRound?.anime_metadata && !animeChoiceRef.current) {
  const choices = (currentRound.anime_metadata as { choices: string[] }).choices
  animeChoiceRef.current = choices[Math.floor(Math.random() * choices.length)]
  setAnimeChoice(animeChoiceRef.current)
}
```

- [ ] **Step 8: Commit**

```bash
git add src/app/game/[code]/page.tsx
git commit -m "feat: add multiple-choice voting UI for anime WST rounds"
```

---

### Task 14: Anime Round Results Display

**Files:**
- Modify: `src/components/VoteResults.tsx`

- [ ] **Step 1: Add AnimeWstRoundResults component**

Add after the existing `WstRoundResults` component (after line 595):

```typescript
export function AnimeWstRoundResults({
  quote,
  animeName,
  rows,
  voterCount,
  maxCount,
  topGuesses,
  correctCharacter,
  correctCount,
  myPickName,
}: {
  quote: string
  animeName: string
  rows: Array<{ choice: string; count: number }>
  voterCount: number
  maxCount: number
  topGuesses: string[]
  correctCharacter: string
  correctCount: number
  myPickName?: string | null
}) {
  const barMax = Math.max(maxCount, 1)

  return (
    <div className="space-y-4">
      <p className="text-muted text-xs uppercase tracking-wider text-center">
        Round results · {voterCount} {voterCount === 1 ? 'vote' : 'votes'}
      </p>
      <div className="glass-card border-2 border-teal-500/30 rounded-2xl p-5 space-y-4">
        <div className="text-center space-y-1">
          <p className="text-[10px] uppercase tracking-wider label-teal">The quote</p>
          <p className="text-body text-base leading-snug font-medium italic">&ldquo;{quote}&rdquo;</p>
          <p className="text-teal-400 text-xs font-semibold mt-1">{animeName}</p>
        </div>

        <div className="surface-inset rounded-xl px-4 py-4 text-center ring-1 ring-teal-400/20">
          <p className="text-[10px] uppercase tracking-wider label-teal mb-1">Said by</p>
          <p className="text-2xl font-black text-body">{correctCharacter}</p>
          <p className="text-faint text-xs mt-1">
            {correctCount} of {voterCount} guessed right
          </p>
        </div>

        {topGuesses.length > 0 && maxCount > 0 && (
          <p className="text-faint text-xs text-center">
            Top guess{topGuesses.length > 1 ? 'es' : ''}: {topGuesses.join(', ')} ({maxCount} vote{maxCount === 1 ? '' : 's'})
          </p>
        )}

        <div className="space-y-2">
          {rows.map((row) => {
            const isTop = maxCount > 0 && row.count === maxCount
            const isCorrect = row.choice === correctCharacter
            const pct = Math.min((row.count / barMax) * 100, 100)
            return (
              <div
                key={row.choice}
                className={`rounded-xl px-3 py-2.5 ${
                  isCorrect ? 'result-row-winner-teal' : isTop ? 'result-row-winner' : 'result-row'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className={`text-sm truncate ${isCorrect ? 'text-accent-correct' : 'text-body'}`}>
                    {row.choice}{isCorrect ? ' ✓' : ''}
                  </p>
                  <span className="text-sm font-bold text-body shrink-0">{row.count}</span>
                </div>
                <div className="bar-track-xs">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: isCorrect ? '#2dd4bf' : '#64748b' }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {myPickName && (
          <p className="text-faint text-xs text-center">You guessed {myPickName}</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/VoteResults.tsx
git commit -m "feat: add AnimeWstRoundResults component"
```

---

### Task 15: Wire Anime Results into Host and Player Views

**Files:**
- Modify: `src/app/host/[code]/page.tsx`
- Modify: `src/app/game/[code]/page.tsx`

- [ ] **Step 1: Import AnimeWstRoundResults and tallyAnimeWstVotes in host page**

In `src/app/host/[code]/page.tsx`, update the import from `@/components/VoteResults`:

```typescript
import { ParticipantRoundResults, VoteCountStat, WyrRoundResults, MltRoundResults, WstRoundResults, AnimeWstRoundResults } from '@/components/VoteResults'
```

Add to the import from `@/lib/who-said-this`:

```typescript
import { ..., isAnimeRound, tallyAnimeWstVotes } from '@/lib/who-said-this'
```

- [ ] **Step 2: Update host between-rounds WST results**

Find where `WstRoundResults` is used in the between-rounds section (around lines 1712-1729). Replace the entire `{isWst ? (` block with:

```typescript
{isWst ? (
  (() => {
    if (isAnimeRound(lastFinishedRound)) {
      const meta = lastFinishedRound.anime_metadata as { anime_name: string; correct_character: string; choices: string[] }
      const animeTally = tallyAnimeWstVotes(roundVotes, meta.choices, meta.correct_character)
      return (
        <AnimeWstRoundResults
          quote={lastFinishedRound.quote_text ?? '(no quote)'}
          animeName={meta.anime_name}
          rows={animeTally.rows}
          voterCount={animeTally.voterCount}
          maxCount={animeTally.maxCount}
          topGuesses={animeTally.topGuesses}
          correctCharacter={meta.correct_character}
          correctCount={animeTally.correctCount}
        />
      )
    }
    const targets = wstVoteTargets(participants)
    const correctName = wstCorrectNameFromRound(lastFinishedRound, players, participants)
    const correctId = wstCorrectParticipantIdFromRound(lastFinishedRound, players)
    const wstTally = tallyWstVotes(roundVotes, targets, correctId)
    return (
      <WstRoundResults
        quote={lastFinishedRound.quote_text ?? '(no quote submitted)'}
        rows={wstTally.rows}
        voterCount={wstTally.voterCount}
        maxCount={wstTally.maxCount}
        topGuesses={wstTally.topGuesses}
        correctName={correctName}
        correctCount={wstTally.correctCount}
      />
    )
  })()
```

- [ ] **Step 3: Update host finals WST results**

Find where `WstRoundResults` is used in the finals/all-rounds section (around lines 1917-1945). Replace the inner `return` block with:

```typescript
      return (
        <div key={round.id}>
          <h2 className="text-muted text-xs uppercase tracking-wider mb-3">
            Round {round.round_number}
          </h2>
          {isAnimeRound(round) ? (() => {
            const meta = round.anime_metadata as { anime_name: string; correct_character: string; choices: string[] }
            const animeTally = tallyAnimeWstVotes(roundVotes, meta.choices, meta.correct_character)
            return (
              <AnimeWstRoundResults
                quote={round.quote_text ?? '(no quote)'}
                animeName={meta.anime_name}
                rows={animeTally.rows}
                voterCount={animeTally.voterCount}
                maxCount={animeTally.maxCount}
                topGuesses={animeTally.topGuesses}
                correctCharacter={meta.correct_character}
                correctCount={animeTally.correctCount}
              />
            )
          })() : (
            <WstRoundResults
              quote={round.quote_text ?? '(no quote submitted)'}
              rows={rows}
              voterCount={voterCount}
              maxCount={maxCount}
              topGuesses={topGuesses}
              correctName={correctName}
              correctCount={correctCount}
            />
          )}
        </div>
      )
```

- [ ] **Step 4: Import and wire in player game page**

In `src/app/game/[code]/page.tsx`, update imports:

```typescript
import { AnimeWstRoundResults } from '@/components/VoteResults'
```

(Add to existing VoteResults import line.)

Find the player results view where `WstRoundResults` is used (around lines 1957-2008). Add the anime branch similar to step 2 — check `isAnimeRound(lastFinishedRound)` and render `AnimeWstRoundResults` with `tallyAnimeWstVotes`, else render existing `WstRoundResults`.

For the player's "my pick" display, compute:

```typescript
const myPickName = lastFinishedRound.anime_metadata
  ? myVote?.anime_choice ?? null
  : myVote?.target_participant_id
    ? participants.find((p) => p.id === myVote.target_participant_id)?.name ?? null
    : null
```

- [ ] **Step 5: Commit**

```bash
git add src/app/host/[code]/page.tsx src/app/game/[code]/page.tsx
git commit -m "feat: wire anime round results into host and player views"
```

---

### Task 16: Player Lobby — Anime-Only Waiting Screen

**Files:**
- Modify: `src/app/game/[code]/page.tsx`

- [ ] **Step 1: Show waiting message instead of quote submission for anime-only mode**

Find the WST lobby/waiting view where players submit quotes. Look for the quote submission UI in the waiting/lobby phase. Add a check: if `game.wst_quote_source === 'anime'`, show a waiting message instead of the quote submission form.

Find the section and wrap it:

```typescript
{game?.wst_quote_source === 'anime' ? (
  <div className="glass-card px-4 py-8 text-center space-y-2">
    <p className="text-body text-lg font-semibold">Anime Quote Mode</p>
    <p className="text-muted text-sm">The host is loading anime quotes — sit tight!</p>
  </div>
) : (
  // Existing quote submission UI
  ...
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/game/[code]/page.tsx
git commit -m "feat: show anime waiting screen in player lobby"
```

---

### Task 17: Build and Verify

**Files:** None (verification only)

- [ ] **Step 1: Run the build**

Run: `npm run build`

Fix any TypeScript or build errors that appear. Common issues to watch for:
- Missing imports
- Type mismatches between `anime_metadata` casts
- Missing `anime_choice` in vote row types

- [ ] **Step 2: Manual smoke test**

Start dev server: `npm run dev`

Test the following flow:
1. Create a WST game with "Anime Quotes" source
2. Join with 2+ players
3. Host clicks "Fetch Anime Quotes" in lobby
4. Host sees quotes load with re-roll/remove buttons
5. Host starts game
6. Players see anime quote with 4 character buttons
7. Players vote, results show correctly
8. Scores tally across rounds

- [ ] **Step 3: Test "Both" mode**

1. Create a WST game with "Both" source
2. Fetch anime quotes AND have players submit quotes
3. Start game — rounds should be mixed and shuffled
4. Verify both anime (multiple-choice) and player (name-picker) rounds work
5. Verify scoring works across both types

- [ ] **Step 4: Test "Player" mode (regression)**

1. Create a WST game with "Player Quotes" source (default)
2. Verify existing flow works exactly as before
3. No anime-related UI should appear

- [ ] **Step 5: Final commit**

If any fixes were needed during testing:

```bash
git add -A
git commit -m "fix: address build and integration issues for anime WST"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Database schema changes | `supabase/schema.sql` |
| 2 | TypeScript type updates | `src/types/index.ts` |
| 3 | Anime quote fetching library | `src/lib/anime-quotes.ts` (create) |
| 4 | Validation schema updates | `src/lib/validation.ts` |
| 5 | Anime quotes API route | `src/app/api/anime-quotes/route.ts` (create) |
| 6 | Anime quote reroll API route | `src/app/api/anime-quotes/reroll/route.ts` (create) |
| 7 | WST logic: anime round building & tallying | `src/lib/who-said-this.ts` |
| 8 | Vote API: handle anime_choice | `src/app/api/votes/route.ts` |
| 9 | Game creation API: store wst_quote_source | `src/app/api/games/route.ts` |
| 10 | Game start: anime + player + both modes | `src/app/api/games/[code]/start/route.ts` |
| 11 | Creation wizard: quote source toggle | `src/app/create/page.tsx` |
| 12 | Host lobby: anime quote preview & management | `src/app/host/[code]/page.tsx` |
| 13 | Player voting: multiple-choice anime UI | `src/app/game/[code]/page.tsx` |
| 14 | Anime results display component | `src/components/VoteResults.tsx` |
| 15 | Wire anime results into host & player views | `host/[code]/page.tsx`, `game/[code]/page.tsx` |
| 16 | Player lobby: anime waiting screen | `src/app/game/[code]/page.tsx` |
| 17 | Build verification & smoke testing | (none — testing) |
