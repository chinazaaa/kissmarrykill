-- Custom Game Modes
ALTER TABLE games ADD COLUMN IF NOT EXISTS custom_slots jsonb;
