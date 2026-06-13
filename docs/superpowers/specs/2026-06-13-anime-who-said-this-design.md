# Anime Who Said This — Design Spec

## Overview

Add anime quote support to the existing "Who Said This" (WST) game mode. Instead of only player-submitted quotes, the host can choose to include anime quotes sourced from external APIs. Players guess which anime character said the quote from 4 multiple-choice options (all characters from the same anime).

## Quote Source Toggle

When creating a WST game, the host selects a **Quote Source**:

- **Player Quotes** — existing behavior, players submit quotes in the lobby
- **Anime Quotes** — quotes fetched from APIs, no player submissions needed
- **Both** — anime quotes + player-submitted quotes mixed together

This is stored as a new field on the `games` table: `wst_quote_source: 'player' | 'anime' | 'both'` (default: `'player'`).

## External APIs

### Yurippe (anime quotes)
- **Endpoint:** `GET https://yurippe.vercel.app/api/quotes?random={count}`
- **Response:** `[{ _id, character, show, quote }]`
- **No auth required**, no documented rate limits
- **Data quality notes:**
  - Some entries have bad data where `character` equals `show` (~1%). Filter these out.
  - Some entries are from non-anime sources (e.g., Avatar: TLA, RWBY). Filter known non-anime sources via a blocklist.
  - Filter out quotes with generic character names (e.g., "Narrator") or very short quotes (< 15 chars).
  - Fetch ~30% extra quotes to compensate for filtering (e.g., request 26 for 20 needed).

### Jikan (character lists for decoy options)
- **Endpoint 1:** `GET https://api.jikan.moe/v4/anime?q={show}&limit=1` — search for anime by name, get `mal_id`
- **Endpoint 2:** `GET https://api.jikan.moe/v4/anime/{mal_id}/characters` — get full character list
- **No auth required**, rate limit: 3 req/sec, 60 req/min
- **Character name format:** "Last, First" — must reverse to "First Last" for display
- **Search reliability:** Jikan search may return wrong anime for some Yurippe show names (different romanizations, non-anime sources). After search, validate by fuzzy-comparing the Yurippe show name against Jikan's returned title + English title + synonyms. Discard quotes with low similarity (normalized Levenshtein distance > 0.4).

## Database Changes

### `games` table
Add column:
```sql
ALTER TABLE games ADD COLUMN wst_quote_source text NOT NULL DEFAULT 'player'
  CHECK (wst_quote_source IN ('player', 'anime', 'both'));
```

### Jikan cache tables
```sql
CREATE TABLE jikan_search_cache (
  show_name text PRIMARY KEY,
  mal_id integer, -- null means "no good match found"
  cached_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE jikan_anime_cache (
  mal_id integer PRIMARY KEY,
  show_name text NOT NULL,
  characters jsonb NOT NULL, -- [{name: string, role: string}]
  cached_at timestamptz NOT NULL DEFAULT now()
);
```

Cache TTL: 30 days. Check cache before each Jikan call. Dramatically reduces API calls after the first few games.

### `votes` table
Add column:
```sql
ALTER TABLE votes ADD COLUMN anime_choice text;
```

### `rounds` table
Add column:
```sql
ALTER TABLE rounds ADD COLUMN anime_metadata jsonb;
```

The `anime_metadata` JSONB stores (for anime-sourced rounds only):
```json
{
  "source": "anime",
  "anime_name": "Naruto",
  "correct_character": "Naruto Uzumaki",
  "choices": ["Naruto Uzumaki", "Sakura Haruno", "Kakashi Hatake", "Sasuke Uchiha"]
}
```

Player-sourced rounds have `anime_metadata` as `null` and continue using `quote_author_participant_id` as before.

## Game Creation Flow

1. Host selects "Who Said This" game type
2. New **Quote Source** segmented control appears: Player / Anime / Both
3. If "Anime" or "Both": host can optionally set desired anime round count (default: 10)
4. Game is created with `wst_quote_source` stored on the game record

## Lobby Flow

### Host View (Anime or Both mode)

When entering the lobby, a server-side API call fetches anime quotes:

1. **Fetch quotes:** `GET /api/anime-quotes?count={n}` — internal API route that:
   - Calls Yurippe for `n` random quotes (fetch extra to account for bad data filtering)
   - Filters out quotes where `character === show` (bad data)
   - For each unique anime show, calls Jikan to search for the anime and get its character list
   - Builds 4 multiple-choice options per quote: correct character + 3 random same-anime characters (prefer "Main" role characters as decoys)
   - Returns the prepared quote objects

2. **Host preview:** Host sees a list of fetched anime quotes showing:
   - Quote text (truncated preview)
   - Anime name
   - Re-roll button per quote (fetches a replacement)
   - Remove button per quote
   - "Fetch More" button at the bottom

3. **Combined view (Both mode):** Two sections — "Anime Quotes" and "Player Quotes" with counts for each

4. **Loading state:** Show spinner with progress indicator during Jikan lookups (~15-20 seconds for 20 quotes — 40 Jikan calls at 3 req/sec plus network latency)

### Host View (Player-only mode)
Unchanged from current behavior.

### Player View
- **Anime-only mode:** Waiting screen — "Waiting for host to start"
- **Both or Player mode:** Same as today — submit a quote and pick who said it

## Anime Quote Storage

Fetched anime quotes are stored in a new table to persist across lobby refreshes:

```sql
CREATE TABLE anime_quote_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  quote_text text NOT NULL,
  anime_name text NOT NULL,
  correct_character text NOT NULL,
  choices jsonb NOT NULL, -- string array of 4 character names
  removed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Host actions (re-roll, remove, fetch more) update this table. When the host starts the game, non-removed entries become rounds.

## Round Creation (Game Start)

The existing `buildRoundsFromQuotePool()` is extended (or a sibling function is created) to handle anime quotes:

1. **Player quotes** → rounds built as today using `wst_quote_pool` entries, setting `quote_text`, `quote_author_participant_id`, `submitter_player_id`
2. **Anime quotes** → rounds built from `anime_quote_pool` entries, setting `quote_text` and `anime_metadata` JSONB
3. **Both** → both sets combined, shuffled together, numbered sequentially

## Voting Mechanics

### Anime Rounds
- Display: quote text in a styled card, anime name as subtitle
- Input: 4 buttons showing character names (shuffled order)
- Vote stored: `target_participant_id` is `null`; the selected character name is stored in the new `anime_choice` text column on the `votes` table. The correct answer is in `anime_metadata.correct_character` on the round.

### Player Rounds
- Unchanged — searchable name picker, vote stored as `target_participant_id`

## Results Display

### Anime Round Results
- Show the quote
- Show "Said by: {correct_character} — {anime_name}" highlighted
- Show vote distribution: how many players picked each of the 4 choices
- Show correct count / total voters

### Player Round Results
- Unchanged from current behavior

The `WstRoundResults` component gets a conditional branch: if `round.anime_metadata` exists, render the multiple-choice tally; otherwise render the existing participant-based tally.

## Scoring

Scoring is the same across both round types: **1 point per correct guess**.

For anime rounds, a new `tallyAnimeWstVotes()` function tallies votes by `anime_choice` string (keyed on character name) instead of participant ID. The `tallyWstPlayerScores()` function is extended to detect anime rounds (via `round.anime_metadata !== null`) and compare the player's `anime_choice` against `anime_metadata.correct_character`.

## API Routes

### New: `POST /api/anime-quotes`
- **Request:** `{ count: number, game_id: string, host_token: string }`
- **Response:** `{ quotes: [{ quote_text, anime_name, correct_character, choices }] }`
- **Auth:** Requires valid `host_token` for the game
- Calls Yurippe + Jikan server-side
- Handles rate limiting (sequential Jikan calls with 350ms delays)
- Filters bad data (character === show, non-anime sources, generic names, short quotes)
- Validates Jikan search results via fuzzy title matching
- Ensures 4 same-anime choices per quote; discards quotes where < 4 characters available
- Checks Jikan cache before making external calls

### New: `POST /api/anime-quotes/reroll`
- **Request:** `{ game_id: string, quote_id: string, host_token: string }`
- **Auth:** Requires valid `host_token`
- Fetches one new random anime quote (any anime), replaces the specified entry in `anime_quote_pool`

### Modified: `POST /api/games/[code]/start`
- Extended to also read from `anime_quote_pool` when `wst_quote_source` is `'anime'` or `'both'`
- In "Both" mode, game can start with at least 2 total quotes (any combination of anime + player)

## Error Handling

- **Yurippe down:** Show error toast in lobby, host can retry. Game can still start with player-only quotes if in "Both" mode.
- **Jikan rate limited (429):** Queue requests with exponential backoff. Show progress indicator.
- **Not enough characters for decoys:** If an anime has < 4 characters in Jikan, discard the quote and fetch a replacement. Do not mix characters across anime shows.
- **Jikan search mismatch:** If fuzzy title comparison fails (Yurippe show name vs Jikan result), discard the quote and fetch a replacement.
- **Bad quote data:** Filter silently (character === show, non-anime sources, generic names, short quotes), fetch replacements.

## TypeScript Types

```typescript
interface AnimeMetadata {
  source: 'anime'
  anime_name: string
  correct_character: string
  choices: string[] // 4 character names, shuffled
}

interface AnimeQuotePoolEntry {
  id: string
  game_id: string
  quote_text: string
  anime_name: string
  correct_character: string
  choices: string[]
  removed: boolean
  created_at: string
}
```

Extend existing `Round` type to include `anime_metadata?: AnimeMetadata | null`.
Extend existing `Game` type to include `wst_quote_source: 'player' | 'anime' | 'both'`.
Extend existing `Vote` type to include `anime_choice?: string | null`.

### Realtime Considerations

- `anime_quote_pool` table does NOT need realtime — host fetches/manages it via API calls only.
- The `rounds` table already has realtime enabled. The `anime_metadata` JSONB column will be included in realtime updates automatically.
- `mergeActiveRound()` in `who-said-this.ts` must preserve `anime_metadata` when merging realtime round updates.

## Scope Boundaries

**In scope:**
- Quote source toggle on game creation
- Anime quote fetching, preview, re-roll in lobby
- Multiple-choice voting UI for anime rounds
- Combined anime + player rounds
- Scoring across both types

**In scope (added from review):**
- Jikan response caching (`jikan_anime_cache` and `jikan_search_cache` tables) to avoid redundant API calls across re-rolls and games
- Fuzzy title validation for Jikan search results
- Non-anime source blocklist filtering
- `anime_choice` column on votes (not reusing `wyr_choice`)

**Out of scope:**
- Anime character images/avatars (text-only for now)
- Difficulty settings (e.g., only use supporting characters as decoys)
- User accounts or API key management
