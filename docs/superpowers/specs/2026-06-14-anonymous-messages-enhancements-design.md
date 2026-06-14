# Anonymous Messages Enhancements — Design Spec

## Overview

Enhance the anonymous messages feature with emoji in messages (emoji-mart picker), GIF/sticker support (Klipy API), ephemeral emoji reactions on messages (Supabase Realtime broadcast), a scroll-to-bottom button with unread count badge, and increased max players from 15 to 50.

## 1. Emoji in Messages

### Package
Install `emoji-mart` — the standard React emoji picker.

### Composer UI
- Add a 😀 button next to the send button in `AnonymousMessageComposer`
- Tapping opens the emoji-mart picker as a popover above the composer
- Selecting an emoji inserts it at the cursor position in the textarea
- Picker closes on selection or outside click
- Messages render emoji inline (unicode characters — no special rendering needed)

## 2. GIF/Sticker Support (Klipy API)

### API
- **Klipy API** — free, no rate caps, lifetime free tier
- **Search endpoint:** `GET https://api.klipy.com/v1/search?q={query}&type={gif|sticker}&limit=20`
- **Trending endpoint:** `GET https://api.klipy.com/v1/trending?type={gif|sticker}&limit=20`
- Requires API key (free registration at klipy.com/developers)
- Store as `NEXT_PUBLIC_KLIPY_API_KEY` environment variable

### Database Changes

Add columns to `anonymous_messages`:
```sql
ALTER TABLE anonymous_messages ADD COLUMN message_type text NOT NULL DEFAULT 'text'
  CHECK (message_type IN ('text', 'gif'));
ALTER TABLE anonymous_messages ADD COLUMN media_url text;
```

### TypeScript Type Changes

Extend `AnonymousMessage`:
```typescript
export interface AnonymousMessage {
  // ...existing fields
  message_type: 'text' | 'gif'
  media_url?: string | null
}
```

### Composer UI
- Add a 🎬 button next to the emoji button
- Tapping opens a GIF/sticker search panel (overlays the composer area)
- Panel has two tabs: "GIFs" and "Stickers"
- Search input at top with debounced search (300ms)
- Grid of results below (2 columns, lazy-loaded images)
- Trending results shown by default (no search query)
- Tapping a GIF/sticker sends it immediately as a message with `message_type: 'gif'` and `media_url`

### Feed Rendering
- Text messages render as before
- GIF messages render the image from `media_url` with `max-width: 200px`, rounded corners
- GIF messages can optionally have text too (but typically sent without text)
- Lazy load images with loading placeholder

### API Route Changes
- `POST /api/anonymous-messages` accepts optional `messageType` ('text' | 'gif') and `mediaUrl` fields
- Validation: if `messageType === 'gif'`, `mediaUrl` is required and must be a valid URL
- Text is optional for GIF messages (can be empty string)

### Validation Schema Changes
```typescript
export const createAnonymousMessageSchema = z.object({
  gameId: gameCodeString(),
  playerId: uuidString('playerId'),
  text: z.string().max(500).default(''),
  replyToId: uuidString('replyToId').optional(),
  messageType: z.enum(['text', 'gif']).default('text'),
  mediaUrl: z.string().url().max(2000).optional().nullable(),
})
```

Note: text validation changes from `sanitizedString(1, 500)` to `z.string().max(500).default('')` to allow empty text on GIF-only messages. For text messages, the API route enforces non-empty text.

## 3. Emoji Reactions (Ephemeral)

### Mechanism
- Supabase Realtime broadcast channel (no database table)
- Channel name: `reactions:{gameId}`
- Broadcast event: `{ type: 'reaction', messageId: string, emoji: string, playerName: string, action: 'add' | 'remove' }`

### Local State
- In-memory `Map<messageId, Map<emoji, Set<playerName>>>` stored in React state
- Updated on every broadcast received
- Resets on page refresh (by design — ephemeral)

### UI
- Small 😊 button on each message (appears on hover/tap)
- Tapping opens the full emoji-mart picker anchored to that message
- Selecting an emoji broadcasts the reaction
- Reactions display as small pills below the message: `😂 3  🔥 1  ❤️ 2`
- Tapping an existing reaction pill toggles your reaction (add/remove + broadcast)
- Your own reactions are highlighted (filled background)
- One reaction per emoji per player (enforced locally)

### Component
- New `MessageReactions` component renders the reaction pills
- New `useAnonymousReactions(gameId)` hook manages the Supabase channel subscription and local state

## 4. Scroll-to-Bottom Button with Unread Count

### Behavior
- Floating button appears when scrolled more than 200px from bottom
- Shows "↓" icon with unread count badge (e.g. "3 new")
- Badge only shows when count > 0
- Tapping scrolls smoothly to bottom and resets count
- Button disappears when within 80px of bottom
- Count increments for each new message that arrives while scrolled up
- Count resets when user scrolls to bottom (manually or via button)

### Implementation
- Replaces the current auto-scroll toggle in `AnonymousMessageFeed`
- Track `unreadCount` state, increment on new message when not near bottom
- The `useAnonymousFeedAutoScroll` hook is removed (no longer needed)
- Scroll detection uses existing `NEAR_BOTTOM_PX = 80` threshold

### UI
- Position: `fixed bottom-20 right-4` (above the composer)
- Style: glass-card with violet accent, rounded-full
- Badge: small red circle with white text count
- Animation: fade-in/out with scale transition

## 5. Max Players Increase

Change `ANONYMOUS_ROOM_MAX_PLAYERS` from 15 to 50 in `src/lib/anonymous-messages.ts`.

Update migration:
```sql
-- No constraint change needed — max_players column has no CHECK constraint
-- Just update the constant in the application code
```

## Database Migration Summary

```sql
-- Anonymous messages enhancements
ALTER TABLE anonymous_messages ADD COLUMN message_type text NOT NULL DEFAULT 'text'
  CHECK (message_type IN ('text', 'gif'));
ALTER TABLE anonymous_messages ADD COLUMN media_url text;
```

## New Dependencies

- `emoji-mart` — emoji picker component
- `@emoji-mart/data` — emoji data for emoji-mart
- `@emoji-mart/react` — React wrapper for emoji-mart

No npm package for Klipy — it's a simple REST API called via `fetch`.

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/anonymous-messages.ts` | Modify | Update MAX_PLAYERS to 50 |
| `src/types/index.ts` | Modify | Add message_type, media_url to AnonymousMessage |
| `src/lib/validation.ts` | Modify | Update createAnonymousMessageSchema |
| `src/app/api/anonymous-messages/route.ts` | Modify | Accept messageType, mediaUrl |
| `src/hooks/useAnonymousMessages.ts` | Modify | Fetch new fields |
| `src/hooks/useAnonymousReactions.ts` | Create | Supabase broadcast channel for reactions |
| `src/components/anonymous-messages/AnonymousMessageComposer.tsx` | Modify | Add emoji + GIF buttons |
| `src/components/anonymous-messages/EmojiPickerPopover.tsx` | Create | emoji-mart wrapper |
| `src/components/anonymous-messages/GifStickerPicker.tsx` | Create | Klipy search UI |
| `src/components/anonymous-messages/MessageReactions.tsx` | Create | Reaction pills display |
| `src/components/anonymous-messages/AnonymousMessageFeed.tsx` | Modify | GIF rendering, reaction display, scroll button |
| `src/components/anonymous-messages/ScrollToBottomButton.tsx` | Create | Floating button with unread badge |
| `src/lib/klipy.ts` | Create | Klipy API client |
| `supabase/migrations/019_anonymous_message_media.sql` | Create | Add message_type, media_url columns |

## Scope Boundaries

**In scope:**
- Emoji picker in composer (emoji-mart)
- GIF/sticker search and send (Klipy API)
- Ephemeral emoji reactions via Supabase broadcast
- Scroll-to-bottom button with unread count
- Max players increase to 50

**Out of scope:**
- Persisted reactions (database table)
- Custom sticker upload
- Message formatting (bold, italic, markdown)
- Animated emoji / custom emoji
- GIF auto-play settings
- Reaction analytics or "who reacted" list
