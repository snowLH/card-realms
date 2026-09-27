-- Online player progression boundary.
-- Authenticated progress is owned by Postgres; browser storage is only a cache.

create table public.region_connections (
  from_region_id text not null references public.regions(id) on delete cascade,
  to_region_id text not null references public.regions(id) on delete cascade,
  primary key (from_region_id, to_region_id),
  check (from_region_id <> to_region_id)
);

insert into public.region_connections (from_region_id, to_region_id) values
  ('roots', 'archipelago'), ('archipelago', 'roots'),
  ('roots', 'runic'), ('runic', 'roots'),
  ('roots', 'mist'), ('mist', 'roots'),
  ('archipelago', 'deep-sea'), ('deep-sea', 'archipelago'),
  ('mist', 'desert'), ('desert', 'mist'),
  ('deep-sea', 'desert'), ('desert', 'deep-sea'),
  ('runic', 'eclipse'), ('eclipse', 'runic'),
  ('desert', 'eclipse'), ('eclipse', 'desert');

create table public.player_world_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  current_region_id text not null references public.regions(id),
  unlocked_region_ids text[] not null default array['roots']::text[],
  opened_treasures text[] not null default '{}'::text[],
  updated_at timestamptz not null default now(),
  check (cardinality(unlocked_region_ids) between 1 and 100),
  check (current_region_id = any(unlocked_region_ids))
);

create table public.player_energy_inventory (
  user_id uuid not null references public.profiles(id) on delete cascade,
  element public.card_element not null,
  quantity integer not null default 0 check (quantity between 0 and 9999),
  updated_at timestamptz not null default now(),
  primary key (user_id, element)
);

create table public.inventory_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_key text not null check (item_key ~ '^[a-z0-9][a-z0-9_-]{1,79}$'),
  quantity integer not null default 0 check (quantity between 0 and 9999),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_key)
);

create table public.achievements (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{1,79}$'),
  title text not null check (char_length(title) between 1 and 80),
  description text not null,
  icon_key text not null,
  criteria jsonb not null check (jsonb_typeof(criteria) = 'object'),
  reward jsonb not null default '{}'::jsonb check (jsonb_typeof(reward) = 'object'),
  enabled boolean not null default true
);

create table public.player_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null references public.achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  claimed_at timestamptz,
  primary key (user_id, achievement_id)
);

create table public.battle_results (
  battle_id uuid not null references public.battles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  opponent_id uuid references public.profiles(id) on delete set null,
  mode public.battle_mode not null,
  outcome text not null check (outcome in ('victory', 'defeat', 'draw', 'abandoned')),
  coins_awarded integer not null default 0 check (coins_awarded >= 0),
  xp_awarded integer not null default 0 check (xp_awarded >= 0),
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  finished_at timestamptz not null default now(),
  primary key (battle_id, user_id)
);

create index battle_results_user_finished_idx
on public.battle_results (user_id, finished_at desc);

insert into public.achievements (id, title, description, icon_key, criteria, reward) values
  ('first-bond', 'Primeiro vínculo', 'Adquira sua primeira criatura.', 'bond', '{"type":"collection_size","count":1}', '{"coins":25}'),
  ('six-paths', 'Seis caminhos', 'Forme uma equipe válida com seis criaturas.', 'team', '{"type":"valid_team","count":1}', '{"coins":50}'),
  ('roots-sanctuary', 'Símbolo das Raízes', 'Conclua o Santuário de Provação das Raízes.', 'sanctuary', '{"type":"sanctuary","region":"roots"}', '{"coins":120}');

alter table public.player_world_state enable row level security;
alter table public.player_energy_inventory enable row level security;
alter table public.inventory_items enable row level security;
alter table public.achievements enable row level security;
alter table public.player_achievements enable row level security;
alter table public.battle_results enable row level security;
alter table public.region_connections enable row level security;

create policy "connections are readable" on public.region_connections
for select to anon, authenticated using (true);
create policy "achievements are readable" on public.achievements
for select to anon, authenticated using (enabled);

create policy "players read own world state" on public.player_world_state
for select to authenticated using ((select auth.uid()) = user_id);
create policy "players read own energy" on public.player_energy_inventory
for select to authenticated using ((select auth.uid()) = user_id);
create policy "players read own inventory" on public.inventory_items
for select to authenticated using ((select auth.uid()) = user_id);
create policy "players read own achievements" on public.player_achievements
for select to authenticated using ((select auth.uid()) = user_id);
create policy "players read own battle results" on public.battle_results
for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.region_connections, public.player_world_state,
  public.player_energy_inventory, public.inventory_items, public.achievements,
  public.player_achievements, public.battle_results from anon, authenticated;

grant select on public.region_connections, public.achievements to anon, authenticated;
grant select on public.player_world_state, public.player_energy_inventory,
  public.inventory_items, public.player_achievements, public.battle_results
to authenticated;

create trigger player_world_state_set_updated_at
before update on public.player_world_state
for each row execute function public.set_updated_at();

create trigger player_energy_inventory_set_updated_at
before update on public.player_energy_inventory
for each row execute function public.set_updated_at();

create trigger inventory_items_set_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();

create or replace function private.initialize_player_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.player_world_state (
    user_id, current_region_id, unlocked_region_ids
  ) values (
    new.id, 'roots', array['roots','archipelago','runic']::text[]
  ) on conflict (user_id) do nothing;

  insert into public.player_energy_inventory (user_id, element, quantity)
  select new.id, element, 12
  from unnest(enum_range(null::public.card_element)) as element
  on conflict (user_id, element) do nothing;

  insert into public.exploration_progress (user_id, region_id)
  values (new.id, 'roots')
  on conflict (user_id, region_id) do nothing;

  insert into public.player_missions (user_id, mission_id)
  select new.id, id from public.missions where enabled
  on conflict (user_id, mission_id) do nothing;

  return new;
end;
$$;

revoke all on function private.initialize_player_progress() from public, anon, authenticated;
grant execute on function private.initialize_player_progress() to service_role;

create trigger initialize_player_progress_after_profile
after insert on public.profiles
for each row execute function private.initialize_player_progress();

insert into public.player_world_state (user_id, current_region_id, unlocked_region_ids)
select id, 'roots', array['roots','archipelago','runic']::text[]
from public.profiles
on conflict (user_id) do nothing;

insert into public.player_energy_inventory (user_id, element, quantity)
select profiles.id, elements.element, 12
from public.profiles
cross join unnest(enum_range(null::public.card_element)) as elements(element)
on conflict (user_id, element) do nothing;

insert into public.exploration_progress (user_id, region_id)
select id, 'roots' from public.profiles
on conflict (user_id, region_id) do nothing;

insert into public.player_missions (user_id, mission_id)
select profiles.id, missions.id
from public.profiles
cross join public.missions
where missions.enabled
on conflict (user_id, mission_id) do nothing;

create or replace function private.get_player_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  snapshot jsonb;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'version', 1,
    'profile', jsonb_build_object(
      'id', profiles.id,
      'username', profiles.username,
      'displayName', profiles.display_name,
      'avatarUrl', profiles.avatar_url,
      'level', profiles.level,
      'xp', profiles.xp,
      'coins', profiles.coins,
      'gems', profiles.gems,
      'equippedTitle', profiles.equipped_title
    ),
    'world', coalesce((
      select jsonb_build_object(
        'currentRegionId', world.current_region_id,
        'unlockedRegionIds', to_jsonb(world.unlocked_region_ids),
        'openedTreasures', to_jsonb(world.opened_treasures)
      )
      from public.player_world_state world
      where world.user_id = player_id
    ), '{}'::jsonb),
    'collection', coalesce((
      select jsonb_agg(jsonb_build_object(
        'instanceId', owned.id,
        'catalogId', owned.creature_id,
        'nickname', owned.nickname,
        'level', owned.level,
        'xp', owned.xp,
        'bond', owned.bond,
        'variant', owned.variant,
        'acquiredFrom', owned.acquired_from,
        'acquiredAt', owned.acquired_at
      ) order by owned.acquired_at)
      from public.player_creatures owned
      where owned.user_id = player_id
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', teams.id,
        'name', teams.name,
        'isActive', teams.is_active,
        'members', coalesce((
          select jsonb_agg(jsonb_build_object(
            'slot', members.slot,
            'playerCreatureId', members.player_creature_id,
            'catalogId', owned.creature_id
          ) order by members.slot)
          from public.team_members members
          join public.player_creatures owned on owned.id = members.player_creature_id
          where members.team_id = teams.id
        ), '[]'::jsonb)
      ) order by teams.created_at)
      from public.teams
      where teams.user_id = player_id
    ), '[]'::jsonb),
    'energy', coalesce((
      select jsonb_object_agg(energy.element::text, energy.quantity)
      from public.player_energy_inventory energy
      where energy.user_id = player_id
    ), '{}'::jsonb),
    'inventory', coalesce((
      select jsonb_agg(jsonb_build_object(
        'itemKey', items.item_key,
        'quantity', items.quantity,
        'metadata', items.metadata
      ) order by items.item_key)
      from public.inventory_items items
      where items.user_id = player_id
    ), '[]'::jsonb),
    'exploration', coalesce((
      select jsonb_agg(jsonb_build_object(
        'regionId', exploration.region_id,
        'creaturesDiscovered', exploration.creatures_discovered,
        'treasuresFound', exploration.treasures_found,
        'sanctuaryCompleted', exploration.sanctuary_completed,
        'guardianDefeated', exploration.guardian_defeated,
        'lastVisitedAt', exploration.last_visited_at
      ) order by exploration.region_id)
      from public.exploration_progress exploration
      where exploration.user_id = player_id
    ), '[]'::jsonb),
    'missions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', missions.id,
        'title', missions.title,
        'description', missions.description,
        'progress', player_missions.progress,
        'completedAt', player_missions.completed_at,
        'claimedAt', player_missions.claimed_at,
        'rewards', missions.rewards
      ) order by missions.id)
      from public.player_missions
      join public.missions on missions.id = player_missions.mission_id
      where player_missions.user_id = player_id
    ), '[]'::jsonb),
    'achievements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', achievements.id,
        'title', achievements.title,
        'description', achievements.description,
        'unlockedAt', player_achievements.unlocked_at,
        'claimedAt', player_achievements.claimed_at
      ) order by player_achievements.unlocked_at desc)
      from public.player_achievements
      join public.achievements on achievements.id = player_achievements.achievement_id
      where player_achievements.user_id = player_id
    ), '[]'::jsonb),
    'house', coalesce((
      select jsonb_build_object(
        'id', houses.id,
        'name', houses.name,
        'theme', houses.theme,
        'isPublic', houses.is_public,
        'layout', houses.layout,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', house_items.id,
            'itemKey', house_items.item_key,
            'position', house_items.position,
            'rotation', house_items.rotation
          ) order by house_items.placed_at)
          from public.house_items
          where house_items.house_id = houses.id
        ), '[]'::jsonb)
      )
      from public.houses
      where houses.user_id = player_id
    ), 'null'::jsonb),
    'battleHistory', coalesce((
      select jsonb_agg(history.entry order by history.finished_at desc)
      from (
        select jsonb_build_object(
          'battleId', results.battle_id,
          'opponentId', results.opponent_id,
          'mode', results.mode,
          'outcome', results.outcome,
          'coinsAwarded', results.coins_awarded,
          'xpAwarded', results.xp_awarded,
          'summary', results.summary,
          'finishedAt', results.finished_at
        ) as entry, results.finished_at
        from public.battle_results results
        where results.user_id = player_id
        order by results.finished_at desc
        limit 50
      ) history
    ), '[]'::jsonb)
  ) into snapshot
  from public.profiles
  where profiles.id = player_id;

  if snapshot is null then
    raise exception 'Perfil do jogador não encontrado' using errcode = 'P0002';
  end if;

  return snapshot;
end;
$$;

revoke all on function private.get_player_snapshot() from public, anon;
grant execute on function private.get_player_snapshot() to authenticated, service_role;

create or replace function public.get_my_player_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_player_snapshot();
$$;

revoke all on function public.get_my_player_snapshot() from public, anon;
grant execute on function public.get_my_player_snapshot() to authenticated, service_role;

create or replace function private.travel_to_region(target_region_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  current_region text;
  unlocked text[];
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  select current_region_id, unlocked_region_ids
  into current_region, unlocked
  from public.player_world_state
  where user_id = player_id
  for update;

  if current_region is null then
    raise exception 'Estado de mundo não encontrado' using errcode = 'P0002';
  end if;
  if not target_region_id = any(unlocked) then
    raise exception 'Região ainda bloqueada' using errcode = '22023';
  end if;
  if target_region_id <> current_region and not exists (
    select 1 from public.region_connections
    where from_region_id = current_region and to_region_id = target_region_id
  ) then
    raise exception 'A região não é adjacente à posição atual' using errcode = '22023';
  end if;

  update public.player_world_state
  set current_region_id = target_region_id
  where user_id = player_id;

  insert into public.exploration_progress (user_id, region_id, last_visited_at)
  values (player_id, target_region_id, now())
  on conflict (user_id, region_id) do update
  set last_visited_at = excluded.last_visited_at;

  return jsonb_build_object('currentRegionId', target_region_id);
end;
$$;

revoke all on function private.travel_to_region(text) from public, anon;
grant execute on function private.travel_to_region(text) to authenticated, service_role;

create or replace function public.travel_to_region(target_region_id text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.travel_to_region(target_region_id);
$$;

revoke all on function public.travel_to_region(text) from public, anon;
grant execute on function public.travel_to_region(text) to authenticated, service_role;

create or replace function private.activate_team(target_team_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  member_count integer;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  select count(*) into member_count
  from public.teams
  join public.team_members on team_members.team_id = teams.id
  where teams.id = target_team_id and teams.user_id = player_id;

  if member_count <> 6 then
    raise exception 'A equipe ativa precisa conter exatamente seis criaturas' using errcode = '22023';
  end if;

  update public.teams set is_active = false where user_id = player_id and is_active;
  update public.teams set is_active = true where id = target_team_id and user_id = player_id;

  if not found then
    raise exception 'Equipe não encontrada' using errcode = 'P0002';
  end if;

  return jsonb_build_object('activeTeamId', target_team_id);
end;
$$;

revoke all on function private.activate_team(uuid) from public, anon;
grant execute on function private.activate_team(uuid) to authenticated, service_role;

create or replace function public.activate_team(target_team_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.activate_team(target_team_id);
$$;

revoke all on function public.activate_team(uuid) from public, anon;
grant execute on function public.activate_team(uuid) to authenticated, service_role;

create or replace function private.claim_region_treasure(target_region_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  current_region text;
  opened text[];
  current_coins bigint;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  select current_region_id, opened_treasures
  into current_region, opened
  from public.player_world_state
  where user_id = player_id
  for update;

  if current_region <> target_region_id then
    raise exception 'Viaje até a região antes de recolher o tesouro' using errcode = '22023';
  end if;
  if target_region_id = any(opened) then
    raise exception 'Tesouro já recolhido' using errcode = '23505';
  end if;

  insert into public.reward_ledger (user_id, source_type, source_id, reward)
  values (
    player_id,
    'region_treasure',
    target_region_id,
    jsonb_build_object('coins', 45, 'item', 'bond-fragment', 'quantity', 1)
  );

  update public.player_world_state
  set opened_treasures = array_append(opened_treasures, target_region_id)
  where user_id = player_id;

  insert into public.exploration_progress (user_id, region_id, treasures_found, last_visited_at)
  values (player_id, target_region_id, 1, now())
  on conflict (user_id, region_id) do update
  set treasures_found = public.exploration_progress.treasures_found + 1,
      last_visited_at = excluded.last_visited_at;

  insert into public.inventory_items (user_id, item_key, quantity)
  values (player_id, 'bond-fragment', 1)
  on conflict (user_id, item_key) do update
  set quantity = public.inventory_items.quantity + 1;

  update public.profiles
  set coins = coins + 45
  where id = player_id
  returning coins into current_coins;

  return jsonb_build_object(
    'coins', current_coins,
    'openedTreasures', to_jsonb(array_append(opened, target_region_id))
  );
end;
$$;

revoke all on function private.claim_region_treasure(text) from public, anon;
grant execute on function private.claim_region_treasure(text) to authenticated, service_role;

create or replace function public.claim_region_treasure(target_region_id text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.claim_region_treasure(target_region_id);
$$;

revoke all on function public.claim_region_treasure(text) from public, anon;
grant execute on function public.claim_region_treasure(text) to authenticated, service_role;

grant all privileges on public.region_connections, public.player_world_state,
  public.player_energy_inventory, public.inventory_items, public.achievements,
  public.player_achievements, public.battle_results to service_role;
