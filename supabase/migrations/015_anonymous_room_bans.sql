CREATE TABLE IF NOT EXISTS anonymous_room_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  banned_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_anonymous_room_bans_game_id ON anonymous_room_bans(game_id);
CREATE INDEX IF NOT EXISTS idx_anonymous_room_bans_player ON anonymous_room_bans(game_id, player_id);

ALTER TABLE anonymous_room_bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_anonymous_room_bans" ON anonymous_room_bans
  FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE anonymous_room_bans;
