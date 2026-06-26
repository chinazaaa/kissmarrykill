# Custom Game Modes — Design Spec

## Overview

Add a `custom` game type that lets hosts define their own voting categories with 2-5 slots. Instead of hardcoded labels like Smash/Marry/Kill, hosts pick a template (or build from scratch) and customize slot labels, emoji, and colors. The underlying voting mechanic is the same: each round shows N participants, players assign exactly one participant to each slot.

## Game Type

Add `'custom'` to the `GameType` union. When `game_type === 'custom'`, all slot configuration comes from a `custom_slots` JSONB column on the game record. Built-in game types are completely untouched.

## Database Changes

### `games` table

Add column:
```sql
ALTER TABLE games ADD COLUMN custom_slots jsonb;
```

The `custom_slots` JSONB stores (only when `game_type === 'custom'`):
```json
{
  "slots": [
    { "key": "slot_0", "label": "Hire", "emoji": "💼", "color": "#22c55e" },
    { "key": "slot_1", "label": "Fire", "emoji": "🔥", "color": "#ef4444" },
    { "key": "slot_2", "label": "Promote", "emoji": "⭐", "color": "#eab308" }
  ],
  "title": "Hire / Fire / Promote"
}
```

For non-custom games, `custom_slots` is `null`.

### Vote storage

Custom games use the existing `pair_assignments` JSONB column on `votes` with dynamic slot keys:
```json
{ "participant-uuid-1": "slot_0", "participant-uuid-2": "slot_1", "participant-uuid-3": "slot_2" }
```

No new columns needed. The existing `kiss_participant_id`, `marry_participant_id`, `kill_participant_id` columns remain `null` for custom games.

## TypeScript Types

```typescript
interface CustomSlot {
  key: string      // "slot_0", "slot_1", etc.
  label: string    // "Hire", "Fire", etc.
  emoji: string    // "💼", "🔥", etc.
  color: string    // hex color "#22c55e"
}

interface CustomSlotsConfig {
  slots: CustomSlot[]
  title: string    // "Hire / Fire / Promote"
}
```

Extend `Game` type: `custom_slots?: CustomSlotsConfig | null`

## Game Creation Flow

### Game type selection

Add a "Custom" card to the `GameTypeModal`:
- Emoji: ✏️
- Label: "Custom Game"
- Tagline: "Create your own voting categories"
- Players: "2+ players"
- Vibe: "Your rules"

### Template picker

When "Custom" is selected, show a template picker in the settings area:

**Preset templates:**
| Template | Slots |
|----------|-------|
| Hire / Fire / Promote | 3: 💼 Hire (#22c55e), 🔥 Fire (#ef4444), ⭐ Promote (#eab308) |
| Date / Friendzone | 2: 💕 Date (#ec4899), 👋 Friendzone (#64748b) |
| Best / Worst | 2: 🏆 Best (#22c55e), 💩 Worst (#ef4444) |
| Gold / Silver / Bronze | 3: 🥇 Gold (#eab308), 🥈 Silver (#94a3b8), 🥉 Bronze (#b45309) |
| CEO / Intern / Fired | 3: 👔 CEO (#3b82f6), 📋 Intern (#a855f7), 🚪 Fired (#ef4444) |
| Start from scratch | Opens empty builder with 2 slots |

Tapping a template auto-fills the slot editor.

### Slot editor

After picking a template (or "Start from scratch"):

1. **Slot count selector** — chip grid: 2 / 3 / 4 / 5. Changing count adds/removes slots from the end.
2. **Per-slot row** — for each slot:
   - Emoji: small preset grid of ~20 common emoji (clickable). Default from template or auto-assigned.
   - Label: text input (max 20 chars). Required.
   - Color: preset palette of 8 colors (clickable dots). Default from template or auto-assigned.
3. **Game title** — auto-generated from slot labels joined with " / " (e.g. "Hire / Fire / Promote"). Editable.
4. **Live preview** — shows how the vote buttons will look with current emoji/label/color.

**Preset emoji palette:** 🔥 💀 💍 💚 🚩 ⭐ 💼 🏆 💩 👔 📋 🚪 💕 👋 🎯 👑 🥇 🥈 🥉 ✨

**Preset color palette:** #ef4444 (red), #22c55e (green), #3b82f6 (blue), #eab308 (yellow), #a855f7 (purple), #ec4899 (pink), #64748b (slate), #b45309 (amber)

### Participant mode

Custom games use `'import'` participant mode (same as SMK). Host uploads a list of names. Players claim names when joining.

### Round settings

Standard round count chip grid (2-10). Timer settings as usual.

## Round Generation

A new generalized function `generateNRounds(participantIds, roundCount, poolSize)` handles pool sizes 2-5:
- For each round, selects `poolSize` participants
- Ensures fair distribution: each participant appears roughly the same number of times
- Uses Fisher-Yates shuffle and round-robin selection
- For gender-based games (custom games don't use gender filtering), bypass gender logic

The existing `generateRounds()` (trio) and `generatePairRounds()` (pair) remain untouched for built-in games.

## Voting Mechanics

### Player view

New `CustomVoteCard` component (does NOT modify `ParticipantPhotoCard`):
- Shows N participant cards in a row/grid
- Below each participant: N vote buttons styled with custom emoji/label/color
- Assignment logic: tap a button to assign that slot to that participant. Each slot can only be used once. Each participant gets exactly one slot.
- Submit button enabled when all participants are assigned.

### Auto-submit

If timer expires with incomplete assignments, randomly fill remaining slots (same pattern as SMK auto-submit but generalized for N slots).

### Vote validation (API)

When `game_type === 'custom'`:
1. Read `custom_slots` from game record to get valid slot keys
2. Parse `pair_assignments` from request body — expect `Record<string, string>` mapping participant IDs to slot keys
3. Validate:
   - Every participant in the round has an assignment
   - Every assignment value is a valid slot key from `custom_slots`
   - No slot key is repeated (each slot assigned to exactly one participant)
   - Number of assignments equals number of participants equals number of slots
4. Store in `pair_assignments` JSONB column

Note: the existing `parsePairAssignments()` function only accepts `'kiss' | 'kill'` values. For custom games, use a new `parseCustomAssignments()` function that accepts any string slot key.

## Results Display

### Round results

New `CustomRoundResults` component:
- Shows each participant with vote count bars for each slot
- Bar colors match slot config colors
- Winner per slot highlighted (most votes for that slot)
- Grid layout: `grid-cols-{slotCount}` for the stat columns
- Summary line: "💼 Most Hired: Alice (5 votes)"

### Between-rounds view

Same component, showing the just-finished round's results.

### Finals / leaderboard

Per-slot leaderboard:
- For each slot, show the top participant(s) by total votes across all rounds
- Label: "Most {label}" (e.g. "Most Hired", "Most Fired")
- Show vote counts and ranking

### Share text

Format:
```
✏️ Custom Game: Hire / Fire / Promote
Round 3 Results:
💼 Most Hired: Alice (5 votes)
🔥 Most Fired: Bob (4 votes)
⭐ Most Promoted: Charlie (3 votes)

Play at fateround.com
```

## Vote Tallying

New `tallyCustomVotes()` function:
- Input: votes array, participant IDs, slot keys
- Output: per-participant counts for each slot key
- Reads from `pair_assignments` JSONB, counting how many votes assigned each participant to each slot
- Returns a dynamic structure: `Array<{ participantId, name, counts: Record<slotKey, number> }>`

New `tallyCustomPlayerScores()` for leaderboard:
- For each slot, rank participants by total votes received for that slot across all rounds

## Game Type Config

Add a minimal `GAME_TYPE_CONFIG` entry for `'custom'`:
```typescript
{
  id: 'custom',
  label: 'Custom Game',
  tagline: 'Create your own voting categories',
  headerEmoji: '✏️',
  card: { accent: '#a855f7', accentSoft: 'rgba(168,85,247,0.15)', emoji: '✏️', players: '2+ players', vibe: 'Your rules' },
  slots: {} // Empty — populated at runtime from game.custom_slots
}
```

Helper functions:
- `isCustomGame(gameType)` — returns `true` when `game_type === 'custom'`
- `customSlotMeta(game)` — reads `custom_slots` from game record, returns slot config
- `customVoteSlotKeys(game)` — returns array of slot keys from `custom_slots`
- `customRoundPoolSize(game)` — returns `custom_slots.slots.length`

These are NEW functions — existing `voteSlots()`, `isPairGame()`, etc. are NOT modified.

## Validation

### Zod schemas

Add to `createGameSchema`:
```typescript
custom_slots: z.object({
  slots: z.array(z.object({
    key: z.string(),
    label: z.string().min(1).max(20),
    emoji: z.string().min(1).max(4),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })).min(2).max(5),
  title: z.string().min(1).max(100),
}).optional().nullable(),
```

Add to `createVoteSchema`:
```typescript
customAssignments: z.record(z.string(), z.string()).optional().nullable(),
```

## Conditional Logic

All custom game logic is isolated behind `isCustomGame()` checks. No modifications to existing game type conditionals:

- `game-types.ts`: Add `isCustomGame()` helper. Existing `isPairGame()`, `isThreeChoiceGame()`, `voteSlots()` unchanged.
- `votes/route.ts`: Add new `else if (isCustomGame(gameType))` branch after existing branches.
- `start/route.ts`: Add new `else if (isCustomGame(gameType))` branch using `generateNRounds()`.
- `game/[code]/page.tsx`: Add conditional rendering for `CustomVoteCard` when custom game.
- `VoteResults.tsx`: Add `CustomRoundResults` component, used when custom game.
- `ShareRoundResults.tsx` / `ShareResults.tsx`: Add custom game branch for share text.

## Scope Boundaries

**In scope:**
- `'custom'` game type with 2-5 configurable slots
- Template picker + slot editor in create wizard
- Custom vote buttons, results, and share text
- Generalized N-person round generation
- Vote storage via `pair_assignments` JSONB

**Out of scope:**
- Custom emoji upload (use preset palette only)
- Custom colors beyond the 8 presets
- Saving/reusing custom templates across games
- Custom game modes for question-based types (WYR, MLT, WST)
- Achievements/streaks for custom games
