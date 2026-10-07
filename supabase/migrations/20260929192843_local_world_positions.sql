-- Independent local-world exploration. Exact tile positions are player-owned,
-- bounded by the 40x25 navigation grid, and saved through a narrow RPC.

alter table public.player_world_state
  add column map_positions jsonb not null default '{}'::jsonb,
  add constraint player_world_map_positions_object
    check (jsonb_typeof(map_positions) = 'object');
create or replace function private.save_world_position(
  target_region_id text,
  target_x integer,
  target_y integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  current_region text;
  positions jsonb;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;
  if target_x not between 0 and 39 or target_y not between 0 and 24 then
    raise exception 'Posição fora do mapa local' using errcode = '22023';
  end if;

  select current_region_id
  into current_region
  from public.player_world_state
  where user_id = player_id
  for update;

  if current_region is null then
    raise exception 'Estado de mundo não encontrado' using errcode = 'P0002';
  end if;
  if current_region <> target_region_id then
    raise exception 'A posição deve pertencer à região atual' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.region_areas
    where region_id = target_region_id and enabled
  ) then
    raise exception 'Mapa local indisponível' using errcode = 'P0002';
  end if;

  update public.player_world_state
  set map_positions = jsonb_set(
    map_positions,
    array[target_region_id],
    jsonb_build_object('x', target_x, 'y', target_y),
    true
  )
  where user_id = player_id
  returning map_positions into positions;

  return jsonb_build_object(
    'regionId', target_region_id,
    'position', positions -> target_region_id
  );
end;
$$;
revoke all on function private.save_world_position(text, integer, integer)
  from public, anon;
grant execute on function private.save_world_position(text, integer, integer)
  to authenticated, service_role;
create or replace function public.save_world_position(
  target_region_id text,
  target_x integer,
  target_y integer
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.save_world_position(target_region_id, target_x, target_y);
$$;
revoke all on function public.save_world_position(text, integer, integer)
  from public, anon;
grant execute on function public.save_world_position(text, integer, integer)
  to authenticated, service_role;
-- Ordinary victories now award progression only. Creature cards remain
-- exclusive to starters, physical regional chests and future special rewards.
create or replace function private.claim_story_battle_reward(
  target_player_id uuid,
  target_battle_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_reward jsonb;
  reward jsonb;
begin
  if target_player_id is null or target_battle_id is null then
    raise exception 'Jogador e batalha são obrigatórios' using errcode = '22023';
  end if;

  perform 1
  from public.profiles
  where id = target_player_id
  for update;

  if not found then
    raise exception 'Perfil do jogador não encontrado' using errcode = 'P0002';
  end if;

  select ledger.reward into existing_reward
  from public.reward_ledger ledger
  where ledger.user_id = target_player_id
    and ledger.source_type = 'story_battle'
    and ledger.source_id = target_battle_id::text;

  if existing_reward is not null then
    return existing_reward || jsonb_build_object('replayed', true);
  end if;

  reward := jsonb_build_object('coins', 120, 'xp', 80);

  insert into public.reward_ledger (user_id, source_type, source_id, reward)
  values (target_player_id, 'story_battle', target_battle_id::text, reward);

  update public.profiles
  set coins = coins + 120,
      xp = xp + 80
  where id = target_player_id;

  return reward || jsonb_build_object('replayed', false);
end;
$$;
revoke all on function private.claim_story_battle_reward(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.claim_story_battle_reward(uuid, uuid)
  to service_role;
