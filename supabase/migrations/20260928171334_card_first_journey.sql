-- Card-first onboarding and server-authoritative collection rewards.
-- Existing players keep their collection. New players choose one of three starters.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    'viajante_' || substr(replace(new.id::text, '-', ''), 1, 10),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      'Novo Viajante'
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  );

  insert into public.houses (user_id)
  values (new.id);

  insert into public.teams (user_id, name, is_active)
  values (new.id, 'Equipe principal', true);

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
grant execute on function private.handle_new_user() to service_role;

create or replace function private.add_creature_to_active_team(
  target_player_id uuid,
  target_creature_instance_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_team_id uuid;
  target_slot smallint;
begin
  select id into target_team_id
  from public.teams
  where user_id = target_player_id and is_active
  order by created_at
  limit 1
  for update;

  if target_team_id is null then
    return false;
  end if;

  select slots.slot::smallint into target_slot
  from generate_series(1, 6) as slots(slot)
  where not exists (
    select 1 from public.team_members members
    where members.team_id = target_team_id and members.slot = slots.slot
  )
  order by slots.slot
  limit 1;

  if target_slot is null then
    return false;
  end if;

  insert into public.team_members (team_id, slot, player_creature_id)
  values (target_team_id, target_slot, target_creature_instance_id);
  return true;
end;
$$;

revoke all on function private.add_creature_to_active_team(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.add_creature_to_active_team(uuid, uuid)
  to service_role;

create or replace function private.choose_starter_card(target_creature_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  active_team_id uuid;
  creature_instance_id uuid;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  if target_creature_id <> all(array['boitata', 'iara', 'curupira']::text[]) then
    raise exception 'Carta inicial inválida' using errcode = '22023';
  end if;

  perform 1 from public.profiles where id = player_id for update;
  if not found then
    raise exception 'Perfil do jogador não encontrado' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.player_creatures where user_id = player_id
  ) then
    raise exception 'A carta inicial já foi escolhida' using errcode = '23505';
  end if;

  select id into active_team_id
  from public.teams
  where user_id = player_id and is_active
  order by created_at
  limit 1
  for update;

  if active_team_id is null then
    insert into public.teams (user_id, name, is_active)
    values (player_id, 'Equipe principal', true)
    returning id into active_team_id;
  end if;

  insert into public.player_creatures (
    user_id, creature_id, acquired_from, bond
  )
  values (
    player_id, target_creature_id, 'starter-choice', 10
  )
  returning id into creature_instance_id;

  insert into public.team_members (team_id, slot, player_creature_id)
  values (active_team_id, 1, creature_instance_id);

  insert into public.reward_ledger (user_id, source_type, source_id, reward)
  values (
    player_id,
    'starter_choice',
    'first-card',
    jsonb_build_object('creatureId', target_creature_id)
  );

  return jsonb_build_object(
    'catalogId', target_creature_id,
    'playerCreatureId', creature_instance_id,
    'teamId', active_team_id
  );
end;
$$;

revoke all on function private.choose_starter_card(text) from public, anon;
grant execute on function private.choose_starter_card(text) to authenticated, service_role;

create or replace function public.choose_starter_card(target_creature_id text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.choose_starter_card(target_creature_id);
$$;

revoke all on function public.choose_starter_card(text) from public, anon;
grant execute on function public.choose_starter_card(text) to authenticated, service_role;

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
  reward_creature_id text;
  reward_creature_instance_id uuid;
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

  select catalog.id into reward_creature_id
  from public.creature_catalog catalog
  where catalog.enabled
    and catalog.region_id = target_region_id
    and not exists (
      select 1
      from public.player_creatures owned
      where owned.user_id = player_id and owned.creature_id = catalog.id
    )
  order by md5(target_region_id || ':' || catalog.id)
  limit 1;

  if reward_creature_id is not null then
    insert into public.player_creatures (
      user_id, creature_id, acquired_from, bond
    )
    values (
      player_id, reward_creature_id, 'region-treasure:' || target_region_id, 3
    )
    returning id into reward_creature_instance_id;

    perform private.add_creature_to_active_team(player_id, reward_creature_instance_id);
  end if;

  insert into public.reward_ledger (user_id, source_type, source_id, reward)
  values (
    player_id,
    'region_treasure',
    target_region_id,
    jsonb_strip_nulls(jsonb_build_object(
      'coins', 45,
      'item', 'bond-fragment',
      'quantity', 1,
      'creatureId', reward_creature_id
    ))
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

  return jsonb_strip_nulls(jsonb_build_object(
    'coins', current_coins,
    'openedTreasures', to_jsonb(array_append(opened, target_region_id)),
    'creatureId', reward_creature_id,
    'playerCreatureId', reward_creature_instance_id
  ));
end;
$$;

revoke all on function private.claim_region_treasure(text) from public, anon;
grant execute on function private.claim_region_treasure(text) to authenticated, service_role;

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
  current_region text;
  reward_creature_id text;
  reward_creature_instance_id uuid;
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

  select current_region_id into current_region
  from public.player_world_state
  where user_id = target_player_id;

  select catalog.id into reward_creature_id
  from public.creature_catalog catalog
  where catalog.enabled
    and (
      catalog.region_id = current_region
      or not exists (
        select 1
        from public.creature_catalog local_catalog
        where local_catalog.enabled
          and local_catalog.region_id = current_region
          and not exists (
            select 1 from public.player_creatures owned_local
            where owned_local.user_id = target_player_id
              and owned_local.creature_id = local_catalog.id
          )
      )
    )
    and not exists (
      select 1
      from public.player_creatures owned
      where owned.user_id = target_player_id
        and owned.creature_id = catalog.id
    )
  order by
    case when catalog.region_id = current_region then 0 else 1 end,
    md5(target_battle_id::text || ':' || catalog.id)
  limit 1;

  if reward_creature_id is not null then
    insert into public.player_creatures (
      user_id, creature_id, acquired_from, bond
    )
    values (
      target_player_id,
      reward_creature_id,
      'story-battle:' || target_battle_id::text,
      5
    )
    returning id into reward_creature_instance_id;

    perform private.add_creature_to_active_team(
      target_player_id,
      reward_creature_instance_id
    );
  end if;

  reward := jsonb_strip_nulls(jsonb_build_object(
    'coins', 120,
    'xp', 80,
    'creatureId', reward_creature_id,
    'playerCreatureId', reward_creature_instance_id
  ));

  insert into public.reward_ledger (user_id, source_type, source_id, reward)
  values (
    target_player_id,
    'story_battle',
    target_battle_id::text,
    reward
  );

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

create or replace function public.claim_story_battle_reward(
  target_player_id uuid,
  target_battle_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.claim_story_battle_reward(target_player_id, target_battle_id);
$$;

revoke all on function public.claim_story_battle_reward(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_story_battle_reward(uuid, uuid)
  to service_role;


