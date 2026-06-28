-- Host-chosen default board look for a chess game. These are display-only
-- defaults: each player can still override their own board theme / piece set
-- locally (stored client-side). Validation of the allowed ids happens in the
-- app layer (src/lib/chess.ts).
ALTER TABLE games ADD COLUMN IF NOT EXISTS chess_board_theme text DEFAULT 'classic';
ALTER TABLE games ADD COLUMN IF NOT EXISTS chess_piece_set text DEFAULT 'classic';
