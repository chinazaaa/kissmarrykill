-- Community leaderboard: allow MULTIPLE winners per game per day.
--
-- Community games are played throughout the day (several rounds), so a single
-- game can crown more than one winner on the same date. The original schema
-- enforced one winner per game per day via `unique (game_id, result_date)` and
-- the manager UI overwrote the previous winner on each entry.
--
-- Relax that: a game/day can hold many winners, but the same player is only
-- listed once per game per day (re-adding the same name is a no-op). We swap the
-- unique key from (game_id, result_date) to (game_id, result_date, player_id).

alter table community_results drop constraint if exists community_results_game_id_result_date_key;

-- Guard against double-counting the same player for the same game on the same day.
alter table community_results
  add constraint community_results_game_date_player_key unique (game_id, result_date, player_id);
