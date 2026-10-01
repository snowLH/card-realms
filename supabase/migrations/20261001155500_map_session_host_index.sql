-- Cover the cooperative map session host foreign key for lookups and cascades.
create index if not exists map_sessions_host_idx
  on public.map_sessions (host_id);
