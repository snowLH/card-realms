-- The shared action-dungeon is tuned for four simultaneous Legends.  Keep old
-- finished records readable while preventing any new lobby from allocating a
-- fifth seat.
update public.raid_events
set max_players = least(max_players, 4)
where max_players > 4;

alter table public.raid_events
  alter column max_players set default 4;

alter table public.raid_events
  drop constraint if exists raid_events_max_players_check;

alter table public.raid_events
  add constraint raid_events_max_players_check
  check (max_players between 2 and 4 and max_players >= min_players);

-- The lightweight shared-map lobby uses the same physical-room limit.
update public.map_sessions
set max_players = least(max_players, 4)
where max_players > 4;

alter table public.map_sessions
  alter column max_players set default 4;

alter table public.map_sessions
  drop constraint if exists map_sessions_max_players_check;

alter table public.map_sessions
  add constraint map_sessions_max_players_check
  check (max_players between 2 and 4);
