-- Progression fix: energy belongs to the account and is granted by starter/discovery.
-- New profiles begin with zero energy. Choosing a starter grants 12 energy cards
-- matching that starter's element. A conservative repair fixes only obviously
-- affected fresh accounts created under the old "12 of every element" default.

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
  select new.id, element, 0
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
  starter_element public.card_element;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  if target_creature_id <> all(array['boitata', 'iara', 'curupira']::text[]) then
    raise exception 'Carta inicial inválida' using errcode = '22023';
  end if;

  select element into starter_element
  from public.creature_catalog
  where id = target_creature_id and enabled;

  if starter_element is null then
    raise exception 'Carta inicial não está disponível no catálogo' using errcode = 'P0002';
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

  insert into public.player_energy_inventory (user_id, element, quantity)
  values (player_id, starter_element, 12)
  on conflict (user_id, element) do update
  set quantity = greatest(public.player_energy_inventory.quantity, excluded.quantity);

  insert into public.reward_ledger (user_id, source_type, source_id, reward)
  values (
    player_id,
    'starter_choice',
    'first-card',
    jsonb_build_object(
      'creatureId', target_creature_id,
      'energyElement', starter_element::text,
      'energyQuantity', 12
    )
  );

  return jsonb_build_object(
    'catalogId', target_creature_id,
    'playerCreatureId', creature_instance_id,
    'teamId', active_team_id,
    'energyElement', starter_element::text,
    'energyQuantity', 12
  );
end;
$$;
revoke all on function private.choose_starter_card(text) from public, anon;
grant execute on function private.choose_starter_card(text) to authenticated, service_role;
-- Repair accounts that are unmistakably fresh and still have the obsolete
-- 12/12/12/12/12 starter package. Existing progressed accounts are untouched.
with fresh_accounts as (
  select profiles.id
  from public.profiles profiles
  where (
    select count(*)
    from public.player_creatures owned
    where owned.user_id = profiles.id
  ) <= 1
  and (
    select count(*)
    from public.player_energy_inventory energy
    where energy.user_id = profiles.id
      and energy.quantity = 12
  ) = (
    select count(*) from unnest(enum_range(null::public.card_element))
  )
),
starters as (
  select distinct on (owned.user_id)
    owned.user_id,
    catalog.element
  from public.player_creatures owned
  join public.creature_catalog catalog on catalog.id = owned.creature_id
  join fresh_accounts fresh on fresh.id = owned.user_id
  order by owned.user_id, owned.acquired_at
)
update public.player_energy_inventory energy
set quantity = case
  when starters.element is not null and energy.element = starters.element then 12
  else 0
end
from fresh_accounts fresh
left join starters on starters.user_id = fresh.id
where energy.user_id = fresh.id;
