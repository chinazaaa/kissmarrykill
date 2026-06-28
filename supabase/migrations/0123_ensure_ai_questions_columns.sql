-- The AI-questions feature (host AI settings panel, /api/ai-questions, and start-time
-- injection of generated questions) depends on these `games` columns. The base schema
-- declares them via ADD COLUMN IF NOT EXISTS, but some live databases are missing them,
-- which makes the feature error (and broke the host page once HOST_GAME_SELECT requested
-- them explicitly post-0122). Ensure they exist.
--
-- Because migration 0122 switched `games` to COLUMN-level SELECT grants for the public
-- roles, newly added columns are NOT readable by anon/authenticated until granted — so we
-- also grant SELECT on them here (they are non-secret game config, safe to expose).

alter table games add column if not exists ai_questions_enabled boolean default false;
alter table games add column if not exists ai_questions_config jsonb default '{}'::jsonb;
alter table games add column if not exists ai_generated_questions jsonb default '[]'::jsonb;

grant select (ai_questions_enabled, ai_questions_config, ai_generated_questions) on public.games to anon, authenticated;

-- ----------------------------------------------------------------------------
-- ROLLBACK (drafted): the columns are part of the base schema, so prefer NOT dropping
-- them. To only revoke the read grant:
--   revoke select (ai_questions_enabled, ai_questions_config, ai_generated_questions)
--     on public.games from anon, authenticated;
-- ----------------------------------------------------------------------------
