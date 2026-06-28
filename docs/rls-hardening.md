# RLS Hardening — Server-Authoritative Writes (Option A)

> Status: **In progress.** Phase 0 (foundations) landed. This is the living tracker for
> closing the permissive-RLS issue CodeRabbit flagged on PR #132.

## The problem

Every game-state table uses `FOR ALL USING (true) WITH CHECK (true)` (mostly granted to
`anon`). The Supabase **anon key ships in the public JS bundle**, so anyone can read,
update, or delete any row in any game directly — bypassing the API routes. On the write
side this means **cheating / griefing**: rewriting turns, token positions, and winners, or
deleting other people's game state.

Compounding it: the secret tokens we'd use to authorize are themselves exposed in open
reads today — `host_token` is in `GAME_SELECT` and `resume_token` is in `PLAYER_SELECT`
(`src/lib/supabase-selects.ts`). So token-based authz is meaningless until those columns
are hidden from anon (Phase 3).

## Hard constraints (must not regress)

1. **No auth anywhere.** Play is fully anonymous. Ownership is purely secret-token based
   (`games.host_token`, `players.resume_token`, `rooms.creator_token`,
   `room_members.member_code`). The design uses `auth.uid()` nowhere.
2. **Cross-device resume must keep working.** A player can move a game to another device
   and keep playing by carrying their `resume_token` (URL `?player=` or entered player
   code → `/api/players/resume` → `localStorage['kmk_player_<code>']`). Authorization is by
   the **token in the request**, never by device/cookie/IP — so any device with the correct
   token is authorized. This *strengthens* security (today moves are authorized by a bare,
   public `playerId`) while preserving cross-device play.

## Threat model (scope)

In scope: **write-side cheating/griefing of game state.** Out of scope (for now):
read-side data privacy — reads and realtime stay public, so the anon key can still *read*
any game. This is an accepted, documented decision; revisit only if the threat model
expands to privacy (which would be the point to consider anonymous Supabase auth).

## Design (Option A)

- **Anon key → SELECT only.** Reads stay open (realtime needs them); INSERT/UPDATE/DELETE
  on game-state tables are denied to anon.
- **All writes go through server routes using the service role**, which bypasses RLS.
- **The secret token is the authorization boundary.** Each write route validates:
  - host actions → `host_token` via `assertHost*` (`src/lib/game-admin.ts`)
  - player actions → `resume_token` via `assertPlayer` (`src/lib/game-admin.ts`), which
    resolves the player **server-side from the token** and ignores any client-supplied
    `playerId` (a public, forgeable value).
- **Tokens are never exposed to anon.** Removed from client SELECT lists and revoked at the
  DB (column privileges); only vended by server endpoints (create-game, join,
  `/api/players/resume`).

## Phases

- [x] **Phase 0 — Foundations**
  - [x] `getSupabaseAdmin()` fail-loud: no silent anon fallback in production
    (`src/lib/supabase-admin.ts`). Dev keeps an anon fallback with a warning.
  - [x] `assertPlayer(supabase, gameCode, resumeToken)` authz helper added
    (`src/lib/game-admin.ts`), mirroring the existing `assertHost*` helpers.
  - [x] This tracking doc / write inventory.
- [ ] **Phase 1 — Authorization boundary in routes**: switch the 61 anon write routes to the
  service-role client; enforce `assertHost` / `assertPlayer` on every write route; add
  `resumeToken` to player-write schemas; derive `playerId` from the token server-side.
- [ ] **Phase 2 — Move browser writes server-side**: convert direct browser writes (game-logic
  libs + components/hooks) to `fetch` calls to routes. Game-by-game.
- [ ] **Phase 3 — Hide tokens from reads**: drop `host_token`/`resume_token` from client
  SELECTs; `REVOKE SELECT (host_token) ON games FROM anon;` and likewise for
  `players.resume_token`.
- [ ] **Phase 4 — RLS lockdown**: per-game migrations replacing `FOR ALL USING(true)` with a
  SELECT-only `_read` policy and no anon write policy. Ship a game's lockdown **only after**
  its writes are server-side. Each lockdown ships with a drafted restore-permissive rollback.

## Branch & scope

All of this work lands on a **single branch** (`feat/rls-hardening`) and covers **all games**,
not just one. The per-game "slices" below are units of work and **verification**, not separate
branches or PRs — they all accumulate on the one branch.

## Staging rule (do not violate)

Per game: (a) move writes server-side + add token authz, **then** (b) add that game's RLS
lockdown migration. **Never add a table's lockdown before its writes are server-side** — order
the commits so the branch is always internally consistent. **Snake & Ladder goes first** as
the smallest end-to-end proof of the pattern, then the rest follow on the same branch.

## Per-game slice checklist (template)

For each game:
- [ ] All browser writes for the game moved into API routes
- [ ] Routes use the service-role client (`getSupabaseAdmin`)
- [ ] Host routes enforce `assertHost*`; player routes enforce `assertPlayer` (token, not playerId)
- [ ] `resumeToken` added to the game's player-action schemas
- [ ] Happy path verified with RLS locked (create → join → full turn loop → finish)
- [ ] **Cross-device resume verified** (join on A, move on B via token)
- [ ] Negative tests: anon write rejected; anon `select host_token`/`resume_token` rejected; move with wrong/absent token → 403
- [ ] Lockdown migration + restore-permissive rollback migration committed

---

## Inventory (generated — refine per slice)

### Write routes (direct `.insert/.update/.delete/.upsert` in the route)

`client=anon` must switch to the service role in Phase 1. `playerId-only(NO-AUTHZ)` is the
core hole: authorize by `resume_token` instead.

| Route | Client | Authz today | Writes |
|---|---|---|---|
| ai-questions | anon | HOST | games |
| anime-quotes, anime-quotes/reroll | anon | HOST | anime_quote_pool, games |
| anonymous-messages | anon | HOST | anonymous_messages, anonymous_room_bans, games, players |
| anonymous-room/bans | ADMIN | HOST | anonymous_room_bans, games, players |
| bingo/call, bingo/settings | anon | HOST | bingo_called_numbers, games |
| **bingo/claim, bingo/mark** | anon | **playerId-only** | bingo_*, games, players |
| **codewords/chat, clue, end-turn, guess, role** | anon | **playerId-only** | codewords_*, games, players |
| codewords/expire-turn | anon | NONE (system) | codewords_boards, games |
| codewords/host-role, timers | anon | HOST | codewords_*, games, players |
| confessions | anon | NONE | confessions |
| describe-it/balance, settings | anon | HOST | describe_it_players, games |
| **describe-it/team** | anon | **playerId-only** | describe_it_players, games, players |
| feedback | anon | NONE (public insert) | app_feedback |
| games/[code]/end-round, finish-game, lobby-pool, lobby-settings, next-round, play-again, start, [code], games/ | anon | HOST | games + many |
| **hot-seat** | anon | **playerId-only** | games, hot_seat_submissions, players, rounds |
| library, admin/* | ADMIN | NONE (admin-gated) | question_packs, product_updates, game_player_limits |
| **npat/dispute, draft, letter, mark, submit** | anon | **playerId-only** | npat_*, games, players, rounds |
| participants | anon | HOST | participants, players |
| **photos, player-participants, player-questions, players/promote, players/ready, quote** | anon | **playerId-only** | various |
| players | anon | HOST + RESUME | games, participants, players |
| rooms/* | anon | NONE | rooms, room_* , games |
| tournaments/* | anon | HOST (most) / NONE (players) | tournaments, tournament_* |
| **trivia/answer, two-truths/guess, two-truths/statements, votes, word-hunt/submit** | anon | **playerId-only** | various |
| wst-quotes | anon | HOST | games, participants, players, wst_quote_pool |

### Move/expire routes (writes happen in the game-logic lib they call)

These are the turn-based action routes. `playerId-only` = needs `resume_token` authz.
`NONE (system)` = expire/tick routes with no actor (timer-driven) — these still need to be
service-role and should be guarded (e.g. only act when the turn deadline has actually
passed) rather than token-authorized.

- **playerId-only (need RESUME authz):** chess/move, chess/resign, describe-it/clue, guess,
  skip, ludo/move, ludo/roll, monopoly/auction, build, buy, forfeit, jail, mortgage, rent,
  roll, settle-debt, trade, npat/caller-approve, scrabble/exchange, pass, play,
  **snake-and-ladder/roll**, tic-tac-toe/move, whot/choose, draw, play, yahtzee/hold, roll, score
- **HOST:** codewords/randomize-teams, describe-it/advance, extend-monopoly-time, extend-scrabble-time
- **NONE (system / timer):** bingo/sync, chess/expire-turn, describe-it/expire-turn, tick,
  expire-monopoly/scrabble/whot/word-hunt, ludo/expire-turn, monopoly/expire-turn,
  scrabble/expire-turn, **snake-and-ladder/expire-turn**, tic-tac-toe/expire-turn,
  whot/expire-turn, yahtzee/expire-turn

### Browser write files (Phase 2 — move server-side)

Game-logic libs (the real targets), highest write-count first:

`monopoly.ts` (30), `describe-it.ts` (22), `yahtzee.ts` (17), `whot.ts` (16), `scrabble.ts`
(15), `snake-and-ladder.ts` (13), `ludo.ts` (12), `codewords.ts` (9), `npat-advance.ts` (7),
`anime-quotes.ts` (7), `chess.ts` (6), `trivia-advance.ts` (5), `tic-tac-toe.ts` (5),
`npat.ts` (5), `anonymous-messages.ts` (5), `tournament-scoring.ts` (4),
`two-truths-advance.ts` (3), `room-points.ts` (3), `host-pool-update.ts` (3),
`game-admin.ts` (3), `bingo.ts` (3), plus singles in `word-hunt*.ts`, `viewers.ts`,
`two-truths.ts`, `sudoku.ts`, `trivia.ts`, `player-resume.ts`, `game-finish.ts`,
`admin-end-game.ts`, `achievements.ts`, `host/[code]/page.tsx`,
`hooks/mutations/{useJoinGame,useSubmitPlayerQuestion}.ts`,
`word-hunt/WordHuntPlayerView.tsx`, `library/submit/page.tsx`.

> ⚠️ Counts come from a regex over `.insert/.update/.delete/.upsert(` and include a few
> **non-Supabase** false positives (`ReactionBar.tsx`, `useAnonymousReactions.ts`,
> `library/submit/page.tsx` use `Set`/`Map.delete`). Audit each file in its slice.

### Tables with permissive `FOR ALL USING(true)` (Phase 4 lockdown targets — ~50)

Core: games, participants, players, rounds, votes, confessions, player_questions,
wst_quote_pool, anime_quote_pool, hot_seat_submissions, game_snapshots. Rooms: rooms,
room_members, room_games, room_messages. Per-game: monopoly_boards, monopoly_player_state,
scrabble_sessions, scrabble_player_state, chess_sessions, ludo_sessions, ludo_player_state,
whot_sessions, whot_player_hands, bingo_cards, bingo_called_numbers, bingo_claims,
codewords_boards, codewords_player_roles, codewords_guesses, codewords_messages,
sudoku_submissions, yahtzee_sessions, yahtzee_player_scores, trivia_answers,
describe_it_sessions, describe_it_players, describe_it_words, describe_it_guesses,
npat_answers, npat_marks, ttl_statements, ttl_guesses, word_hunt_submissions,
tic_tac_toe_sessions, snake_ladder_sessions, snake_ladder_player_state, tournaments,
tournament_players, tournament_games, anonymous_messages. (Already-narrow, leave/own pass:
product_updates, game_player_limits, question_packs, app_feedback, anonymous_room_bans,
sudoku_solutions.)
