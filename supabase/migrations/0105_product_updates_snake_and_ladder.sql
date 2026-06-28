-- What's new: announce Snake & Ladder (June 2026).

insert into product_updates (type, title, description, month, year, sort_order)
select v.type, v.title, v.description, v.month, v.year, v.sort_order
from (
  values
    (
      'new',
      'Snake & Ladder',
      $$The board-game classic, online. 2–6 players roll a single die to race up the 1–100 board — climb the ladders, slide down the snakes, and roll a 6 to go again. First to land exactly on square 100 wins, and an optional per-turn timer keeps everyone moving.$$,
      6::smallint,
      2026::smallint,
      255::integer
    )
) as v(type, title, description, month, year, sort_order)
where not exists (
  select 1 from product_updates pu where pu.title = v.title
);
