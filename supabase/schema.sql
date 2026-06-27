-- ============================================================================
-- fateround — COMPLETE database schema (consolidated)
--
-- Run this ONCE on a new / empty Supabase database to create the entire schema
-- in one shot (base tables + every migration 001–091, folded in, in order).
--
-- • Do NOT also run the files in ./migrations on a fresh DB — they are the
--   historical record and are already included here. Use ./migrations only to
--   bring an EXISTING database up to date incrementally.
-- • Assumes a Supabase project (the `anon` / `authenticated` / `service_role`
--   roles, the `supabase_realtime` publication, and the `storage` schema already
--   exist — they do on every Supabase instance). Verified to apply with zero
--   errors on a fresh database.
-- • Regenerate after adding migrations: concatenate schema base + migrations and
--   make policies / publication-adds idempotent (see the repo's consolidation step).
-- ============================================================================

-- ===== BASE SCHEMA (supabase/schema.sql) =====
-- Fate Round Schema
-- Run this in your Supabase SQL editor

-- Games
create table if not exists games (
  id text primary key,
  title text not null,
  host_token text not null,
  rounds_count integer not null default 3,
  timer_seconds integer not null default 30,
  anonymous boolean not null default true,
  auto_reveal boolean not null default true,
  auto_submit_behavior text not null default 'no_answer',
  participant_mode text not null default 'import' check (participant_mode in ('import', 'joiners', 'voters')),
  participant_filter text not null default 'all' check (participant_filter in ('all', 'joined')),
  pair_vote_mode text not null default 'one_each' check (pair_vote_mode in ('any', 'one_each')),
  question_source text not null default 'platform' check (question_source in ('platform', 'custom')),
  custom_questions jsonb,
  game_type text not null default 'smash_marry_kill' check (game_type in ('smash_marry_kill', 'red_flag_green_flag', 'smash_or_pass', 'would_you_rather', 'most_likely_to', 'who_said_this', 'hot_seat')),
  status text not null default 'waiting',
  current_round_number integer not null default 0,
  created_at timestamptz not null default now()
);

-- If upgrading an existing database, run:
-- alter table games add column if not exists game_type text not null default 'smash_marry_kill' check (game_type in ('smash_marry_kill', 'red_flag_green_flag', 'smash_or_pass'));
-- To allow smash_or_pass on an existing DB, drop and recreate the check:
-- alter table games drop constraint if exists games_game_type_check;
-- alter table games add constraint games_game_type_check check (game_type in ('smash_marry_kill', 'red_flag_green_flag', 'smash_or_pass', 'would_you_rather', 'most_likely_to'));

-- alter table games add column if not exists pair_vote_mode text not null default 'any' check (pair_vote_mode in ('any', 'one_each'));
-- alter table games add column if not exists question_source text not null default 'platform' check (question_source in ('platform', 'custom'));
-- alter table games add column if not exists custom_questions jsonb;

-- Participants (people being voted on)
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references games(id) on delete cascade,
  name text not null,
  gender text not null default 'female' check (gender in ('male', 'female')),
  photo_url text,
  description text,
  display_order integer not null default 0,
  in_mlt_poll boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_participants_game_id on participants(game_id);

-- If upgrading an existing database, run:
-- alter table participants add column if not exists gender text not null default 'female' check (gender in ('male', 'female'));

-- Players (people playing)
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references games(id) on delete cascade,
  name text not null,
  gender text not null default 'female' check (gender in ('male', 'female', 'both')),
  identity_gender text check (identity_gender in ('male', 'female')),
  participant_id uuid references participants(id) on delete set null,
  joined_at timestamptz not null default now(),
  resume_token text
);
create index if not exists idx_players_game_id on players(game_id);
create unique index if not exists idx_players_participant_claim on players(game_id, participant_id) where participant_id is not null;
create unique index if not exists idx_players_game_resume_token on players(game_id, resume_token) where resume_token is not null;

-- If upgrading an existing database, run:
-- alter table players add column if not exists resume_token text;
-- create unique index if not exists idx_players_game_resume_token on players(game_id, resume_token) where resume_token is not null;

-- If upgrading an existing database, run:
-- alter table players drop constraint if exists players_gender_check;
-- alter table players add constraint players_gender_check check (gender in ('male', 'female', 'both'));
-- alter table players add column if not exists identity_gender text check (identity_gender in ('male', 'female'));
-- alter table players add column if not exists participant_id uuid references participants(id) on delete set null;
-- create unique index if not exists idx_players_participant_claim on players(game_id, participant_id) where participant_id is not null;

-- Rounds
create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references games(id) on delete cascade,
  round_number integer not null,
  participant_ids uuid[] not null default '{}',
  wyr_option_a text,
  wyr_option_b text,
  mlt_question text,
  submitter_player_id uuid references players(id),
  quote_text text,
  quote_author_participant_id uuid references participants(id),
  quote_submitted_at timestamptz,
  status text not null default 'pending',
  started_at timestamptz,
  ended_at timestamptz
);
create index if not exists idx_rounds_game_id on rounds(game_id);
create index if not exists idx_rounds_game_status on rounds(game_id, status);

-- Votes
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  round_id uuid not null references rounds(id) on delete cascade,
  game_id text not null references games(id) on delete cascade,
  kiss_participant_id uuid references participants(id),
  marry_participant_id uuid references participants(id),
  kill_participant_id uuid references participants(id),
  /** Pair games: { "participant-id": "kiss"|"kill" } — one flag per person, can match. */
  pair_assignments jsonb,
  wyr_choice text check (wyr_choice in ('a', 'b')),
  target_player_id uuid references players(id),
  target_participant_id uuid references participants(id),
  created_at timestamptz not null default now(),
  unique(player_id, round_id)
);
create index if not exists idx_votes_game_id on votes(game_id);
create index if not exists idx_votes_round_id on votes(round_id);

-- If upgrading: alter table votes add column if not exists pair_assignments jsonb;
-- alter table rounds add column if not exists wyr_option_a text;
-- alter table rounds add column if not exists wyr_option_b text;
-- alter table votes add column if not exists wyr_choice text check (wyr_choice in ('a', 'b'));
-- alter table rounds add column if not exists mlt_question text;
-- alter table votes add column if not exists target_player_id uuid references players(id);
-- alter table participants add column if not exists in_mlt_poll boolean not null default false;
-- alter table rounds add column if not exists submitter_player_id uuid references players(id);
-- alter table rounds add column if not exists quote_text text;
-- alter table rounds add column if not exists quote_author_participant_id uuid references participants(id);
-- alter table rounds add column if not exists quote_submitted_at timestamptz;

-- Pre-game quote pool for Who Said This (lobby submissions before start)
create table if not exists wst_quote_pool (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references games(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  quote_text text not null,
  author_participant_id uuid not null references participants(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_wst_quote_pool_game_id on wst_quote_pool(game_id);

alter table wst_quote_pool enable row level security;
drop policy if exists "public_wst_quote_pool" on wst_quote_pool;
create policy "public_wst_quote_pool" on wst_quote_pool for all to anon using (true) with check (true);

-- If upgrading an existing database for Who Said This quote pool, run:
-- create table if not exists wst_quote_pool (...);  (see full definition above)
-- alter publication supabase_realtime add table wst_quote_pool;

-- Confessions (anonymous post-round messages)
create table if not exists confessions (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references games(id) on delete cascade,
  round_id uuid references rounds(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_confessions_game_id on confessions(game_id);

-- App feedback (site-wide product feedback)
create table if not exists app_feedback (
  id uuid primary key default gen_random_uuid(),
  game_type text not null default 'general'
    check (game_type in (
      'general',
      'smash_marry_kill',
      'red_flag_green_flag',
      'smash_or_pass',
      'would_you_rather',
      'this_or_that',
      'most_likely_to',
      'who_said_this',
      'hot_seat',
      'custom'
    )),
  category text not null
    check (category in ('bug', 'feature', 'improvement', 'other')),
  message text not null,
  page_url text,
  created_at timestamptz not null default now()
);
create index if not exists idx_app_feedback_created_at on app_feedback(created_at desc);

-- Row Level Security (permissive — no auth required for this game)
alter table games enable row level security;
alter table participants enable row level security;
alter table players enable row level security;
alter table rounds enable row level security;
alter table votes enable row level security;
alter table confessions enable row level security;
alter table app_feedback enable row level security;

drop policy if exists "public_games" on games;
create policy "public_games"        on games        for all to anon using (true) with check (true);
drop policy if exists "public_participants" on participants;
create policy "public_participants" on participants  for all to anon using (true) with check (true);
drop policy if exists "public_players" on players;
create policy "public_players"      on players      for all to anon using (true) with check (true);
drop policy if exists "public_rounds" on rounds;
create policy "public_rounds"       on rounds       for all to anon using (true) with check (true);
drop policy if exists "public_votes" on votes;
create policy "public_votes"        on votes        for all to anon using (true) with check (true);
drop policy if exists "public_confessions" on confessions;
create policy "public_confessions"  on confessions  for all to anon using (true) with check (true);
drop policy if exists "public_app_feedback_insert" on app_feedback;
create policy "public_app_feedback_insert" on app_feedback for insert to anon with check (true);

-- Player-submitted questions (lobby phase, WYR/MLT only)
create table if not exists player_questions (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references games(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  question_type text not null check (question_type in ('wyr', 'mlt')),
  option_a text,
  option_b text,
  question_text text,
  created_at timestamptz not null default now()
);
create index if not exists idx_player_questions_game_id on player_questions(game_id);

alter table player_questions enable row level security;
drop policy if exists "public_player_questions" on player_questions;
create policy "public_player_questions" on player_questions for all to anon using (true) with check (true);

-- Enable Realtime
do $$ begin alter publication supabase_realtime add table games; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table players; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table rounds; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table votes; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table wst_quote_pool; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table player_questions; exception when duplicate_object then null; end $$;

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
drop policy if exists "anime_quote_pool_public" on anime_quote_pool;
CREATE POLICY "anime_quote_pool_public" ON anime_quote_pool FOR ALL USING (true) WITH CHECK (true);

-- New columns on existing tables
ALTER TABLE games ADD COLUMN wst_quote_source text NOT NULL DEFAULT 'player'
  CHECK (wst_quote_source IN ('player', 'anime', 'both'));

ALTER TABLE rounds ADD COLUMN anime_metadata jsonb;

ALTER TABLE votes ADD COLUMN anime_choice text;

-- ============================================================================
-- Hot Seat — schema additions
-- ============================================================================

-- Hot Seat submissions
create table if not exists hot_seat_submissions (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references games(id) on delete cascade,
  round_id uuid not null references rounds(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  text text not null,
  submission_type text not null default 'observation' check (submission_type in ('compliment', 'roast', 'observation')),
  created_at timestamptz not null default now(),
  unique(round_id, player_id)
);
create index if not exists idx_hot_seat_submissions_round on hot_seat_submissions(round_id);
alter table hot_seat_submissions enable row level security;
drop policy if exists "public_hot_seat_submissions" on hot_seat_submissions;
create policy "public_hot_seat_submissions" on hot_seat_submissions for all to anon using (true) with check (true);

-- If upgrading:
-- alter table games add column if not exists participant_filter text not null default 'all' check (participant_filter in ('all', 'joined'));
-- alter table games drop constraint if exists games_game_type_check;
-- alter table games add constraint games_game_type_check check (game_type in ('smash_marry_kill', 'red_flag_green_flag', 'smash_or_pass', 'would_you_rather', 'most_likely_to', 'who_said_this', 'hot_seat'));

-- ============================================================================
-- Custom Game Modes — schema additions
-- ============================================================================

ALTER TABLE games ADD COLUMN IF NOT EXISTS custom_slots jsonb;

ALTER TABLE games ADD COLUMN IF NOT EXISTS gender_based boolean NOT NULL DEFAULT true;

-- If upgrading:
-- alter table games add column if not exists gender_based boolean not null default true;
-- alter table games drop constraint if exists games_game_type_check;
-- alter table games add constraint games_game_type_check check (game_type in ('smash_marry_kill', 'red_flag_green_flag', 'smash_or_pass', 'would_you_rather', 'most_likely_to', 'who_said_this', 'hot_seat', 'custom'));

-- ============================================================================
-- Game Rooms — schema additions
-- ============================================================================

-- Persistent friend group rooms
create table if not exists rooms (
  id text primary key,
  name text not null,
  creator_token text not null default '',
  max_members integer,
  is_public boolean not null default false,
  is_locked boolean not null default false,
  description text,
  timezone text,
  created_at timestamptz not null default now()
);
create index if not exists idx_rooms_public on rooms(is_public, created_at desc) where is_public = true and is_locked = false;

-- Room members with persistent identity (no auth — member_code is their key)
create table if not exists room_members (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references rooms(id) on delete cascade,
  member_code text not null unique,
  display_name text not null,
  joined_at timestamptz not null default now(),
  times_kissed integer not null default 0,
  times_married integer not null default 0,
  times_killed integer not null default 0,
  games_played integer not null default 0,
  room_points integer not null default 0
);
create index if not exists idx_room_members_room_id on room_members(room_id);
create unique index if not exists idx_room_members_code on room_members(member_code);

-- Links a game session to a room (for history + stat tracking)
create table if not exists room_games (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references rooms(id) on delete cascade,
  game_id text not null references games(id) on delete cascade,
  started_by_member_id uuid references room_members(id) on delete set null,
  created_at timestamptz not null default now(),
  points_awarded_at timestamptz
);
create index if not exists idx_room_games_room_id on room_games(room_id);
create unique index if not exists idx_room_games_game_id on room_games(game_id);

-- Room chat messages (last 50 shown; older rows can be pruned)
create table if not exists room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references rooms(id) on delete cascade,
  member_id uuid references room_members(id) on delete set null,
  display_name text not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_room_messages_room_id_created on room_messages(room_id, created_at desc);

-- Row Level Security
alter table rooms enable row level security;
alter table room_members enable row level security;
alter table room_games enable row level security;
alter table room_messages enable row level security;

drop policy if exists "public_rooms" on rooms;
create policy "public_rooms"         on rooms         for all to anon using (true) with check (true);
drop policy if exists "public_room_members" on room_members;
create policy "public_room_members"  on room_members  for all to anon using (true) with check (true);
drop policy if exists "public_room_games" on room_games;
create policy "public_room_games"    on room_games    for all to anon using (true) with check (true);
drop policy if exists "public_room_messages" on room_messages;
create policy "public_room_messages" on room_messages for all to anon using (true) with check (true);

-- Enable Realtime
do $$ begin alter publication supabase_realtime add table rooms; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table room_members; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table room_games; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table room_messages; exception when duplicate_object then null; end $$;

-- If upgrading an existing database, run the following:
-- create table if not exists rooms ( id text primary key, name text not null, created_at timestamptz not null default now() );
-- create table if not exists room_members ( id uuid primary key default gen_random_uuid(), room_id text not null references rooms(id) on delete cascade, member_code text not null unique, display_name text not null, joined_at timestamptz not null default now(), times_kissed integer not null default 0, times_married integer not null default 0, times_killed integer not null default 0, games_played integer not null default 0, room_points integer not null default 0 );
-- alter table room_members add column if not exists room_points integer not null default 0;
-- alter table room_games add column if not exists points_awarded_at timestamptz;
-- alter table players add column if not exists room_member_id uuid references room_members(id) on delete set null;
-- create index if not exists idx_room_members_room_id on room_members(room_id);
-- create unique index if not exists idx_room_members_code on room_members(member_code);
-- create table if not exists room_games ( id uuid primary key default gen_random_uuid(), room_id text not null references rooms(id) on delete cascade, game_id text not null references games(id) on delete cascade, started_by_member_id uuid references room_members(id) on delete set null, created_at timestamptz not null default now() );
-- create index if not exists idx_room_games_room_id on room_games(room_id);
-- create unique index if not exists idx_room_games_game_id on room_games(game_id);
-- create table if not exists room_messages ( id uuid primary key default gen_random_uuid(), room_id text not null references rooms(id) on delete cascade, member_id uuid references room_members(id) on delete set null, display_name text not null, text text not null, created_at timestamptz not null default now() );
-- create index if not exists idx_room_messages_room_id_created on room_messages(room_id, created_at desc);
-- alter table rooms enable row level security;
-- alter table room_members enable row level security;
-- alter table room_games enable row level security;
-- alter table room_messages enable row level security;
-- create policy "public_rooms" on rooms for all to anon using (true) with check (true);
-- create policy "public_room_members" on room_members for all to anon using (true) with check (true);
-- create policy "public_room_games" on room_games for all to anon using (true) with check (true);
-- create policy "public_room_messages" on room_messages for all to anon using (true) with check (true);
-- alter publication supabase_realtime add table rooms;
-- alter publication supabase_realtime add table room_members;
-- alter publication supabase_realtime add table room_games;
-- alter publication supabase_realtime add table room_messages;
-- alter table rooms add column if not exists creator_token text not null default '';
-- alter table rooms add column if not exists max_members integer;


-- ===== MIGRATION: 001_player_questions_and_avatars.sql =====
-- Migration: Player questions + Avatar storage
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Player-submitted questions (WYR/MLT lobby phase)
create table if not exists player_questions (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references games(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  question_type text not null check (question_type in ('wyr', 'mlt')),
  option_a text,
  option_b text,
  question_text text,
  created_at timestamptz not null default now()
);
create index if not exists idx_player_questions_game_id on player_questions(game_id);

alter table player_questions enable row level security;
drop policy if exists "public_player_questions" on player_questions;
create policy "public_player_questions" on player_questions for all to anon using (true) with check (true);
do $$ begin alter publication supabase_realtime add table player_questions; exception when duplicate_object then null; end $$;

-- 2. Avatars storage bucket (for participant photos)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "public_avatars" on storage.objects;
create policy "public_avatars"
  on storage.objects for all to anon
  using (bucket_id = 'avatars')
  with check (bucket_id = 'avatars');


-- ===== MIGRATION: 002_anime_who_said_this.sql =====
-- ============================================================================
-- Anime Who Said This — schema additions
-- ============================================================================

-- Jikan API response cache (avoid redundant lookups)
CREATE TABLE IF NOT EXISTS jikan_search_cache (
  show_name text PRIMARY KEY,
  mal_id integer,
  cached_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jikan_anime_cache (
  mal_id integer PRIMARY KEY,
  show_name text NOT NULL,
  characters jsonb NOT NULL,
  cached_at timestamptz NOT NULL DEFAULT now()
);

-- Anime quote pool (lobby phase, persists across refreshes)
CREATE TABLE IF NOT EXISTS anime_quote_pool (
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
drop policy if exists "anime_quote_pool_public" on anime_quote_pool;
CREATE POLICY "anime_quote_pool_public" ON anime_quote_pool FOR ALL USING (true) WITH CHECK (true);

-- New columns on existing tables
ALTER TABLE games ADD COLUMN IF NOT EXISTS wst_quote_source text NOT NULL DEFAULT 'player'
  CHECK (wst_quote_source IN ('player', 'anime', 'both'));

ALTER TABLE rounds ADD COLUMN IF NOT EXISTS anime_metadata jsonb;

ALTER TABLE votes ADD COLUMN IF NOT EXISTS anime_choice text;


-- ===== MIGRATION: 003_themes_snapshots.sql =====
-- Migration 003: Custom themes + Game snapshots (rematch history)
-- Run in Supabase Dashboard > SQL Editor > New Query

-- 1. Theme column on games table
alter table games add column if not exists theme text not null default 'default'
  check (theme in ('default', 'neon', 'retro', 'elegant', 'tropical'));

-- 2. Game snapshots (saved before play-again reset for rematch history)
create table if not exists game_snapshots (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references games(id) on delete cascade,
  session_number integer not null default 1,
  snapshot_data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_game_snapshots_game_id on game_snapshots(game_id);

alter table game_snapshots enable row level security;
drop policy if exists "public_game_snapshots" on game_snapshots;
create policy "public_game_snapshots" on game_snapshots for all to anon using (true) with check (true);


-- ===== MIGRATION: 004_hot_seat.sql =====
-- Hot Seat game mode
-- One player is "in the hot seat" each round. Everyone else anonymously
-- submits one thing about them (compliment, roast, or observation).

-- Required by game create/update (import mode: all list vs joined-only)
alter table games
  add column if not exists participant_filter text not null default 'all'
  check (participant_filter in ('all', 'joined'));

-- Update game_type check constraint to include 'hot_seat'
alter table games drop constraint if exists games_game_type_check;
alter table games add constraint games_game_type_check check (game_type in ('smash_marry_kill', 'red_flag_green_flag', 'smash_or_pass', 'would_you_rather', 'most_likely_to', 'who_said_this', 'hot_seat'));

-- Hot Seat submissions
create table if not exists hot_seat_submissions (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references games(id) on delete cascade,
  round_id uuid not null references rounds(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  text text not null,
  submission_type text not null default 'observation' check (submission_type in ('compliment', 'roast', 'observation')),
  created_at timestamptz not null default now(),
  unique(round_id, player_id)
);
create index if not exists idx_hot_seat_submissions_round on hot_seat_submissions(round_id);
alter table hot_seat_submissions enable row level security;
drop policy if exists "public_hot_seat_submissions" on hot_seat_submissions;
create policy "public_hot_seat_submissions" on hot_seat_submissions for all to anon using (true) with check (true);


-- ===== MIGRATION: 004_participant_filter.sql =====
alter table games
  add column if not exists participant_filter text not null default 'all'
  check (participant_filter in ('all', 'joined'));


-- ===== MIGRATION: 005_custom_game_modes.sql =====
-- Custom Game Modes
ALTER TABLE games ADD COLUMN IF NOT EXISTS custom_slots jsonb;

-- Allow game_type = 'custom'
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_type_check;
ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN (
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'would_you_rather',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom'
));


-- ===== MIGRATION: 006_gender_based.sql =====
-- Host-configurable gender-based rounds (SMK, pair games, custom)
ALTER TABLE games ADD COLUMN IF NOT EXISTS gender_based boolean NOT NULL DEFAULT true;


-- ===== MIGRATION: 007_voters_participant_mode.sql =====
-- Allow voter-only mode: host list appears in rounds; players join separately to vote
alter table games drop constraint if exists games_participant_mode_check;
alter table games add constraint games_participant_mode_check
  check (participant_mode in ('import', 'joiners', 'voters'));


-- ===== MIGRATION: 008_this_or_that.sql =====
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_type_check;
ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN (
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'would_you_rather',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom'
));


-- ===== MIGRATION: 009_player_question_settings.sql =====
ALTER TABLE games ADD COLUMN IF NOT EXISTS player_questions_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE games ADD COLUMN IF NOT EXISTS player_questions_order text NOT NULL DEFAULT 'players_first'
  CHECK (player_questions_order IN ('players_first', 'uploaded_first', 'mixed'));


-- ===== MIGRATION: 010_player_name_submissions.sql =====
ALTER TABLE participants ADD COLUMN IF NOT EXISTS submitted_by_player_id uuid REFERENCES players(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_participants_submitted_by ON participants(submitted_by_player_id) WHERE submitted_by_player_id IS NOT NULL;


-- ===== MIGRATION: 011_app_feedback.sql =====
create table if not exists app_feedback (
  id uuid primary key default gen_random_uuid(),
  game_type text not null default 'general'
    check (game_type in (
      'general',
      'smash_marry_kill',
      'red_flag_green_flag',
      'smash_or_pass',
      'would_you_rather',
      'this_or_that',
      'most_likely_to',
      'who_said_this',
      'hot_seat',
      'custom'
    )),
  category text not null
    check (category in ('bug', 'feature', 'improvement', 'other')),
  message text not null,
  page_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_feedback_created_at on app_feedback(created_at desc);

alter table app_feedback enable row level security;
drop policy if exists "public_app_feedback_insert" on app_feedback;
create policy "public_app_feedback_insert" on app_feedback for insert to anon with check (true);


-- ===== MIGRATION: 012_anonymous_messages.sql =====
CREATE TABLE IF NOT EXISTS anonymous_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anonymous_messages_game_id ON anonymous_messages(game_id);
CREATE INDEX IF NOT EXISTS idx_anonymous_messages_game_created ON anonymous_messages(game_id, created_at);

ALTER TABLE anonymous_messages ENABLE ROW LEVEL SECURITY;
drop policy if exists "public_anonymous_messages" on anonymous_messages;
CREATE POLICY "public_anonymous_messages" ON anonymous_messages
  FOR ALL TO anon USING (true) WITH CHECK (true);

do $$ begin alter publication supabase_realtime add table anonymous_messages; exception when duplicate_object then null; end $$;

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_type_check;
ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN (
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'would_you_rather',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages'
));

ALTER TABLE app_feedback DROP CONSTRAINT IF EXISTS app_feedback_game_type_check;
ALTER TABLE app_feedback ADD CONSTRAINT app_feedback_game_type_check CHECK (game_type IN (
  'general',
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'would_you_rather',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages'
));


-- ===== MIGRATION: 013_anonymous_session_started.sql =====
ALTER TABLE games ADD COLUMN IF NOT EXISTS session_started_at timestamptz;


-- ===== MIGRATION: 014_anonymous_message_replies.sql =====
ALTER TABLE anonymous_messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES anonymous_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reply_to_text text CHECK (
    reply_to_text IS NULL OR char_length(reply_to_text) BETWEEN 1 AND 200
  );

CREATE INDEX IF NOT EXISTS idx_anonymous_messages_reply_to ON anonymous_messages(reply_to_id);


-- ===== MIGRATION: 015_anonymous_room_bans.sql =====
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

DROP POLICY IF EXISTS "public_anonymous_room_bans" ON anonymous_room_bans;

drop policy if exists "public_anonymous_room_bans_select" on anonymous_room_bans;
CREATE POLICY "public_anonymous_room_bans_select" ON anonymous_room_bans
  FOR SELECT USING (true);

drop policy if exists "public_anonymous_room_bans_insert" on anonymous_room_bans;
CREATE POLICY "public_anonymous_room_bans_insert" ON anonymous_room_bans
  FOR INSERT WITH CHECK (true);

drop policy if exists "public_anonymous_room_bans_update" on anonymous_room_bans;
CREATE POLICY "public_anonymous_room_bans_update" ON anonymous_room_bans
  FOR UPDATE USING (true) WITH CHECK (true);

drop policy if exists "public_anonymous_room_bans_delete" on anonymous_room_bans;
CREATE POLICY "public_anonymous_room_bans_delete" ON anonymous_room_bans
  FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON anonymous_room_bans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON anonymous_room_bans TO authenticated;
GRANT ALL ON anonymous_room_bans TO service_role;

do $$ begin alter publication supabase_realtime add table anonymous_room_bans; exception when duplicate_object then null; end $$;


-- ===== MIGRATION: 016_anonymous_messages_trim.sql =====
ALTER TABLE games ADD COLUMN IF NOT EXISTS anonymous_messages_trimmed_at timestamptz;


-- ===== MIGRATION: 017_fix_anonymous_room_bans_rls.sql =====
-- Fix RLS for anonymous_room_bans (upsert needs insert + update policies).
ALTER TABLE anonymous_room_bans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_anonymous_room_bans" ON anonymous_room_bans;
DROP POLICY IF EXISTS "public_anonymous_room_bans_select" ON anonymous_room_bans;
DROP POLICY IF EXISTS "public_anonymous_room_bans_insert" ON anonymous_room_bans;
DROP POLICY IF EXISTS "public_anonymous_room_bans_update" ON anonymous_room_bans;
DROP POLICY IF EXISTS "public_anonymous_room_bans_delete" ON anonymous_room_bans;

drop policy if exists "public_anonymous_room_bans_select" on anonymous_room_bans;
CREATE POLICY "public_anonymous_room_bans_select" ON anonymous_room_bans
  FOR SELECT USING (true);

drop policy if exists "public_anonymous_room_bans_insert" on anonymous_room_bans;
CREATE POLICY "public_anonymous_room_bans_insert" ON anonymous_room_bans
  FOR INSERT WITH CHECK (true);

drop policy if exists "public_anonymous_room_bans_update" on anonymous_room_bans;
CREATE POLICY "public_anonymous_room_bans_update" ON anonymous_room_bans
  FOR UPDATE USING (true) WITH CHECK (true);

drop policy if exists "public_anonymous_room_bans_delete" on anonymous_room_bans;
CREATE POLICY "public_anonymous_room_bans_delete" ON anonymous_room_bans
  FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON anonymous_room_bans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON anonymous_room_bans TO authenticated;
GRANT ALL ON anonymous_room_bans TO service_role;


-- ===== MIGRATION: 018_anonymous_room_max_players.sql =====
ALTER TABLE games ADD COLUMN IF NOT EXISTS max_players integer CHECK (max_players IS NULL OR max_players BETWEEN 2 AND 15);


-- ===== MIGRATION: 019_anonymous_message_media.sql =====
-- Anonymous messages enhancements: GIF/sticker support
ALTER TABLE anonymous_messages ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text'
  CHECK (message_type IN ('text', 'gif'));
ALTER TABLE anonymous_messages ADD COLUMN IF NOT EXISTS media_url text;

-- GIF messages may have empty text; keep max length at 500.
ALTER TABLE anonymous_messages DROP CONSTRAINT IF EXISTS anonymous_messages_text_check;
ALTER TABLE anonymous_messages ADD CONSTRAINT anonymous_messages_text_check
  CHECK (char_length(text) BETWEEN 0 AND 500);


-- ===== MIGRATION: 020_anonymous_room_max_players_50.sql =====
-- App allows anonymous room caps up to 50; migration 018 capped at 15.
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_max_players_check;
ALTER TABLE games ADD CONSTRAINT games_max_players_check
  CHECK (max_players IS NULL OR max_players BETWEEN 2 AND 50);


-- ===== MIGRATION: 021_pool_usage.sql =====
-- Track cumulative pool usage across play-again sessions (custom questions & participant rotation).
alter table games add column if not exists pool_usage jsonb not null default '{}'::jsonb;


-- ===== MIGRATION: 022_anonymous_room_default_max_20.sql =====
-- Default anonymous room lobby cap (app also uses ANONYMOUS_ROOM_DEFAULT_MAX_PLAYERS = 20).
-- Superseded by 023_anonymous_room_max_players_20.sql for the 2–20 cap.
ALTER TABLE games ALTER COLUMN max_players SET DEFAULT 20;


-- ===== MIGRATION: 023_anonymous_room_max_players_20.sql =====
-- Cap anonymous room lobby size at 20 (was 50).
UPDATE games SET max_players = 20 WHERE max_players > 20;

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_max_players_check;
ALTER TABLE games ADD CONSTRAINT games_max_players_check
  CHECK (max_players IS NULL OR max_players BETWEEN 2 AND 20);

ALTER TABLE games ALTER COLUMN max_players SET DEFAULT 20;


-- ===== MIGRATION: 024_secret_message.sql =====
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_type_check;
ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN (
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'would_you_rather',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message'
));

ALTER TABLE app_feedback DROP CONSTRAINT IF EXISTS app_feedback_game_type_check;
ALTER TABLE app_feedback ADD CONSTRAINT app_feedback_game_type_check CHECK (game_type IN (
  'general',
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'would_you_rather',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message'
));


-- ===== MIGRATION: 025_product_updates.sql =====
create table if not exists product_updates (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('new', 'changed', 'upcoming')),
  title text not null,
  description text not null,
  month smallint check (month is null or (month >= 1 and month <= 12)),
  year smallint check (year is null or (year >= 2000 and year <= 2100)),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_product_updates_type on product_updates(type);
create index if not exists idx_product_updates_list on product_updates(type, year desc nulls last, month desc nulls last, sort_order desc);

alter table product_updates enable row level security;
drop policy if exists "public_product_updates_select" on product_updates;
create policy "public_product_updates_select" on product_updates for select to anon, authenticated using (true);

insert into product_updates (type, title, description, month, year, sort_order) values
  (
    'new',
    'Secret Message',
    'Send anonymous messages to a private board. Only the link owner sees what comes in — perfect for confessions, feedback, or surprise notes.',
    6,
    2026,
    100
  ),
  (
    'new',
    'Anonymous Messages',
    'A live anonymous inbox for your group. Everyone in the room can post and reply without revealing who said what.',
    5,
    2026,
    90
  ),
  (
    'new',
    'This or That',
    'Quick-fire binary choices — pick between two options and see how the group splits.',
    4,
    2026,
    80
  ),
  (
    'new',
    'Hot Seat',
    'One player in the spotlight answers questions while everyone else votes on their response.',
    3,
    2026,
    70
  ),
  (
    'new',
    'Custom game modes',
    'Build your own prompts and rules — run a game that fits your group exactly.',
    2,
    2026,
    60
  ),
  (
    'changed',
    'Game history',
    'Look up past rounds by room code. See who got voted for what after the game ends.',
    3,
    2026,
    100
  ),
  (
    'changed',
    'Participant-only voting',
    'Hosts can limit votes to named players in the room instead of open spectators.',
    2,
    2026,
    90
  ),
  (
    'changed',
    'Room themes',
    'Pick a visual theme when creating a game to match the vibe of your session.',
    1,
    2026,
    80
  ),
  (
    'changed',
    'Mobile experience',
    'Smoother layouts on phones — easier tapping, better card sizing, and faster room joins.',
    1,
    2026,
    70
  ),
  (
    'upcoming',
    'More game modes',
    'We are cooking up new party formats based on what players ask for most.',
    null,
    null,
    30
  ),
  (
    'upcoming',
    'Live reactions',
    'React to reveals in real time without leaving your vote screen.',
    null,
    null,
    20
  ),
  (
    'upcoming',
    'Shareable result cards',
    'Export a highlight reel or summary image after a wild round.',
    null,
    null,
    10
  );


-- ===== MIGRATION: 026_bingo.sql =====
CREATE TABLE IF NOT EXISTS bingo_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  cells integer[] NOT NULL,
  marked_indices integer[] NOT NULL DEFAULT '{12}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(game_id, player_id)
);

CREATE TABLE IF NOT EXISTS bingo_called_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  number integer NOT NULL CHECK (number >= 1 AND number <= 75),
  called_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(game_id, number)
);

CREATE TABLE IF NOT EXISTS bingo_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  pattern text NOT NULL DEFAULT 'line' CHECK (pattern IN ('line', 'full_house')),
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bingo_cards_game_id ON bingo_cards(game_id);
CREATE INDEX IF NOT EXISTS idx_bingo_called_numbers_game_id ON bingo_called_numbers(game_id);
CREATE INDEX IF NOT EXISTS idx_bingo_claims_game_id ON bingo_claims(game_id);

ALTER TABLE bingo_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE bingo_called_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bingo_claims ENABLE ROW LEVEL SECURITY;

drop policy if exists "public_bingo_cards" on bingo_cards;
CREATE POLICY "public_bingo_cards" ON bingo_cards FOR ALL USING (true) WITH CHECK (true);
drop policy if exists "public_bingo_called_numbers" on bingo_called_numbers;
CREATE POLICY "public_bingo_called_numbers" ON bingo_called_numbers FOR ALL USING (true) WITH CHECK (true);
drop policy if exists "public_bingo_claims" on bingo_claims;
CREATE POLICY "public_bingo_claims" ON bingo_claims FOR ALL USING (true) WITH CHECK (true);

do $$ begin alter publication supabase_realtime add table bingo_cards; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table bingo_called_numbers; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table bingo_claims; exception when duplicate_object then null; end $$;

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_type_check;
ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN (
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'would_you_rather',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo'
));

ALTER TABLE app_feedback DROP CONSTRAINT IF EXISTS app_feedback_game_type_check;
ALTER TABLE app_feedback ADD CONSTRAINT app_feedback_game_type_check CHECK (game_type IN (
  'general',
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'would_you_rather',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo'
));


-- ===== MIGRATION: 027_codewords.sql =====
CREATE TABLE IF NOT EXISTS codewords_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL UNIQUE REFERENCES games(id) ON DELETE CASCADE,
  words text[] NOT NULL,
  key text[] NOT NULL,
  starting_team text NOT NULL CHECK (starting_team IN ('red', 'blue')),
  revealed_indices integer[] NOT NULL DEFAULT '{}',
  current_turn text NOT NULL CHECK (current_turn IN ('red', 'blue')),
  guesses_remaining integer,
  current_clue_word text,
  current_clue_number integer,
  winner text CHECK (winner IN ('red', 'blue')),
  assassin_team text CHECK (assassin_team IN ('red', 'blue')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS codewords_player_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team text NOT NULL CHECK (team IN ('red', 'blue')),
  role text NOT NULL CHECK (role IN ('spymaster', 'operative')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(game_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_codewords_boards_game_id ON codewords_boards(game_id);
CREATE INDEX IF NOT EXISTS idx_codewords_player_roles_game_id ON codewords_player_roles(game_id);

ALTER TABLE codewords_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE codewords_player_roles ENABLE ROW LEVEL SECURITY;

drop policy if exists "public_codewords_boards" on codewords_boards;
CREATE POLICY "public_codewords_boards" ON codewords_boards FOR ALL USING (true) WITH CHECK (true);
drop policy if exists "public_codewords_player_roles" on codewords_player_roles;
CREATE POLICY "public_codewords_player_roles" ON codewords_player_roles FOR ALL USING (true) WITH CHECK (true);

do $$ begin alter publication supabase_realtime add table codewords_boards; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table codewords_player_roles; exception when duplicate_object then null; end $$;

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_type_check;
ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN (
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'would_you_rather',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords'
));

ALTER TABLE app_feedback DROP CONSTRAINT IF EXISTS app_feedback_game_type_check;
ALTER TABLE app_feedback ADD CONSTRAINT app_feedback_game_type_check CHECK (game_type IN (
  'general',
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'would_you_rather',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords'
));


-- ===== MIGRATION: 028_codewords_timers.sql =====
ALTER TABLE codewords_boards
  ADD COLUMN IF NOT EXISTS spymaster_timer_seconds integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS operative_timer_seconds integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS turn_phase text NOT NULL DEFAULT 'clue' CHECK (turn_phase IN ('clue', 'guess')),
  ADD COLUMN IF NOT EXISTS turn_deadline_at timestamptz;

ALTER TABLE games ADD COLUMN IF NOT EXISTS operative_timer_seconds integer;


-- ===== MIGRATION: 029_codewords_guesses.sql =====
CREATE TABLE IF NOT EXISTS codewords_guesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES codewords_boards(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  cell_index integer NOT NULL,
  word text NOT NULL,
  cell_type text NOT NULL CHECK (cell_type IN ('red', 'blue', 'neutral', 'assassin')),
  clue_word text,
  clue_number integer,
  team text NOT NULL CHECK (team IN ('red', 'blue')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_codewords_guesses_game_id ON codewords_guesses(game_id);
CREATE INDEX IF NOT EXISTS idx_codewords_guesses_board_id ON codewords_guesses(board_id);

ALTER TABLE codewords_guesses ENABLE ROW LEVEL SECURITY;
drop policy if exists "public_codewords_guesses" on codewords_guesses;
CREATE POLICY "public_codewords_guesses" ON codewords_guesses FOR ALL USING (true) WITH CHECK (true);

do $$ begin alter publication supabase_realtime add table codewords_guesses; exception when duplicate_object then null; end $$;


-- ===== MIGRATION: 030_codewords_settings.sql =====
ALTER TABLE games ADD COLUMN IF NOT EXISTS codewords_player_picks boolean NOT NULL DEFAULT true;


-- ===== MIGRATION: 031_codewords_late_join.sql =====
ALTER TABLE games ADD COLUMN IF NOT EXISTS codewords_late_join boolean NOT NULL DEFAULT false;


-- ===== MIGRATION: 032_bingo_max_players_30.sql =====
-- Bingo supports up to 30 players; anonymous/codewords still clamp in app code.
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_max_players_check;
ALTER TABLE games ADD CONSTRAINT games_max_players_check
  CHECK (max_players IS NULL OR max_players BETWEEN 2 AND 30);


-- ===== MIGRATION: 033_trivia.sql =====
ALTER TABLE games ADD COLUMN IF NOT EXISTS trivia_category text CHECK (trivia_category IN ('tech', 'general'));

ALTER TABLE rounds ADD COLUMN IF NOT EXISTS trivia_metadata jsonb;

CREATE TABLE IF NOT EXISTS trivia_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  choice_index integer NOT NULL CHECK (choice_index >= 0 AND choice_index <= 3),
  is_correct boolean NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now(),
  response_ms integer NOT NULL,
  points integer NOT NULL DEFAULT 0,
  UNIQUE(player_id, round_id)
);

CREATE INDEX IF NOT EXISTS idx_trivia_answers_game_id ON trivia_answers(game_id);
CREATE INDEX IF NOT EXISTS idx_trivia_answers_round_id ON trivia_answers(round_id);

ALTER TABLE trivia_answers ENABLE ROW LEVEL SECURITY;
drop policy if exists "public_trivia_answers" on trivia_answers;
CREATE POLICY "public_trivia_answers" ON trivia_answers FOR ALL USING (true) WITH CHECK (true);

do $$ begin alter publication supabase_realtime add table trivia_answers; exception when duplicate_object then null; end $$;

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_type_check;
ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN (
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'would_you_rather',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia'
));

ALTER TABLE app_feedback DROP CONSTRAINT IF EXISTS app_feedback_game_type_check;
ALTER TABLE app_feedback ADD CONSTRAINT app_feedback_game_type_check CHECK (game_type IN (
  'general',
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'would_you_rather',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia'
));


-- ===== MIGRATION: 034_bingo_call_mode.sql =====
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS bingo_call_mode text NOT NULL DEFAULT 'manual'
    CHECK (bingo_call_mode IN ('manual', 'auto'));

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS bingo_call_interval_seconds integer NOT NULL DEFAULT 5
    CHECK (bingo_call_interval_seconds >= 2 AND bingo_call_interval_seconds <= 30);


-- ===== MIGRATION: 035_codewords_randomize_teams.sql =====
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS codewords_randomize_teams boolean NOT NULL DEFAULT false;


-- ===== MIGRATION: 036_two_truths.sql =====
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS ttl_metadata jsonb;

CREATE TABLE IF NOT EXISTS ttl_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  statement_a text NOT NULL,
  statement_b text NOT NULL,
  statement_c text NOT NULL,
  lie_index integer NOT NULL CHECK (lie_index >= 0 AND lie_index <= 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(game_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_ttl_statements_game_id ON ttl_statements(game_id);

ALTER TABLE ttl_statements ENABLE ROW LEVEL SECURITY;
drop policy if exists "public_ttl_statements" on ttl_statements;
CREATE POLICY "public_ttl_statements" ON ttl_statements FOR ALL USING (true) WITH CHECK (true);

do $$ begin alter publication supabase_realtime add table ttl_statements; exception when duplicate_object then null; end $$;

CREATE TABLE IF NOT EXISTS ttl_guesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  guessed_index integer NOT NULL CHECK (guessed_index >= 0 AND guessed_index <= 2),
  is_correct boolean NOT NULL,
  points integer NOT NULL DEFAULT 0,
  guessed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(player_id, round_id)
);

CREATE INDEX IF NOT EXISTS idx_ttl_guesses_game_id ON ttl_guesses(game_id);
CREATE INDEX IF NOT EXISTS idx_ttl_guesses_round_id ON ttl_guesses(round_id);

ALTER TABLE ttl_guesses ENABLE ROW LEVEL SECURITY;
drop policy if exists "public_ttl_guesses" on ttl_guesses;
CREATE POLICY "public_ttl_guesses" ON ttl_guesses FOR ALL USING (true) WITH CHECK (true);

do $$ begin alter publication supabase_realtime add table ttl_guesses; exception when duplicate_object then null; end $$;

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_type_check;
ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN (
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'would_you_rather',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths'
));

ALTER TABLE app_feedback DROP CONSTRAINT IF EXISTS app_feedback_game_type_check;
ALTER TABLE app_feedback ADD CONSTRAINT app_feedback_game_type_check CHECK (game_type IN (
  'general',
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'would_you_rather',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths'
));


-- ===== MIGRATION: 037_max_players_40.sql =====
-- Trivia and Two Truths support up to 40 players; bingo/codewords still clamp in app code.
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_max_players_check;
ALTER TABLE games ADD CONSTRAINT games_max_players_check
  CHECK (max_players IS NULL OR max_players BETWEEN 2 AND 40);


-- ===== MIGRATION: 038_game_player_limits.sql =====
-- Admin-editable max player caps per lobby game type.
create table if not exists game_player_limits (
  game_type text primary key check (
    game_type in ('anonymous_messages', 'bingo', 'codewords', 'trivia', 'two_truths')
  ),
  max_players integer not null check (max_players >= 2 and max_players <= 100),
  updated_at timestamptz not null default now()
);

alter table game_player_limits enable row level security;
drop policy if exists "public_game_player_limits_select" on game_player_limits;
create policy "public_game_player_limits_select" on game_player_limits
  for select to anon, authenticated using (true);

insert into game_player_limits (game_type, max_players) values
  ('anonymous_messages', 20),
  ('bingo', 30),
  ('codewords', 20),
  ('trivia', 40),
  ('two_truths', 40)
on conflict (game_type) do nothing;

-- Raise global games.max_players ceiling; per-game caps enforced in app.
alter table games drop constraint if exists games_max_players_check;
alter table games add constraint games_max_players_check
  check (max_players is null or max_players between 2 and 100);


-- ===== MIGRATION: 039_bingo_default_auto_call.sql =====
-- New bingo games default to automatic number calling.
ALTER TABLE games ALTER COLUMN bingo_call_mode SET DEFAULT 'auto';


-- ===== MIGRATION: 040_parent_approval.sql =====
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_type_check;
ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN (
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths'
));

ALTER TABLE app_feedback DROP CONSTRAINT IF EXISTS app_feedback_game_type_check;
ALTER TABLE app_feedback ADD CONSTRAINT app_feedback_game_type_check CHECK (game_type IN (
  'general',
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths'
));


-- ===== MIGRATION: 040_wst_multiple_quotes.sql =====
-- Allow multiple quotes per player in Who Said This lobby pool
ALTER TABLE wst_quote_pool DROP CONSTRAINT IF EXISTS wst_quote_pool_game_id_player_id_key;


-- ===== MIGRATION: 041_monopoly.sql =====
CREATE TABLE IF NOT EXISTS monopoly_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL UNIQUE REFERENCES games(id) ON DELETE CASCADE,
  turn_order uuid[] NOT NULL DEFAULT '{}',
  current_turn_index integer NOT NULL DEFAULT 0,
  phase text NOT NULL DEFAULT 'roll' CHECK (phase IN ('roll', 'buy', 'jail', 'pay_rent', 'finished')),
  last_dice jsonb,
  consecutive_doubles integer NOT NULL DEFAULT 0,
  property_owners jsonb NOT NULL DEFAULT '{}',
  pending_space integer,
  status_message text,
  winner_player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monopoly_boards_game_id ON monopoly_boards(game_id);

CREATE TABLE IF NOT EXISTS monopoly_player_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0 AND position <= 39),
  cash integer NOT NULL DEFAULT 1500,
  in_jail boolean NOT NULL DEFAULT false,
  jail_turns integer NOT NULL DEFAULT 0,
  get_out_of_jail_free integer NOT NULL DEFAULT 0,
  bankrupt boolean NOT NULL DEFAULT false,
  player_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(game_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_monopoly_player_state_game_id ON monopoly_player_state(game_id);

ALTER TABLE monopoly_boards ENABLE ROW LEVEL SECURITY;
drop policy if exists "public_monopoly_boards" on monopoly_boards;
CREATE POLICY "public_monopoly_boards" ON monopoly_boards FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE monopoly_player_state ENABLE ROW LEVEL SECURITY;
drop policy if exists "public_monopoly_player_state" on monopoly_player_state;
CREATE POLICY "public_monopoly_player_state" ON monopoly_player_state FOR ALL USING (true) WITH CHECK (true);

do $$ begin alter publication supabase_realtime add table monopoly_boards; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table monopoly_player_state; exception when duplicate_object then null; end $$;

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_type_check;
ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN (
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly'
));

ALTER TABLE app_feedback DROP CONSTRAINT IF EXISTS app_feedback_game_type_check;
ALTER TABLE app_feedback ADD CONSTRAINT app_feedback_game_type_check CHECK (game_type IN (
  'general',
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly'
));

ALTER TABLE game_player_limits DROP CONSTRAINT IF EXISTS game_player_limits_game_type_check;
ALTER TABLE game_player_limits ADD CONSTRAINT game_player_limits_game_type_check CHECK (
  game_type IN ('anonymous_messages', 'bingo', 'codewords', 'trivia', 'two_truths', 'monopoly')
);

INSERT INTO game_player_limits (game_type, max_players)
VALUES ('monopoly', 6)
ON CONFLICT (game_type) DO NOTHING;


-- ===== MIGRATION: 041_wst_host_quotes.sql =====
-- Allow host-added quotes without a linked player row
ALTER TABLE wst_quote_pool ALTER COLUMN player_id DROP NOT NULL;


-- ===== MIGRATION: 042_allow_viewers.sql =====
ALTER TABLE games ADD COLUMN IF NOT EXISTS allow_viewers boolean NOT NULL DEFAULT true;


-- ===== MIGRATION: 042_monopoly_pay_rent_phase.sql =====
ALTER TABLE monopoly_boards DROP CONSTRAINT IF EXISTS monopoly_boards_phase_check;
ALTER TABLE monopoly_boards ADD CONSTRAINT monopoly_boards_phase_check CHECK (
  phase IN ('roll', 'buy', 'jail', 'pay_rent', 'finished')
);


-- ===== MIGRATION: 043_players_spectator.sql =====
ALTER TABLE players ADD COLUMN IF NOT EXISTS spectator boolean NOT NULL DEFAULT false;


-- ===== MIGRATION: 044_allow_late_players.sql =====
ALTER TABLE games ADD COLUMN IF NOT EXISTS allow_late_players boolean NOT NULL DEFAULT true;

-- Existing games with late join enabled keep player late join on.
UPDATE games SET allow_late_players = allow_viewers WHERE allow_viewers = true;


-- ===== MIGRATION: 045_yahtzee.sql =====
CREATE TABLE IF NOT EXISTS yahtzee_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL UNIQUE REFERENCES games(id) ON DELETE CASCADE,
  turn_order uuid[] NOT NULL DEFAULT '{}',
  current_turn_index integer NOT NULL DEFAULT 0,
  phase text NOT NULL DEFAULT 'rolling' CHECK (phase IN ('rolling', 'finished')),
  dice integer[] NOT NULL DEFAULT '{1,1,1,1,1}',
  held boolean[] NOT NULL DEFAULT '{false,false,false,false,false}',
  rolls_remaining integer NOT NULL DEFAULT 3,
  rolls_this_turn integer NOT NULL DEFAULT 0,
  status_message text,
  winner_player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_yahtzee_sessions_game_id ON yahtzee_sessions(game_id);

CREATE TABLE IF NOT EXISTS yahtzee_player_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  scores jsonb NOT NULL DEFAULT '{}',
  player_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(game_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_yahtzee_player_scores_game_id ON yahtzee_player_scores(game_id);

ALTER TABLE yahtzee_sessions ENABLE ROW LEVEL SECURITY;
drop policy if exists "public_yahtzee_sessions" on yahtzee_sessions;
CREATE POLICY "public_yahtzee_sessions" ON yahtzee_sessions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE yahtzee_player_scores ENABLE ROW LEVEL SECURITY;
drop policy if exists "public_yahtzee_player_scores" on yahtzee_player_scores;
CREATE POLICY "public_yahtzee_player_scores" ON yahtzee_player_scores FOR ALL USING (true) WITH CHECK (true);

do $$ begin alter publication supabase_realtime add table yahtzee_sessions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table yahtzee_player_scores; exception when duplicate_object then null; end $$;

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_type_check;
ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN (
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly',
  'yahtzee'
));

ALTER TABLE app_feedback DROP CONSTRAINT IF EXISTS app_feedback_game_type_check;
ALTER TABLE app_feedback ADD CONSTRAINT app_feedback_game_type_check CHECK (game_type IN (
  'general',
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly',
  'yahtzee'
));

ALTER TABLE game_player_limits DROP CONSTRAINT IF EXISTS game_player_limits_game_type_check;
ALTER TABLE game_player_limits ADD CONSTRAINT game_player_limits_game_type_check CHECK (
  game_type IN ('anonymous_messages', 'bingo', 'codewords', 'trivia', 'two_truths', 'monopoly', 'yahtzee')
);

INSERT INTO game_player_limits (game_type, max_players)
VALUES ('yahtzee', 6)
ON CONFLICT (game_type) DO NOTHING;


-- ===== MIGRATION: 046_yahtzee_timer.sql =====
-- Add per-turn deadline to yahtzee sessions (null = no timer)
ALTER TABLE yahtzee_sessions ADD COLUMN IF NOT EXISTS turn_deadline_at timestamptz;


-- ===== MIGRATION: 047_monopoly_uk_full.sql =====
-- UK Monopoly: buildings, mortgages, auctions, trades, card decks
ALTER TABLE monopoly_boards ADD COLUMN IF NOT EXISTS property_buildings jsonb NOT NULL DEFAULT '{}';
ALTER TABLE monopoly_boards ADD COLUMN IF NOT EXISTS mortgaged_properties jsonb NOT NULL DEFAULT '{}';
ALTER TABLE monopoly_boards ADD COLUMN IF NOT EXISTS houses_in_bank integer NOT NULL DEFAULT 32;
ALTER TABLE monopoly_boards ADD COLUMN IF NOT EXISTS hotels_in_bank integer NOT NULL DEFAULT 12;
ALTER TABLE monopoly_boards ADD COLUMN IF NOT EXISTS chance_deck jsonb NOT NULL DEFAULT '[]';
ALTER TABLE monopoly_boards ADD COLUMN IF NOT EXISTS community_deck jsonb NOT NULL DEFAULT '[]';
ALTER TABLE monopoly_boards ADD COLUMN IF NOT EXISTS chance_discard jsonb NOT NULL DEFAULT '[]';
ALTER TABLE monopoly_boards ADD COLUMN IF NOT EXISTS community_discard jsonb NOT NULL DEFAULT '[]';
ALTER TABLE monopoly_boards ADD COLUMN IF NOT EXISTS auction_state jsonb;
ALTER TABLE monopoly_boards ADD COLUMN IF NOT EXISTS pending_trade jsonb;

ALTER TABLE monopoly_boards DROP CONSTRAINT IF EXISTS monopoly_boards_phase_check;
ALTER TABLE monopoly_boards ADD CONSTRAINT monopoly_boards_phase_check CHECK (
  phase IN ('roll', 'buy', 'jail', 'pay_rent', 'auction', 'finished')
);


-- ===== MIGRATION: 047_yahtzee_solo_play.sql =====
-- Allow solo Yahtzee rooms (max_players = 1).
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_max_players_check;
ALTER TABLE games ADD CONSTRAINT games_max_players_check
  CHECK (max_players IS NULL OR max_players BETWEEN 1 AND 100);


-- ===== MIGRATION: 048_monopoly_last_card_event.sql =====
-- Store the latest Chance / Community Chest draw for per-player UI alerts.
alter table public.monopoly_boards
  add column if not exists last_card_event jsonb;


-- ===== MIGRATION: 049_monopoly_timer_and_rent_event.sql =====
-- Monopoly turn timer + structured rent events for per-player UI.
alter table public.monopoly_boards
  add column if not exists turn_deadline_at timestamptz;

alter table public.monopoly_boards
  add column if not exists last_rent_event jsonb;


-- ===== MIGRATION: 050_monopoly_game_duration.sql =====
-- Monopoly whole-game time limit (host sets at create; 0 = no limit).
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS game_duration_seconds integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN games.game_duration_seconds IS 'Monopoly: max active session length in seconds from session_started_at; 0 = unlimited.';


-- ===== MIGRATION: 051_monopoly_last_cash_event.sql =====
-- Per-player cash change events so players see why their balance changed.
alter table public.monopoly_boards
  add column if not exists last_cash_event jsonb;


-- ===== MIGRATION: 052_monopoly_raise_funds.sql =====
-- Raise-funds phase before bankruptcy + structured debt context.
alter table public.monopoly_boards
  add column if not exists pending_debt jsonb;

alter table public.monopoly_boards drop constraint if exists monopoly_boards_phase_check;
alter table public.monopoly_boards add constraint monopoly_boards_phase_check check (
  phase in ('roll', 'buy', 'jail', 'pay_rent', 'auction', 'raise_funds', 'finished')
);


-- ===== MIGRATION: 053_monopoly_last_trade_event.sql =====
-- Trade accept/decline events for per-player feedback.
alter table public.monopoly_boards
  add column if not exists last_trade_event jsonb;


-- ===== MIGRATION: 054_monopoly_passed_go_once.sql =====
-- Track whether a player has passed GO at least once (required before buying property).
ALTER TABLE public.monopoly_player_state
  ADD COLUMN IF NOT EXISTS passed_go_once boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.monopoly_player_state.passed_go_once IS
  'True after the player has passed GO while moving forward; unlocks buying, card draws, and GO salary on subsequent laps.';


-- ===== MIGRATION: 054_never_have_i_ever.sql =====
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_type_check;
ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN (
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly',
  'yahtzee',
  'never_have_i_ever'
));

ALTER TABLE app_feedback DROP CONSTRAINT IF EXISTS app_feedback_game_type_check;
ALTER TABLE app_feedback ADD CONSTRAINT app_feedback_game_type_check CHECK (game_type IN (
  'general',
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly',
  'yahtzee',
  'never_have_i_ever'
));


-- ===== MIGRATION: 055_game_finished_at.sql =====
ALTER TABLE games ADD COLUMN IF NOT EXISTS finished_at timestamptz;

COMMENT ON COLUMN games.finished_at IS 'When the game session ended (status set to finished).';

UPDATE games g
SET finished_at = sub.max_ended
FROM (
  SELECT game_id, MAX(ended_at) AS max_ended
  FROM rounds
  WHERE ended_at IS NOT NULL
  GROUP BY game_id
) sub
WHERE g.id = sub.game_id
  AND g.status = 'finished'
  AND g.finished_at IS NULL;


-- ===== MIGRATION: 056_monopoly_player_token.sql =====
-- Monopoly player board token (car, hat, dog, etc.) chosen at join.
ALTER TABLE players ADD COLUMN IF NOT EXISTS monopoly_token text;

CREATE UNIQUE INDEX IF NOT EXISTS players_game_monopoly_token_unique
  ON players (game_id, monopoly_token)
  WHERE monopoly_token IS NOT NULL;


-- ===== MIGRATION: 057_whot.sql =====
CREATE TABLE IF NOT EXISTS whot_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL UNIQUE REFERENCES games(id) ON DELETE CASCADE,
  turn_order uuid[] NOT NULL DEFAULT '{}',
  current_turn_index integer NOT NULL DEFAULT 0,
  phase text NOT NULL DEFAULT 'playing' CHECK (phase IN ('playing', 'choose_whot', 'finished')),
  draw_pile jsonb NOT NULL DEFAULT '[]',
  top_card jsonb,
  required_shape text CHECK (required_shape IS NULL OR required_shape IN ('circle', 'cross', 'triangle', 'square', 'star', 'whot')),
  required_number integer CHECK (required_number IS NULL OR (required_number >= 1 AND required_number <= 14)),
  pick_two_stack integer NOT NULL DEFAULT 0,
  pick_five_stack integer NOT NULL DEFAULT 0,
  status_message text,
  winner_player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  turn_deadline_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whot_sessions_game_id ON whot_sessions(game_id);

CREATE TABLE IF NOT EXISTS whot_player_hands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  cards jsonb NOT NULL DEFAULT '[]',
  player_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(game_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_whot_player_hands_game_id ON whot_player_hands(game_id);

ALTER TABLE whot_sessions ENABLE ROW LEVEL SECURITY;
drop policy if exists "public_whot_sessions" on whot_sessions;
CREATE POLICY "public_whot_sessions" ON whot_sessions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE whot_player_hands ENABLE ROW LEVEL SECURITY;
drop policy if exists "public_whot_player_hands" on whot_player_hands;
CREATE POLICY "public_whot_player_hands" ON whot_player_hands FOR ALL USING (true) WITH CHECK (true);

do $$ begin alter publication supabase_realtime add table whot_sessions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table whot_player_hands; exception when duplicate_object then null; end $$;

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_type_check;
ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN (
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'never_have_i_ever',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly',
  'yahtzee',
  'whot'
));

ALTER TABLE app_feedback DROP CONSTRAINT IF EXISTS app_feedback_game_type_check;
ALTER TABLE app_feedback ADD CONSTRAINT app_feedback_game_type_check CHECK (game_type IN (
  'general',
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'never_have_i_ever',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly',
  'yahtzee',
  'whot'
));

ALTER TABLE game_player_limits DROP CONSTRAINT IF EXISTS game_player_limits_game_type_check;
ALTER TABLE game_player_limits ADD CONSTRAINT game_player_limits_game_type_check CHECK (
  game_type IN ('anonymous_messages', 'bingo', 'codewords', 'trivia', 'two_truths', 'monopoly', 'yahtzee', 'whot')
);

INSERT INTO game_player_limits (game_type, max_players)
VALUES ('whot', 6)
ON CONFLICT (game_type) DO NOTHING;


-- ===== MIGRATION: 058_whot_discard_pile.sql =====
ALTER TABLE whot_sessions
  ADD COLUMN IF NOT EXISTS discard_pile jsonb NOT NULL DEFAULT '[]';


-- ===== MIGRATION: 059_ludo.sql =====
CREATE TABLE IF NOT EXISTS ludo_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL UNIQUE REFERENCES games(id) ON DELETE CASCADE,
  turn_order uuid[] NOT NULL DEFAULT '{}',
  current_turn_index integer NOT NULL DEFAULT 0,
  phase text NOT NULL DEFAULT 'roll' CHECK (phase IN ('roll', 'move', 'finished')),
  last_dice integer CHECK (last_dice IS NULL OR (last_dice >= 1 AND last_dice <= 6)),
  consecutive_sixes integer NOT NULL DEFAULT 0,
  extra_turn boolean NOT NULL DEFAULT false,
  status_message text,
  winner_player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  turn_deadline_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ludo_sessions_game_id ON ludo_sessions(game_id);

CREATE TABLE IF NOT EXISTS ludo_player_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  color text NOT NULL CHECK (color IN ('red', 'green', 'yellow', 'blue')),
  pieces jsonb NOT NULL DEFAULT '[]',
  player_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(game_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_ludo_player_state_game_id ON ludo_player_state(game_id);

ALTER TABLE ludo_sessions ENABLE ROW LEVEL SECURITY;
drop policy if exists "public_ludo_sessions" on ludo_sessions;
CREATE POLICY "public_ludo_sessions" ON ludo_sessions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE ludo_player_state ENABLE ROW LEVEL SECURITY;
drop policy if exists "public_ludo_player_state" on ludo_player_state;
CREATE POLICY "public_ludo_player_state" ON ludo_player_state FOR ALL USING (true) WITH CHECK (true);

do $$ begin alter publication supabase_realtime add table ludo_sessions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table ludo_player_state; exception when duplicate_object then null; end $$;

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_type_check;
ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN (
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'never_have_i_ever',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly',
  'yahtzee',
  'whot',
  'ludo'
));

ALTER TABLE app_feedback DROP CONSTRAINT IF EXISTS app_feedback_game_type_check;
ALTER TABLE app_feedback ADD CONSTRAINT app_feedback_game_type_check CHECK (game_type IN (
  'general',
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'never_have_i_ever',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly',
  'yahtzee',
  'whot',
  'ludo'
));

ALTER TABLE game_player_limits DROP CONSTRAINT IF EXISTS game_player_limits_game_type_check;
ALTER TABLE game_player_limits ADD CONSTRAINT game_player_limits_game_type_check CHECK (
  game_type IN ('anonymous_messages', 'bingo', 'codewords', 'trivia', 'two_truths', 'monopoly', 'yahtzee', 'whot', 'ludo')
);

INSERT INTO game_player_limits (game_type, max_players)
VALUES ('ludo', 4)
ON CONFLICT (game_type) DO NOTHING;


-- ===== MIGRATION: 060_pick_a_number.sql =====
ALTER TABLE votes ADD COLUMN IF NOT EXISTS picked_number integer CHECK (picked_number IS NULL OR picked_number >= 1);

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_type_check;
ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN (
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'never_have_i_ever',
  'pick_a_number',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly',
  'yahtzee',
  'whot',
  'ludo'
));

ALTER TABLE app_feedback DROP CONSTRAINT IF EXISTS app_feedback_game_type_check;
ALTER TABLE app_feedback ADD CONSTRAINT app_feedback_game_type_check CHECK (game_type IN (
  'general',
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'never_have_i_ever',
  'pick_a_number',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly',
  'yahtzee',
  'whot',
  'ludo'
));


-- ===== MIGRATION: 061_player_resume_token.sql =====
-- Per-player resume code for continuing on another device without signing in.
ALTER TABLE players ADD COLUMN IF NOT EXISTS resume_token text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_game_resume_token
  ON players (game_id, resume_token)
  WHERE resume_token IS NOT NULL;

CREATE OR REPLACE FUNCTION set_player_resume_token()
RETURNS TRIGGER AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  attempts int := 0;
BEGIN
  IF NEW.resume_token IS NOT NULL THEN
    RETURN NEW;
  END IF;
  LOOP
    candidate := '';
    FOR i IN 1..6 LOOP
      candidate := candidate || substr(chars, floor(random() * length(chars))::int + 1, 1);
    END LOOP;
    IF NOT EXISTS (
      SELECT 1 FROM players p
      WHERE p.game_id = NEW.game_id AND p.resume_token = candidate
    ) THEN
      NEW.resume_token := candidate;
      RETURN NEW;
    END IF;
    attempts := attempts + 1;
    IF attempts > 24 THEN
      RAISE EXCEPTION 'Could not generate player resume token';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS players_set_resume_token ON players;
CREATE TRIGGER players_set_resume_token
  BEFORE INSERT ON players
  FOR EACH ROW
  EXECUTE FUNCTION set_player_resume_token();

-- Backfill existing players.
DO $$
DECLARE
  r record;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  ok boolean;
BEGIN
  FOR r IN SELECT id, game_id FROM players WHERE resume_token IS NULL LOOP
    LOOP
      candidate := '';
      FOR i IN 1..6 LOOP
        candidate := candidate || substr(chars, floor(random() * length(chars))::int + 1, 1);
      END LOOP;
      ok := NOT EXISTS (
        SELECT 1 FROM players p
        WHERE p.game_id = r.game_id AND p.resume_token = candidate AND p.id <> r.id
      );
      EXIT WHEN ok;
    END LOOP;
    UPDATE players SET resume_token = candidate WHERE id = r.id;
  END LOOP;
END $$;


-- ===== MIGRATION: 062_product_updates_missing.sql =====
-- Backfill product updates for game modes and features shipped after 025_product_updates.sql

insert into product_updates (type, title, description, month, year, sort_order)
select v.type, v.title, v.description, v.month, v.year, v.sort_order
from (
  values
    (
      'new',
      'Bingo',
      $$Classic 75-ball bingo for parties. Everyone gets a unique card on their phone — you call numbers, they mark squares, and the first line wins.$$,
      3::smallint,
      2026::smallint,
      75::integer
    ),
    (
      'new',
      'Codewords',
      $$The word-association spy game online. Red vs Blue teams — spymasters give one-word clues, operatives guess words on a 5x5 grid. Avoid the assassin!$$,
      3,
      2026,
      72
    ),
    (
      'new',
      'Trivia',
      $$Speed-based quiz for groups. Pick Tech or General Knowledge, or upload your own questions — fastest correct answers climb the leaderboard.$$,
      4,
      2026,
      85
    ),
    (
      'new',
      'Two Truths and a Lie',
      $$Classic icebreaker, online. Everyone submits two truths and a lie, then takes turns in the hot seat while the group guesses the fib.$$,
      4,
      2026,
      82
    ),
    (
      'new',
      'Date My Kid',
      $$One name steps into the spotlight each round. Would you let your son or daughter date or marry them? Yes or no votes, live reveals.$$,
      5,
      2026,
      88
    ),
    (
      'new',
      'Monopoly',
      $$Classic Monopoly on your phones. Roll dice, buy properties, pay rent, trade, and bankrupt opponents — 2–6 players, real-time turns.$$,
      5,
      2026,
      85
    ),
    (
      'new',
      'Yahtzee',
      $$Roll-and-hold dice scoring with friends. Up to three rolls per turn — fill your scorecard with straights, full houses, and Yahtzees.$$,
      5,
      2026,
      82
    ),
    (
      'new',
      'Never Have I Ever',
      $$Confession game with anonymous I have / I haven't votes. Use built-in prompts or upload your own and see how spicy the group really is.$$,
      5,
      2026,
      78
    ),
    (
      'new',
      'Whot',
      $$The Nigerian card classic online. Match shape or number, stack Pick 2 and Pick 3, play WHOT — first to empty your hand wins.$$,
      6,
      2026,
      110
    ),
    (
      'new',
      'Ludo',
      $$Classic board game on your phones. Roll the die, race your pieces home, capture opponents, and block with pairs — 2–4 players.$$,
      6,
      2026,
      115
    ),
    (
      'new',
      'Pick a Number',
      $$Pick a number from a hidden list — you won't know the question until after you choose. Upload your own prompts or use the built-in pool.$$,
      6,
      2026,
      120
    ),
    (
      'changed',
      'Spectators & late join',
      $$Hosts can allow viewers who watch without playing, or let late arrivals join mid-game when the room settings allow it.$$,
      4,
      2026,
      95
    ),
    (
      'changed',
      'Resume on another device',
      $$Each player gets a personal resume code in the lobby. Switch phones or browsers without losing your spot in the game.$$,
      6,
      2026,
      110
    )
) as v(type, title, description, month, year, sort_order)
where not exists (
  select 1 from product_updates pu where pu.title = v.title
);


-- ===== MIGRATION: 063_codewords_chat.sql =====
CREATE TABLE IF NOT EXISTS codewords_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team text NOT NULL CHECK (team IN ('red', 'blue')),
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_codewords_messages_game_team ON codewords_messages(game_id, team, created_at);

ALTER TABLE codewords_messages ENABLE ROW LEVEL SECURITY;
drop policy if exists "public_codewords_messages" on codewords_messages;
CREATE POLICY "public_codewords_messages" ON codewords_messages FOR ALL USING (true) WITH CHECK (true);

do $$ begin alter publication supabase_realtime add table codewords_messages; exception when duplicate_object then null; end $$;


-- ===== MIGRATION: 064_whot_rules.sql =====
ALTER TABLE games ADD COLUMN IF NOT EXISTS whot_pick3_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE games ADD COLUMN IF NOT EXISTS whot_cards_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE games ADD COLUMN IF NOT EXISTS whot_number_calls_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN games.whot_pick3_enabled IS 'Whot: include Pick 3 (5) cards and penalty stacking.';
COMMENT ON COLUMN games.whot_cards_enabled IS 'Whot: include WHOT (20) wild cards in the deck.';
COMMENT ON COLUMN games.whot_number_calls_enabled IS 'Whot: allow calling a number (not just shape) when playing WHOT.';


-- ===== MIGRATION: 065_product_updates_lobby_improvements.sql =====
-- What's new: player lobby, late join default, and rules link placement (June 2026)

insert into product_updates (type, title, description, month, year, sort_order)
select v.type, v.title, v.description, v.month, v.year, v.sort_order
from (
  values
    (
      'changed',
      'Player lobby lists',
      $$Waiting lobbies across Ludo, Whot, Yahtzee, Bingo, Trivia, Two Truths, Codewords, and more now show everyone’s names — not just a headcount like “2 players in lobby.”$$,
      6::smallint,
      2026::smallint,
      125::integer
    ),
    (
      'changed',
      'Late joiners default',
      $$When creating a game, Late joiners now defaults to Viewers only — late arrivals watch live instead of joining as players unless you change it. Board games like Monopoly and Ludo only offer lobby-only or watch-only options.$$,
      6,
      2026,
      120
    ),
    (
      'changed',
      'View game rules in lobby',
      $$In the player waiting room, View game rules now appears above the In lobby player list so you can read up before the host starts.$$,
      6,
      2026,
      115
    )
) as v(type, title, description, month, year, sort_order)
where not exists (
  select 1 from product_updates pu where pu.title = v.title
);


-- ===== MIGRATION: 066_ludo_two_dice.sql =====
-- Ludo uses two dice (stored as jsonb like Monopoly).

ALTER TABLE ludo_sessions DROP CONSTRAINT IF EXISTS ludo_sessions_last_dice_check;

ALTER TABLE ludo_sessions
  ALTER COLUMN last_dice TYPE jsonb
  USING (
    CASE
      WHEN last_dice IS NULL THEN NULL
      ELSE jsonb_build_object(
        'd1', last_dice,
        'd2', 1,
        'total', last_dice,
        'doubles', false
      )
    END
  );


-- ===== MIGRATION: 067_ludo_remaining_dice.sql =====
-- Track which die values are still to be played after a two-dice roll (e.g. [6, 3]).

ALTER TABLE ludo_sessions
  ADD COLUMN IF NOT EXISTS remaining_dice jsonb;


-- ===== MIGRATION: 068_i_call_on.sql =====
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS npat_metadata jsonb;

CREATE TABLE IF NOT EXISTS npat_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  animal text NOT NULL DEFAULT '',
  place text NOT NULL DEFAULT '',
  thing text NOT NULL DEFAULT '',
  submitted_at timestamptz,
  score_name integer,
  score_animal integer,
  score_place integer,
  score_thing integer,
  UNIQUE(player_id, round_id)
);

CREATE INDEX IF NOT EXISTS idx_npat_answers_game_id ON npat_answers(game_id);
CREATE INDEX IF NOT EXISTS idx_npat_answers_round_id ON npat_answers(round_id);

CREATE TABLE IF NOT EXISTS npat_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  marker_player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  target_player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  valid_name boolean NOT NULL DEFAULT true,
  valid_animal boolean NOT NULL DEFAULT true,
  valid_place boolean NOT NULL DEFAULT true,
  valid_thing boolean NOT NULL DEFAULT true,
  marked_at timestamptz,
  UNIQUE(marker_player_id, round_id)
);

CREATE INDEX IF NOT EXISTS idx_npat_marks_game_id ON npat_marks(game_id);
CREATE INDEX IF NOT EXISTS idx_npat_marks_round_id ON npat_marks(round_id);

ALTER TABLE npat_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_npat_answers" ON npat_answers;
drop policy if exists "public_npat_answers" on npat_answers;
CREATE POLICY "public_npat_answers" ON npat_answers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE npat_marks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_npat_marks" ON npat_marks;
drop policy if exists "public_npat_marks" on npat_marks;
CREATE POLICY "public_npat_marks" ON npat_marks FOR ALL USING (true) WITH CHECK (true);

do $$ begin alter publication supabase_realtime add table npat_answers; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table npat_marks; exception when duplicate_object then null; end $$;

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_type_check;
ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN (
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'never_have_i_ever',
  'pick_a_number',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly',
  'yahtzee',
  'whot',
  'ludo',
  'i_call_on'
));

ALTER TABLE app_feedback DROP CONSTRAINT IF EXISTS app_feedback_game_type_check;
ALTER TABLE app_feedback ADD CONSTRAINT app_feedback_game_type_check CHECK (game_type IN (
  'general',
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'never_have_i_ever',
  'pick_a_number',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly',
  'yahtzee',
  'whot',
  'ludo',
  'i_call_on'
));

ALTER TABLE game_player_limits DROP CONSTRAINT IF EXISTS game_player_limits_game_type_check;
ALTER TABLE game_player_limits ADD CONSTRAINT game_player_limits_game_type_check CHECK (
  game_type IN ('anonymous_messages', 'bingo', 'codewords', 'trivia', 'two_truths', 'monopoly', 'yahtzee', 'whot', 'ludo', 'i_call_on')
);

INSERT INTO game_player_limits (game_type, max_players)
VALUES ('i_call_on', 20)
ON CONFLICT (game_type) DO NOTHING;


-- ===== MIGRATION: 069_i_call_on_rename.sql =====
-- Rename game type from name_place_animal_thing → i_call_on (068 may have run under the old id).
-- Drop constraints first so rows can use i_call_on before the new check is applied.

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_type_check;
ALTER TABLE app_feedback DROP CONSTRAINT IF EXISTS app_feedback_game_type_check;
ALTER TABLE game_player_limits DROP CONSTRAINT IF EXISTS game_player_limits_game_type_check;

UPDATE games SET game_type = 'i_call_on' WHERE game_type = 'name_place_animal_thing';
UPDATE app_feedback SET game_type = 'i_call_on' WHERE game_type = 'name_place_animal_thing';

UPDATE game_player_limits
SET game_type = 'i_call_on'
WHERE game_type = 'name_place_animal_thing';

INSERT INTO game_player_limits (game_type, max_players)
VALUES ('i_call_on', 20)
ON CONFLICT (game_type) DO NOTHING;

ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN (
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'never_have_i_ever',
  'pick_a_number',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly',
  'yahtzee',
  'whot',
  'ludo',
  'i_call_on'
));

ALTER TABLE app_feedback ADD CONSTRAINT app_feedback_game_type_check CHECK (game_type IN (
  'general',
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'never_have_i_ever',
  'pick_a_number',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly',
  'yahtzee',
  'whot',
  'ludo',
  'i_call_on'
));

ALTER TABLE game_player_limits ADD CONSTRAINT game_player_limits_game_type_check CHECK (
  game_type IN ('anonymous_messages', 'bingo', 'codewords', 'trivia', 'two_truths', 'monopoly', 'yahtzee', 'whot', 'ludo', 'i_call_on')
);


-- ===== MIGRATION: 070_i_call_on_food_category.sql =====
ALTER TABLE npat_answers ADD COLUMN IF NOT EXISTS food text NOT NULL DEFAULT '';
ALTER TABLE npat_answers ADD COLUMN IF NOT EXISTS score_food integer;

ALTER TABLE npat_marks ADD COLUMN IF NOT EXISTS valid_food boolean NOT NULL DEFAULT true;


-- ===== MIGRATION: 070_tic_tac_toe.sql =====
CREATE TABLE IF NOT EXISTS tic_tac_toe_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL UNIQUE REFERENCES games(id) ON DELETE CASCADE,
  player_x_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player_o_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  board jsonb NOT NULL DEFAULT '[null,null,null,null,null,null,null,null,null]',
  current_turn_mark text NOT NULL DEFAULT 'X' CHECK (current_turn_mark IN ('X', 'O')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished')),
  winner_player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  is_draw boolean NOT NULL DEFAULT false,
  status_message text,
  turn_deadline_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tic_tac_toe_sessions_game_id ON tic_tac_toe_sessions(game_id);

ALTER TABLE tic_tac_toe_sessions ENABLE ROW LEVEL SECURITY;
drop policy if exists "public_tic_tac_toe_sessions" on tic_tac_toe_sessions;
CREATE POLICY "public_tic_tac_toe_sessions" ON tic_tac_toe_sessions FOR ALL USING (true) WITH CHECK (true);

do $$ begin alter publication supabase_realtime add table tic_tac_toe_sessions; exception when duplicate_object then null; end $$;

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_type_check;
ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN (
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'never_have_i_ever',
  'pick_a_number',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly',
  'yahtzee',
  'whot',
  'ludo',
  'i_call_on',
  'sudoku',
  'tic_tac_toe'
));

ALTER TABLE app_feedback DROP CONSTRAINT IF EXISTS app_feedback_game_type_check;
ALTER TABLE app_feedback ADD CONSTRAINT app_feedback_game_type_check CHECK (game_type IN (
  'general',
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'never_have_i_ever',
  'pick_a_number',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly',
  'yahtzee',
  'whot',
  'ludo',
  'i_call_on',
  'sudoku',
  'tic_tac_toe'
));

ALTER TABLE game_player_limits DROP CONSTRAINT IF EXISTS game_player_limits_game_type_check;
ALTER TABLE game_player_limits ADD CONSTRAINT game_player_limits_game_type_check CHECK (
  game_type IN ('anonymous_messages', 'bingo', 'codewords', 'trivia', 'two_truths', 'monopoly', 'yahtzee', 'whot', 'ludo', 'i_call_on', 'sudoku', 'tic_tac_toe')
);

INSERT INTO game_player_limits (game_type, max_players)
VALUES ('tic_tac_toe', 2)
ON CONFLICT (game_type) DO NOTHING;


-- ===== MIGRATION: 071_sudoku.sql =====
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS sudoku_metadata jsonb;

CREATE TABLE IF NOT EXISTS sudoku_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  block_index integer NOT NULL CHECK (block_index >= 0 AND block_index <= 8),
  is_correct boolean NOT NULL,
  points_awarded integer NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(player_id, round_id, block_index)
);

CREATE INDEX IF NOT EXISTS idx_sudoku_submissions_game_id ON sudoku_submissions(game_id);
CREATE INDEX IF NOT EXISTS idx_sudoku_submissions_round_id ON sudoku_submissions(round_id);
CREATE INDEX IF NOT EXISTS idx_sudoku_submissions_player_id ON sudoku_submissions(player_id);

ALTER TABLE sudoku_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_sudoku_submissions" ON sudoku_submissions;
drop policy if exists "public_sudoku_submissions" on sudoku_submissions;
CREATE POLICY "public_sudoku_submissions" ON sudoku_submissions FOR ALL USING (true) WITH CHECK (true);

do $$ begin alter publication supabase_realtime add table sudoku_submissions; exception when duplicate_object then null; end $$;

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_type_check;
ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN (
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'never_have_i_ever',
  'pick_a_number',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly',
  'yahtzee',
  'whot',
  'ludo',
  'i_call_on',
  'sudoku',
  'tic_tac_toe'
));

ALTER TABLE app_feedback DROP CONSTRAINT IF EXISTS app_feedback_game_type_check;
ALTER TABLE app_feedback ADD CONSTRAINT app_feedback_game_type_check CHECK (game_type IN (
  'general',
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'never_have_i_ever',
  'pick_a_number',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly',
  'yahtzee',
  'whot',
  'ludo',
  'i_call_on',
  'sudoku',
  'tic_tac_toe'
));

ALTER TABLE game_player_limits DROP CONSTRAINT IF EXISTS game_player_limits_game_type_check;
ALTER TABLE game_player_limits ADD CONSTRAINT game_player_limits_game_type_check CHECK (
  game_type IN ('anonymous_messages', 'bingo', 'codewords', 'trivia', 'two_truths', 'monopoly', 'yahtzee', 'whot', 'ludo', 'i_call_on', 'sudoku', 'tic_tac_toe')
);

INSERT INTO game_player_limits (game_type, max_players)
VALUES ('sudoku', 20)
ON CONFLICT (game_type) DO NOTHING;


-- ===== MIGRATION: 072_sudoku_allow_retries.sql =====
-- Allow multiple attempts per player per block (wrong answers no longer lock out)
-- Keep the unique constraint only on correct submissions via a partial unique index.
ALTER TABLE sudoku_submissions
  DROP CONSTRAINT IF EXISTS sudoku_submissions_player_id_round_id_block_index_key;

CREATE UNIQUE INDEX IF NOT EXISTS sudoku_submissions_correct_unique
  ON sudoku_submissions (player_id, round_id, block_index)
  WHERE is_correct = true;


-- ===== MIGRATION: 073_question_library.sql =====
CREATE TABLE question_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  game_type TEXT NOT NULL CHECK (game_type IN ('trivia', 'would_you_rather', 'most_likely_to')),
  author_name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  question_count INT NOT NULL DEFAULT 0,
  questions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

ALTER TABLE question_packs ENABLE ROW LEVEL SECURITY;
-- Public can read approved packs and insert new ones; no public update/delete
drop policy if exists "public_read_approved" on question_packs;
CREATE POLICY "public_read_approved" ON question_packs FOR SELECT USING (status = 'approved');
drop policy if exists "public_insert" on question_packs;
CREATE POLICY "public_insert" ON question_packs FOR INSERT WITH CHECK (true);

CREATE INDEX question_packs_status_game_type ON question_packs (status, game_type);


-- ===== MIGRATION: 074_question_library_tags.sql =====
ALTER TABLE question_packs ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX question_packs_tags ON question_packs USING GIN (tags);


-- ===== MIGRATION: 075_room_points.sql =====
-- Room leaderboard points
alter table room_members add column if not exists room_points integer not null default 0;

alter table room_games add column if not exists points_awarded_at timestamptz;

alter table players add column if not exists room_member_id uuid references room_members(id) on delete set null;
create index if not exists idx_players_room_member_id on players(room_member_id) where room_member_id is not null;


-- ===== MIGRATION: 076_room_settings.sql =====
-- Room visibility, description, and timezone
alter table rooms add column if not exists is_public boolean not null default false;
alter table rooms add column if not exists description text;
alter table rooms add column if not exists timezone text;

create index if not exists idx_rooms_public on rooms(is_public, created_at desc) where is_public = true;


-- ===== MIGRATION: 077_room_lock.sql =====
-- Host can lock a room to block new joins and hide from public browse
alter table rooms add column if not exists is_locked boolean not null default false;

drop index if exists idx_rooms_public;
create index if not exists idx_rooms_public on rooms(is_public, created_at desc)
  where is_public = true and is_locked = false;


-- ===== MIGRATION: 078_word_hunt.sql =====
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS word_hunt_metadata jsonb;

CREATE TABLE IF NOT EXISTS word_hunt_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  word text NOT NULL,
  path jsonb NOT NULL,
  points_awarded integer NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(player_id, round_id, word)
);

CREATE INDEX IF NOT EXISTS idx_word_hunt_submissions_game_id ON word_hunt_submissions(game_id);
CREATE INDEX IF NOT EXISTS idx_word_hunt_submissions_round_id ON word_hunt_submissions(round_id);
CREATE INDEX IF NOT EXISTS idx_word_hunt_submissions_player_id ON word_hunt_submissions(player_id);

ALTER TABLE word_hunt_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_word_hunt_submissions" ON word_hunt_submissions;
drop policy if exists "public_word_hunt_submissions" on word_hunt_submissions;
CREATE POLICY "public_word_hunt_submissions" ON word_hunt_submissions FOR ALL USING (true) WITH CHECK (true);

do $$ begin alter publication supabase_realtime add table word_hunt_submissions; exception when duplicate_object then null; end $$;

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_type_check;
ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN (
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'never_have_i_ever',
  'pick_a_number',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly',
  'yahtzee',
  'whot',
  'ludo',
  'i_call_on',
  'sudoku',
  'tic_tac_toe',
  'word_hunt'
));

ALTER TABLE app_feedback DROP CONSTRAINT IF EXISTS app_feedback_game_type_check;
ALTER TABLE app_feedback ADD CONSTRAINT app_feedback_game_type_check CHECK (game_type IN (
  'general',
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'never_have_i_ever',
  'pick_a_number',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly',
  'yahtzee',
  'whot',
  'ludo',
  'i_call_on',
  'sudoku',
  'tic_tac_toe',
  'word_hunt'
));

ALTER TABLE game_player_limits DROP CONSTRAINT IF EXISTS game_player_limits_game_type_check;
ALTER TABLE game_player_limits ADD CONSTRAINT game_player_limits_game_type_check CHECK (
  game_type IN ('anonymous_messages', 'bingo', 'codewords', 'trivia', 'two_truths', 'monopoly', 'yahtzee', 'whot', 'ludo', 'i_call_on', 'sudoku', 'tic_tac_toe', 'word_hunt')
);

INSERT INTO game_player_limits (game_type, max_players)
VALUES ('word_hunt', 20)
ON CONFLICT (game_type) DO NOTHING;


-- ===== MIGRATION: 079_codewords_atomic_guess.sql =====
-- Atomic guess handler for Codewords.
-- Uses FOR UPDATE to lock the board row so concurrent guesses from two operatives
-- cannot both read guesses_remaining=2 and both write guesses_remaining=1.
-- Also ensures revealed_indices is appended atomically (no lost updates).
CREATE OR REPLACE FUNCTION codewords_process_guess(
  p_board_id uuid,
  p_cell_index integer,
  p_player_team text
) RETURNS SETOF codewords_boards
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_board        codewords_boards;
  v_cell_type    text;
  v_revealed     integer[];
  v_other_team   text;
  v_winner       text;
  v_remaining    integer;
  v_red_total    integer;
  v_blue_total   integer;
  v_red_rev      integer;
  v_blue_rev     integer;
  v_deadline     timestamptz;
  v_result       codewords_boards;
BEGIN
  -- Lock the row — any concurrent call blocks here until we commit
  SELECT * INTO v_board FROM codewords_boards WHERE id = p_board_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Board not found';
  END IF;

  -- Guard: already revealed (could happen if two people tap same card)
  IF p_cell_index = ANY(v_board.revealed_indices) THEN
    RAISE EXCEPTION 'ALREADY_REVEALED';
  END IF;

  -- key is text[] — Postgres arrays are 1-indexed; JS sends 0-based index
  v_cell_type  := v_board.key[p_cell_index + 1];
  v_other_team := CASE WHEN p_player_team = 'red' THEN 'blue' ELSE 'red' END;
  v_revealed   := array_append(v_board.revealed_indices, p_cell_index);

  -- ── Assassin ───────────────────────────────────────────────────────────
  IF v_cell_type = 'assassin' THEN
    UPDATE codewords_boards SET
      revealed_indices = v_revealed,
      winner           = v_other_team,
      assassin_team    = p_player_team,
      guesses_remaining = null,
      current_clue_word = null,
      current_clue_number = null,
      turn_phase       = 'clue',
      turn_deadline_at = null
    WHERE id = p_board_id
    RETURNING * INTO v_result;
    RETURN NEXT v_result; RETURN;
  END IF;

  -- ── Check for win ───────────────────────────────────────────────────────
  SELECT
    COUNT(*) FILTER (WHERE k.cell = 'red'),
    COUNT(*) FILTER (WHERE k.cell = 'blue')
  INTO v_red_total, v_blue_total
  FROM unnest(v_board.key) AS k(cell);

  SELECT
    COUNT(*) FILTER (WHERE v_board.key[r.idx + 1] = 'red'),
    COUNT(*) FILTER (WHERE v_board.key[r.idx + 1] = 'blue')
  INTO v_red_rev, v_blue_rev
  FROM unnest(v_revealed) AS r(idx);

  IF    v_red_rev  >= v_red_total  THEN v_winner := 'red';
  ELSIF v_blue_rev >= v_blue_total THEN v_winner := 'blue';
  END IF;

  IF v_winner IS NOT NULL THEN
    UPDATE codewords_boards SET
      revealed_indices  = v_revealed,
      winner            = v_winner,
      guesses_remaining = null,
      current_clue_word = null,
      current_clue_number = null,
      turn_phase        = 'clue',
      turn_deadline_at  = null
    WHERE id = p_board_id
    RETURNING * INTO v_result;
    RETURN NEXT v_result; RETURN;
  END IF;

  -- ── Correct team cell ───────────────────────────────────────────────────
  IF v_cell_type = p_player_team THEN
    v_remaining := v_board.guesses_remaining - 1;

    IF v_remaining > 0 THEN
      UPDATE codewords_boards SET
        revealed_indices  = v_revealed,
        guesses_remaining = v_remaining
      WHERE id = p_board_id
      RETURNING * INTO v_result;
      RETURN NEXT v_result; RETURN;
    END IF;
    -- else fall through to end-turn logic below
  END IF;

  -- ── End turn (wrong cell or used all guesses) ───────────────────────────
  v_deadline := CASE
    WHEN v_board.spymaster_timer_seconds > 0
    THEN now() + (v_board.spymaster_timer_seconds || ' seconds')::interval
    ELSE null
  END;

  UPDATE codewords_boards SET
    revealed_indices    = v_revealed,
    current_turn        = v_other_team,
    current_clue_word   = null,
    current_clue_number = null,
    guesses_remaining   = null,
    turn_phase          = 'clue',
    turn_deadline_at    = v_deadline
  WHERE id = p_board_id
  RETURNING * INTO v_result;
  RETURN NEXT v_result; RETURN;
END;
$$;


-- ===== MIGRATION: 080_ultimate_tic_tac_toe.sql =====
-- Upgrade Tic-Tac-Toe to Ultimate (Super) Tic-Tac-Toe: a 3x3 grid of nine 3x3 boards.
-- The flat `board` now holds 81 cells. `board_winners` tracks the result of each of the
-- 9 sub-boards ('X' | 'O' | 'draw' | null). `active_board` is the sub-board the current
-- player must play in (0-8), or null when they may play anywhere.

ALTER TABLE tic_tac_toe_sessions
  ADD COLUMN IF NOT EXISTS board_winners jsonb NOT NULL
    DEFAULT '[null,null,null,null,null,null,null,null,null]',
  ADD COLUMN IF NOT EXISTS active_board integer;

ALTER TABLE tic_tac_toe_sessions
  ALTER COLUMN board SET DEFAULT
    '[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]';

-- Reset any in-flight classic (9-cell) sessions to the new 81-cell format.
UPDATE tic_tac_toe_sessions
SET board = (SELECT jsonb_agg(NULL::jsonb) FROM generate_series(1, 81)),
    board_winners = '[null,null,null,null,null,null,null,null,null]',
    active_board = NULL
WHERE jsonb_array_length(board) = 9;


-- ===== MIGRATION: 081_chess.sql =====
-- Chess: a 2-player game backed by chess.js. One row per game holds the current
-- position as FEN plus the full move list as PGN.

CREATE TABLE IF NOT EXISTS chess_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL UNIQUE REFERENCES games(id) ON DELETE CASCADE,
  player_white_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player_black_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  fen text NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn text NOT NULL DEFAULT '',
  current_turn text NOT NULL DEFAULT 'w' CHECK (current_turn IN ('w', 'b')),
  last_move_from text,
  last_move_to text,
  in_check boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished')),
  result_reason text,
  winner_player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  is_draw boolean NOT NULL DEFAULT false,
  status_message text,
  turn_deadline_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chess_sessions_game_id ON chess_sessions(game_id);

ALTER TABLE chess_sessions ENABLE ROW LEVEL SECURITY;
drop policy if exists "public_chess_sessions" on chess_sessions;
CREATE POLICY "public_chess_sessions" ON chess_sessions FOR ALL USING (true) WITH CHECK (true);

do $$ begin alter publication supabase_realtime add table chess_sessions; exception when duplicate_object then null; end $$;

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_type_check;
ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN (
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'never_have_i_ever',
  'pick_a_number',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly',
  'yahtzee',
  'whot',
  'ludo',
  'i_call_on',
  'sudoku',
  'tic_tac_toe',
  'word_hunt',
  'chess'
));

ALTER TABLE app_feedback DROP CONSTRAINT IF EXISTS app_feedback_game_type_check;
ALTER TABLE app_feedback ADD CONSTRAINT app_feedback_game_type_check CHECK (game_type IN (
  'general',
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'never_have_i_ever',
  'pick_a_number',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly',
  'yahtzee',
  'whot',
  'ludo',
  'i_call_on',
  'sudoku',
  'tic_tac_toe',
  'word_hunt',
  'chess'
));

ALTER TABLE game_player_limits DROP CONSTRAINT IF EXISTS game_player_limits_game_type_check;
ALTER TABLE game_player_limits ADD CONSTRAINT game_player_limits_game_type_check CHECK (
  game_type IN ('anonymous_messages', 'bingo', 'codewords', 'trivia', 'two_truths', 'monopoly', 'yahtzee', 'whot', 'ludo', 'i_call_on', 'sudoku', 'tic_tac_toe', 'word_hunt', 'chess')
);

INSERT INTO game_player_limits (game_type, max_players)
VALUES ('chess', 2)
ON CONFLICT (game_type) DO NOTHING;


-- ===== MIGRATION: 082_chess_clock.sql =====
-- Cumulative per-player chess clock (chess.com style). Each player has a total
-- time budget that only ticks down on their own turn; first to reach zero loses.
-- NULL time columns mean the game is untimed.

ALTER TABLE chess_sessions
  ADD COLUMN IF NOT EXISTS white_time_ms integer,
  ADD COLUMN IF NOT EXISTS black_time_ms integer,
  -- When the current player's clock started running (set on each move / at start).
  ADD COLUMN IF NOT EXISTS turn_started_at timestamptz;


-- ===== MIGRATION: 083_product_updates_new_games.sql =====
-- What's new: announce the newest game modes — Chess, Word Hunt, Sudoku,
-- Ultimate Tic-Tac-Toe, and I Call On (June 2026).

insert into product_updates (type, title, description, month, year, sort_order)
select v.type, v.title, v.description, v.month, v.year, v.sort_order
from (
  values
    (
      'new',
      'Chess',
      $$Play classic chess head-to-head. Full rules with castling, en passant, and promotion, plus a chess.com-style clock — each player gets their own time bank (3, 5, or 10 minutes) that only ticks on their turn. Checkmate, run your opponent out of time, or take the resignation to win.$$,
      6::smallint,
      2026::smallint,
      240::integer
    ),
    (
      'new',
      'Word Hunt',
      $$A Boggle-style word race. Everyone gets the same 4x4 letter grid — drag or tap to connect adjacent letters (diagonals count!) and spell as many words as you can before the timer runs out. Longer words score more.$$,
      6,
      2026,
      235
    ),
    (
      'new',
      'Sudoku',
      $$Everyone solves the same 9x9 puzzle together. Race to claim 3x3 blocks before your friends — first correct answer scores, wrong guesses lock you out for a bit.$$,
      6,
      2026,
      230
    ),
    (
      'new',
      'Ultimate Tic-Tac-Toe',
      $$Tic-Tac-Toe with a twist: nine small boards in one big grid. The cell you play sends your opponent to the matching board, and you win by taking three small boards in a row. Quick, head-to-head, and surprisingly strategic.$$,
      6,
      2026,
      225
    ),
    (
      'new',
      'I Call On (Name, Animal, Place…)',
      $$The classic A–Z categories game, online. Someone calls a letter and everyone races to fill Name, Animal, Place, Thing, and Food before time runs out. Unique answers score more than duplicates, and everyone marks the sheets together.$$,
      6,
      2026,
      220
    )
) as v(type, title, description, month, year, sort_order)
where not exists (
  select 1 from product_updates pu where pu.title = v.title
);


-- ===== MIGRATION: 084_describe_it.sql =====
-- Describe It: team-based word game. Each round, one team is on the clock; a
-- describer types clues for secret words and teammates type guesses. Correct
-- guesses score a point and reveal the next word. Most words across all rounds wins.

-- How many teams the host configured (2-4). Turn length uses games.timer_seconds,
-- and the number of rounds uses games.rounds_count.
ALTER TABLE games ADD COLUMN IF NOT EXISTS describe_it_num_teams integer NOT NULL DEFAULT 2;

CREATE TABLE IF NOT EXISTS describe_it_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL UNIQUE REFERENCES games(id) ON DELETE CASCADE,
  num_teams integer NOT NULL,
  total_rounds integer NOT NULL,
  turn_seconds integer NOT NULL,
  -- 'turn' = a team is actively playing; 'break' = short gap between turns; 'finished'.
  phase text NOT NULL DEFAULT 'turn' CHECK (phase IN ('turn', 'break', 'finished')),
  -- 0-based index into the full turn order (num_teams * total_rounds turns total).
  turn_index integer NOT NULL DEFAULT 0,
  current_round integer NOT NULL DEFAULT 1,
  active_team integer NOT NULL DEFAULT 1,
  describer_player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  current_word text,
  current_clue text,
  used_words text[] NOT NULL DEFAULT '{}',
  turn_deadline_at timestamptz,
  break_deadline_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished')),
  status_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS describe_it_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(game_id, player_id)
);

-- One row per word the describer presented: scoring + history.
CREATE TABLE IF NOT EXISTS describe_it_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  turn_index integer NOT NULL,
  round integer NOT NULL,
  team integer NOT NULL,
  describer_player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  word text NOT NULL,
  clue text,
  status text NOT NULL CHECK (status IN ('guessed', 'skipped')),
  guesser_player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Live guess feed during a turn.
CREATE TABLE IF NOT EXISTS describe_it_guesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  turn_index integer NOT NULL,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team integer NOT NULL,
  text text NOT NULL,
  correct boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_describe_it_sessions_game_id ON describe_it_sessions(game_id);
CREATE INDEX IF NOT EXISTS idx_describe_it_players_game_id ON describe_it_players(game_id);
CREATE INDEX IF NOT EXISTS idx_describe_it_words_game_id ON describe_it_words(game_id);
CREATE INDEX IF NOT EXISTS idx_describe_it_guesses_game_id ON describe_it_guesses(game_id);

ALTER TABLE describe_it_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE describe_it_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE describe_it_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE describe_it_guesses ENABLE ROW LEVEL SECURITY;
drop policy if exists "public_describe_it_sessions" on describe_it_sessions;
CREATE POLICY "public_describe_it_sessions" ON describe_it_sessions FOR ALL USING (true) WITH CHECK (true);
drop policy if exists "public_describe_it_players" on describe_it_players;
CREATE POLICY "public_describe_it_players" ON describe_it_players FOR ALL USING (true) WITH CHECK (true);
drop policy if exists "public_describe_it_words" on describe_it_words;
CREATE POLICY "public_describe_it_words" ON describe_it_words FOR ALL USING (true) WITH CHECK (true);
drop policy if exists "public_describe_it_guesses" on describe_it_guesses;
CREATE POLICY "public_describe_it_guesses" ON describe_it_guesses FOR ALL USING (true) WITH CHECK (true);

do $$ begin alter publication supabase_realtime add table describe_it_sessions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table describe_it_players; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table describe_it_words; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table describe_it_guesses; exception when duplicate_object then null; end $$;

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_type_check;
ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN (
  'smash_marry_kill', 'red_flag_green_flag', 'smash_or_pass', 'parent_approval',
  'would_you_rather', 'never_have_i_ever', 'pick_a_number', 'this_or_that',
  'most_likely_to', 'who_said_this', 'hot_seat', 'custom', 'anonymous_messages',
  'secret_message', 'bingo', 'codewords', 'trivia', 'two_truths', 'monopoly',
  'yahtzee', 'whot', 'ludo', 'i_call_on', 'sudoku', 'tic_tac_toe', 'word_hunt',
  'chess', 'describe_it'
));

ALTER TABLE app_feedback DROP CONSTRAINT IF EXISTS app_feedback_game_type_check;
ALTER TABLE app_feedback ADD CONSTRAINT app_feedback_game_type_check CHECK (game_type IN (
  'general', 'smash_marry_kill', 'red_flag_green_flag', 'smash_or_pass', 'parent_approval',
  'would_you_rather', 'never_have_i_ever', 'pick_a_number', 'this_or_that',
  'most_likely_to', 'who_said_this', 'hot_seat', 'custom', 'anonymous_messages',
  'secret_message', 'bingo', 'codewords', 'trivia', 'two_truths', 'monopoly',
  'yahtzee', 'whot', 'ludo', 'i_call_on', 'sudoku', 'tic_tac_toe', 'word_hunt',
  'chess', 'describe_it'
));

ALTER TABLE game_player_limits DROP CONSTRAINT IF EXISTS game_player_limits_game_type_check;
ALTER TABLE game_player_limits ADD CONSTRAINT game_player_limits_game_type_check CHECK (
  game_type IN ('anonymous_messages', 'bingo', 'codewords', 'trivia', 'two_truths',
  'monopoly', 'yahtzee', 'whot', 'ludo', 'i_call_on', 'sudoku', 'tic_tac_toe',
  'word_hunt', 'chess', 'describe_it')
);

INSERT INTO game_player_limits (game_type, max_players)
VALUES ('describe_it', 20)
ON CONFLICT (game_type) DO NOTHING;


-- ===== MIGRATION: 085_describe_it_clue_history.sql =====
-- Keep all clues the describer has given for the CURRENT word (reset each word),
-- so the describer can see what they've already said and avoid repeating.
ALTER TABLE describe_it_sessions
  ADD COLUMN IF NOT EXISTS current_clues text[] NOT NULL DEFAULT '{}';


-- ===== MIGRATION: 086_describe_it_guard.sql =====
-- Belt-and-suspenders for Describe It scoring: a given word can be scored at
-- most once per turn, so two simultaneous correct guesses can't double-count it.
-- The app layer also guards this with a conditional update; this is the DB-level
-- backstop. Partial index on guessed rows only (skipped rows are unconstrained).
CREATE UNIQUE INDEX IF NOT EXISTS idx_describe_it_words_guessed_unique
  ON describe_it_words (game_id, turn_index, word)
  WHERE status = 'guessed';


-- ===== MIGRATION: 086_product_updates_text_charades.sql =====
-- What's new: announce Text Charades (June 2026).

insert into product_updates (type, title, description, month, year, sort_order)
select v.type, v.title, v.description, v.month, v.year, v.sort_order
from (
  values
    (
      'new',
      'Text Charades',
      $$A team word race — like Password or Catch Phrase, online. Split into 2–4 teams: each round one team is on the clock while a describer types clues for a secret word (without saying it) and teammates race to type the answer. Every correct guess scores a point and reveals the next word. Most words across all rounds wins.$$,
      6::smallint,
      2026::smallint,
      250::integer
    )
) as v(type, title, description, month, year, sort_order)
where not exists (
  select 1 from product_updates pu where pu.title = v.title
);


-- ===== MIGRATION: 087_scrabble.sql =====
-- Scrabble: a 2–4 player word game on a 15x15 board. One session row holds the
-- shared board, tile bag, and turn order; each player has a private rack + score.

CREATE TABLE IF NOT EXISTS scrabble_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL UNIQUE REFERENCES games(id) ON DELETE CASCADE,
  turn_order uuid[] NOT NULL DEFAULT '{}',
  current_turn_index integer NOT NULL DEFAULT 0,
  board jsonb NOT NULL DEFAULT '[]',
  bag jsonb NOT NULL DEFAULT '[]',
  phase text NOT NULL DEFAULT 'playing' CHECK (phase IN ('playing', 'finished')),
  consecutive_passes integer NOT NULL DEFAULT 0,
  last_move jsonb,
  winner_player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  is_tie boolean NOT NULL DEFAULT false,
  status_message text,
  turn_deadline_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scrabble_sessions_game_id ON scrabble_sessions(game_id);

ALTER TABLE scrabble_sessions ENABLE ROW LEVEL SECURITY;
drop policy if exists "public_scrabble_sessions" on scrabble_sessions;
CREATE POLICY "public_scrabble_sessions" ON scrabble_sessions FOR ALL USING (true) WITH CHECK (true);

do $$ begin alter publication supabase_realtime add table scrabble_sessions; exception when duplicate_object then null; end $$;

CREATE TABLE IF NOT EXISTS scrabble_player_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  rack jsonb NOT NULL DEFAULT '[]',
  score integer NOT NULL DEFAULT 0,
  player_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(game_id, player_id)
);

ALTER TABLE scrabble_player_state ENABLE ROW LEVEL SECURITY;
drop policy if exists "public_scrabble_player_state" on scrabble_player_state;
CREATE POLICY "public_scrabble_player_state" ON scrabble_player_state FOR ALL USING (true) WITH CHECK (true);

do $$ begin alter publication supabase_realtime add table scrabble_player_state; exception when duplicate_object then null; end $$;

-- These DROP/ADD the game_type checks, so the list must include EVERY existing
-- game type (not just scrabble) or it would silently disallow the others.
-- 'describe_it' was added on main in parallel — keep it here too.
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_type_check;
ALTER TABLE games ADD CONSTRAINT games_game_type_check CHECK (game_type IN (
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'never_have_i_ever',
  'pick_a_number',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly',
  'yahtzee',
  'whot',
  'ludo',
  'i_call_on',
  'sudoku',
  'tic_tac_toe',
  'word_hunt',
  'chess',
  'describe_it',
  'scrabble'
));

ALTER TABLE app_feedback DROP CONSTRAINT IF EXISTS app_feedback_game_type_check;
ALTER TABLE app_feedback ADD CONSTRAINT app_feedback_game_type_check CHECK (game_type IN (
  'general',
  'smash_marry_kill',
  'red_flag_green_flag',
  'smash_or_pass',
  'parent_approval',
  'would_you_rather',
  'never_have_i_ever',
  'pick_a_number',
  'this_or_that',
  'most_likely_to',
  'who_said_this',
  'hot_seat',
  'custom',
  'anonymous_messages',
  'secret_message',
  'bingo',
  'codewords',
  'trivia',
  'two_truths',
  'monopoly',
  'yahtzee',
  'whot',
  'ludo',
  'i_call_on',
  'sudoku',
  'tic_tac_toe',
  'word_hunt',
  'chess',
  'describe_it',
  'scrabble'
));

ALTER TABLE game_player_limits DROP CONSTRAINT IF EXISTS game_player_limits_game_type_check;
ALTER TABLE game_player_limits ADD CONSTRAINT game_player_limits_game_type_check CHECK (
  game_type IN ('anonymous_messages', 'bingo', 'codewords', 'trivia', 'two_truths', 'monopoly', 'yahtzee', 'whot', 'ludo', 'i_call_on', 'sudoku', 'tic_tac_toe', 'word_hunt', 'chess', 'describe_it', 'scrabble')
);

INSERT INTO game_player_limits (game_type, max_players)
VALUES ('scrabble', 4)
ON CONFLICT (game_type) DO NOTHING;


-- ===== MIGRATION: 088_scrabble_dictionary.sql =====
-- Per-game Scrabble dictionary selection. Each game can choose which word list
-- validates plays; defaults to the standard ENABLE list.
ALTER TABLE games ADD COLUMN IF NOT EXISTS scrabble_dictionary_id text NOT NULL DEFAULT 'enable';


-- ===== MIGRATION: 089_describe_it_individual_mode.sql =====
-- Individual (skribbl-style) mode for Text Charades, alongside the existing team mode.
-- In individual mode there are no teams: players take turns describing one word while
-- everyone else races to guess it. Guessers score by speed; the describer scores per
-- correct guesser. A per-player leaderboard replaces the team scoreboard.

-- Host-chosen mode for the game.
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS describe_it_mode text NOT NULL DEFAULT 'team'
  CHECK (describe_it_mode IN ('team', 'individual'));

-- Snapshot the mode + the locked describer rotation onto the session at game start.
-- `roster` is the ordered list of player ids that take turns describing (individual mode).
ALTER TABLE describe_it_sessions
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'team'
  CHECK (mode IN ('team', 'individual'));
ALTER TABLE describe_it_sessions
  ADD COLUMN IF NOT EXISTS roster uuid[] NOT NULL DEFAULT '{}';

-- Per-player running score (individual mode) and per-guess points (for UI feedback).
ALTER TABLE describe_it_players
  ADD COLUMN IF NOT EXISTS score integer NOT NULL DEFAULT 0;
ALTER TABLE describe_it_guesses
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0;

-- One *scored* correct guess per player per turn — guards against a double-award if a
-- player double-submits. Scoped to points > 0 so it only governs individual mode:
-- team-mode correct guesses store points = 0 (a player can correctly guess several words
-- in one turn there), so they are excluded and never collide.
CREATE UNIQUE INDEX IF NOT EXISTS idx_describe_it_guesses_scored_unique
  ON describe_it_guesses (game_id, turn_index, player_id)
  WHERE correct AND points > 0;

-- Atomic per-player score increment — avoids lost updates when many players score at once.
CREATE OR REPLACE FUNCTION describe_it_add_score(
  p_game_id text,
  p_player_id uuid,
  p_delta integer
) RETURNS void
LANGUAGE sql
AS $$
  UPDATE describe_it_players
  SET score = score + p_delta
  WHERE game_id = p_game_id AND player_id = p_player_id;
$$;


-- ===== MIGRATION: 090_whot_pick2_stacking.sql =====
-- Whot: host chooses whether a Pick 2 (card number 2) may be stacked / defended.
--   true  (default) = current behaviour — the targeted player can play their own 2
--                     to pass an accumulating penalty along (next player draws 4, etc.).
--   false           = no defending — the targeted player cannot play a 2; they must
--                     draw the 2-card penalty.
ALTER TABLE games ADD COLUMN IF NOT EXISTS whot_pick2_stacking boolean NOT NULL DEFAULT true;


-- ===== MIGRATION: 091_describe_it_atomic_score.sql =====
-- Text Charades (individual mode): record a correct guess AND credit its points in a
-- single atomic call, instead of an INSERT followed by a separate score RPC.
--
-- The old two-step had a gap: if the process died between inserting the scored guess
-- row and incrementing the player's score, the point was lost forever — the partial
-- unique index (idx_describe_it_guesses_scored_unique) then blocked any retry from
-- re-scoring. Folding both into one function closes that gap and stays idempotent:
-- a re-submit hits ON CONFLICT, inserts nothing, scores nothing, and returns false.
CREATE OR REPLACE FUNCTION describe_it_record_correct_guess(
  p_game_id text,
  p_turn_index integer,
  p_player_id uuid,
  p_text text,
  p_points integer
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows integer;
BEGIN
  -- Conflict target matches the partial unique index (game_id, turn_index, player_id)
  -- WHERE correct AND points > 0, so a second scored guess for this player/turn no-ops.
  INSERT INTO describe_it_guesses (game_id, turn_index, player_id, team, text, correct, points)
  VALUES (p_game_id, p_turn_index, p_player_id, 0, p_text, true, p_points)
  ON CONFLICT (game_id, turn_index, player_id) WHERE correct AND points > 0
  DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN false; -- already scored this turn — no double-award
  END IF;

  UPDATE describe_it_players
  SET score = score + p_points
  WHERE game_id = p_game_id AND player_id = p_player_id;

  RETURN true;
END;
$$;

