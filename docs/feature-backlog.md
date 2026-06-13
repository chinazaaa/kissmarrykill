# Feature Backlog

Ideas for future development, grouped by effort level.

## Medium Effort

### Custom Themes
Let the host pick a color theme/vibe for their game room (neon, retro, elegant). Store as a `theme` field on the game record, apply via CSS custom properties.

### Streaks & Achievements
Track patterns across rounds and show badges at game end. Examples: "Most Smashed 3 rounds in a row", "Never Killed", "Unanimous pick". Computed from vote data at final results — no new tables needed.

### Rematch History
When playing again, show how results changed between sessions. "Alice went from Most Married to Most Killed." Requires storing previous game results before the play-again reset clears them.

### Spectator Mode
Let people watch without joining, with a live vote count ticker. Add a "Watch" option on the join page that skips player creation but subscribes to realtime updates. Show vote counts without revealing who voted.

### Timer Music
Play increasingly intense background music as the timer counts down. Use Web Audio API with pre-loaded audio sprites. Add a mute toggle. Tie intensity to the `timeLeft` value.

## Bigger Features

### Tournament Mode
Bracket-style elimination across multiple rounds. Winner of each round advances. Requires a new `tournament` table linking multiple games, bracket visualization, and auto-creation of next-round games.

### Custom Game Modes
Let hosts define their own voting categories (e.g., "Hire / Fire / Promote"). Store custom slot labels/emoji/colors in the game record. Requires a category builder UI in the create wizard.

### AI-Generated Questions
Use an LLM to generate personalized WYR/MLT questions based on player names and context. Call an AI API at game start to produce questions that reference the actual players. Requires API key management and rate limiting.

### Video Reveal
Record short video reactions when results are shown using the MediaRecorder API. Upload clips to Supabase Storage. Play back a compilation at the final leaderboard. Significant storage and bandwidth implications.
