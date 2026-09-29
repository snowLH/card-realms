-- Covers the FK used when an area is disabled or removed.
create index player_world_state_current_area_idx
  on public.player_world_state (current_area_id)
  where current_area_id is not null;
