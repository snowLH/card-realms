-- Persist the second weapon without changing the legacy supporter column or
-- rewriting completed Raid snapshots.
alter table public.player_arpg_loadouts
  add column if not exists secondary_weapon_id text;

-- Most saved primary weapons differ from the default secondary. Rows that had
-- iron-sword as their primary receive the free forest-bow as their second slot.
update public.player_arpg_loadouts
set secondary_weapon_id = case
  when weapon_id = 'iron-sword' then 'forest-bow'
  else 'iron-sword'
end
where secondary_weapon_id is null
   or secondary_weapon_id = weapon_id;

-- A legacy iron-sword primary now pairs with the starter bow. Keep that
-- already-valid loadout usable by the existing ownership checks.
insert into public.inventory_items (user_id, item_key, quantity, metadata)
select
  loadout.user_id,
  'forest-bow',
  1,
  jsonb_build_object('source', 'arpg_secondary_weapon_backfill')
from public.player_arpg_loadouts as loadout
where loadout.weapon_id = 'iron-sword'
  and loadout.secondary_weapon_id = 'forest-bow'
on conflict (user_id, item_key) do update
set quantity = greatest(public.inventory_items.quantity, 1),
    metadata = public.inventory_items.metadata || excluded.metadata,
    updated_at = now();

alter table public.player_arpg_loadouts
  alter column secondary_weapon_id set default 'iron-sword';
alter table public.player_arpg_loadouts
  alter column secondary_weapon_id set not null;
alter table public.player_arpg_loadouts
  drop constraint if exists player_arpg_loadouts_secondary_weapon_id_check;
alter table public.player_arpg_loadouts
  add constraint player_arpg_loadouts_secondary_weapon_id_check
  check (
    secondary_weapon_id <> weapon_id
    and secondary_weapon_id in (
      'iron-sword', 'forest-bow', 'ritual-staff',
      'tide-blade', 'river-bow', 'iara-song-staff',
      'runic-sabre', 'alicanto-bow', 'raiju-staff'
    )
  );

-- Replace the four-argument implementation with the five-argument contract.
-- Keep a public four-argument wrapper for old SQL callers; new clients must
-- supply both weapons explicitly.
drop function if exists public.save_arpg_loadout(text, text, text, text[]);
drop function if exists private.save_arpg_loadout(text, text, text, text[]);

create or replace function private.save_arpg_loadout(
  target_weapon_id text,
  target_secondary_weapon_id text,
  target_armor_id text,
  target_relic_id text,
  target_ability_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  result_row public.player_arpg_loadouts%rowtype;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  if target_weapon_id is null or target_weapon_id not in (
    'iron-sword', 'forest-bow', 'ritual-staff',
    'tide-blade', 'river-bow', 'iara-song-staff',
    'runic-sabre', 'alicanto-bow', 'raiju-staff'
  ) then
    raise exception 'Arma ARPG inválida' using errcode = '22023';
  end if;
  if target_secondary_weapon_id is null or target_secondary_weapon_id not in (
    'iron-sword', 'forest-bow', 'ritual-staff',
    'tide-blade', 'river-bow', 'iara-song-staff',
    'runic-sabre', 'alicanto-bow', 'raiju-staff'
  ) then
    raise exception 'Arma secundária ARPG inválida' using errcode = '22023';
  end if;
  if target_weapon_id = target_secondary_weapon_id then
    raise exception 'As duas armas ARPG precisam ser diferentes' using errcode = '22023';
  end if;
  if target_armor_id is null or target_armor_id not in (
    'leather-armor', 'forest-guardian-armor', 'ritual-cloak',
    'river-shell-armor', 'kelpie-mist-cloak', 'ahuizotl-guard-armor',
    'highland-coat', 'amarok-hunter-armor', 'carbunclo-mantle'
  ) then
    raise exception 'Armadura ARPG inválida' using errcode = '22023';
  end if;
  if target_relic_id is null or target_relic_id not in (
    'cartographer-compass', 'curupira-track-talisman', 'iara-shell-charm'
  ) then
    raise exception 'Relíquia ARPG inválida' using errcode = '22023';
  end if;
  if cardinality(target_ability_ids) is distinct from 2
    or array_position(target_ability_ids, null) is not null
    or not (target_ability_ids <@ array[
      'ancestral-roots', 'boitata-flame', 'saci-whirlwind', 'iara-song',
      'caipora-arrow', 'kappa-splash', 'kelpie-surge', 'tengu-gust',
      'banshee-wail', 'medusa-gaze', 'kraken-grasp', 'simurgh-renewal',
      'roc-horizon-storm'
    ]::text[]) then
    raise exception 'As duas cartas de poder ARPG são inválidas' using errcode = '22023';
  end if;
  if target_ability_ids[1] = target_ability_ids[2] then
    raise exception 'As cartas de poder ARPG não podem se repetir' using errcode = '22023';
  end if;

  perform 1 from public.profiles where id = player_id for update;
  if not found then
    raise exception 'Perfil do jogador não encontrado' using errcode = 'P0002';
  end if;

  if target_weapon_id <> 'forest-bow' and not exists (
    select 1 from public.inventory_items
    where user_id = player_id and item_key = target_weapon_id and quantity > 0
  ) then
    raise exception 'A conta não possui esta arma' using errcode = '42501';
  end if;
  if target_secondary_weapon_id <> 'iron-sword' and not exists (
    select 1 from public.inventory_items
    where user_id = player_id
      and item_key = target_secondary_weapon_id
      and quantity > 0
  ) then
    raise exception 'A conta não possui esta arma secundária' using errcode = '42501';
  end if;
  if target_armor_id <> 'leather-armor' and not exists (
    select 1 from public.inventory_items
    where user_id = player_id and item_key = target_armor_id and quantity > 0
  ) then
    raise exception 'A conta não possui esta armadura' using errcode = '42501';
  end if;
  if target_relic_id <> 'cartographer-compass' and not exists (
    select 1 from public.inventory_items
    where user_id = player_id and item_key = target_relic_id and quantity > 0
  ) then
    raise exception 'A conta não possui esta relíquia' using errcode = '42501';
  end if;
  if exists (
    select 1
    from unnest(target_ability_ids) as selected(card_id)
    where not exists (
      select 1 from public.inventory_items as inventory
      where inventory.user_id = player_id
        and inventory.item_key = selected.card_id
        and inventory.quantity > 0
    )
  ) then
    raise exception 'A conta não possui uma ou mais cartas de poder' using errcode = '42501';
  end if;

  insert into public.player_arpg_loadouts (
    user_id, weapon_id, secondary_weapon_id, armor_id, relic_id, ability_ids, updated_at
  ) values (
    player_id, target_weapon_id, target_secondary_weapon_id,
    target_armor_id, target_relic_id, target_ability_ids, now()
  )
  on conflict (user_id) do update set
    weapon_id = excluded.weapon_id,
    secondary_weapon_id = excluded.secondary_weapon_id,
    armor_id = excluded.armor_id,
    relic_id = excluded.relic_id,
    ability_ids = excluded.ability_ids,
    updated_at = excluded.updated_at
  returning * into result_row;

  return jsonb_build_object(
    'weaponId', result_row.weapon_id,
    'secondaryWeaponId', result_row.secondary_weapon_id,
    'armorId', result_row.armor_id,
    'relicId', result_row.relic_id,
    'abilityIds', to_jsonb(result_row.ability_ids),
    'updatedAt', result_row.updated_at
  );
end;
$$;

revoke all on function private.save_arpg_loadout(text, text, text, text, text[])
  from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.save_arpg_loadout(text, text, text, text, text[])
  to authenticated;

create or replace function public.save_arpg_loadout(
  target_weapon_id text,
  target_secondary_weapon_id text,
  target_armor_id text,
  target_relic_id text,
  target_ability_ids text[]
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.save_arpg_loadout(
    target_weapon_id, target_secondary_weapon_id,
    target_armor_id, target_relic_id, target_ability_ids
  );
$$;

revoke all on function public.save_arpg_loadout(text, text, text, text, text[])
  from public, anon;
grant execute on function public.save_arpg_loadout(text, text, text, text, text[])
  to authenticated;

create or replace function public.save_arpg_loadout(
  target_weapon_id text,
  target_armor_id text,
  target_relic_id text,
  target_ability_ids text[]
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.save_arpg_loadout(
    target_weapon_id,
    case when target_weapon_id = 'iron-sword' then 'forest-bow' else 'iron-sword' end,
    target_armor_id,
    target_relic_id,
    target_ability_ids
  );
$$;

revoke all on function public.save_arpg_loadout(text, text, text, text[]) from public, anon;
grant execute on function public.save_arpg_loadout(text, text, text, text[]) to authenticated;

-- New Raid snapshots carry and validate both weapons. Completed Raid JSON is
-- left untouched; legacy snapshots without this property use the old default.
create or replace function private.arpg_raid_loadout_snapshot(target_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  loadout public.player_arpg_loadouts%rowtype;
  selected_ability_ids text[];
  selected_weapon_id text;
  selected_secondary_weapon_id text;
  selected_armor_id text;
  selected_relic_id text;
begin
  if target_player_id is null then
    raise exception 'Jogador obrigatório' using errcode = '22023';
  end if;

  select * into loadout
  from public.player_arpg_loadouts
  where user_id = target_player_id;

  if loadout.user_id is null then
    selected_weapon_id := 'forest-bow';
    selected_secondary_weapon_id := 'iron-sword';
    selected_armor_id := 'leather-armor';
    selected_relic_id := 'cartographer-compass';
    selected_ability_ids := array['ancestral-roots', 'boitata-flame']::text[];
  else
    selected_weapon_id := loadout.weapon_id;
    selected_secondary_weapon_id := loadout.secondary_weapon_id;
    selected_armor_id := loadout.armor_id;
    selected_relic_id := loadout.relic_id;
    selected_ability_ids := loadout.ability_ids;
  end if;

  if selected_weapon_id is null or selected_weapon_id not in (
    'iron-sword', 'forest-bow', 'ritual-staff',
    'tide-blade', 'river-bow', 'iara-song-staff',
    'runic-sabre', 'alicanto-bow', 'raiju-staff'
  ) or selected_secondary_weapon_id is null or selected_secondary_weapon_id not in (
    'iron-sword', 'forest-bow', 'ritual-staff',
    'tide-blade', 'river-bow', 'iara-song-staff',
    'runic-sabre', 'alicanto-bow', 'raiju-staff'
  ) or selected_secondary_weapon_id = selected_weapon_id
    or selected_armor_id is null or selected_armor_id not in (
      'leather-armor', 'forest-guardian-armor', 'ritual-cloak',
      'river-shell-armor', 'kelpie-mist-cloak', 'ahuizotl-guard-armor',
      'highland-coat', 'amarok-hunter-armor', 'carbunclo-mantle'
    ) or selected_relic_id is null or selected_relic_id not in (
      'cartographer-compass', 'curupira-track-talisman', 'iara-shell-charm'
    ) then
    raise exception 'O loadout da Raid contém equipamento inválido' using errcode = '22023';
  end if;

  if cardinality(selected_ability_ids) is distinct from 2
    or array_position(selected_ability_ids, null) is not null
    or selected_ability_ids[1] = selected_ability_ids[2]
    or not (selected_ability_ids <@ array[
      'ancestral-roots', 'boitata-flame', 'saci-whirlwind', 'iara-song',
      'caipora-arrow', 'kappa-splash', 'kelpie-surge', 'tengu-gust',
      'banshee-wail', 'medusa-gaze', 'kraken-grasp', 'simurgh-renewal',
      'roc-horizon-storm'
    ]::text[]) then
    raise exception 'O loadout da Raid precisa ter dois poderes distintos' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(selected_ability_ids) as selected(card_id)
    where not exists (
      select 1 from public.inventory_items as inventory
      where inventory.user_id = target_player_id
        and inventory.item_key = selected.card_id
        and inventory.quantity > 0
    )
  ) then
    raise exception 'A conta não possui um ou mais poderes equipados' using errcode = '42501';
  end if;

  if (selected_weapon_id <> 'forest-bow' and not exists (
        select 1 from public.inventory_items as inventory
        where inventory.user_id = target_player_id
          and inventory.item_key = selected_weapon_id
          and inventory.quantity > 0
      ))
    or (selected_secondary_weapon_id <> 'iron-sword' and not exists (
        select 1 from public.inventory_items as inventory
        where inventory.user_id = target_player_id
          and inventory.item_key = selected_secondary_weapon_id
          and inventory.quantity > 0
      ))
    or (selected_armor_id <> 'leather-armor' and not exists (
        select 1 from public.inventory_items as inventory
        where inventory.user_id = target_player_id
          and inventory.item_key = selected_armor_id
          and inventory.quantity > 0
      ))
    or (selected_relic_id <> 'cartographer-compass' and not exists (
        select 1 from public.inventory_items as inventory
        where inventory.user_id = target_player_id
          and inventory.item_key = selected_relic_id
          and inventory.quantity > 0
      )) then
    raise exception 'A conta não possui um ou mais itens do loadout da Raid' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'weaponId', selected_weapon_id,
    'secondaryWeaponId', selected_secondary_weapon_id,
    'armorId', selected_armor_id,
    'relicId', selected_relic_id,
    'abilityIds', to_jsonb(selected_ability_ids)
  );
end;
$$;

revoke all on function private.arpg_raid_loadout_snapshot(uuid)
  from public, anon, authenticated;
grant execute on function private.arpg_raid_loadout_snapshot(uuid) to service_role;

create or replace function private.assert_arpg_raid_secondary_weapon_snapshot(
  target_room_id uuid,
  submitted_state jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.raid_rooms as room
    join public.raid_participants as participant on participant.room_id = room.id
    cross join lateral jsonb_array_elements(case
      when jsonb_typeof(submitted_state -> 'players') = 'array'
        then submitted_state -> 'players'
      else '[]'::jsonb
    end) as player(value)
    where room.id = target_room_id
      and room.gameplay_mode = 'arpg'
      and participant.user_id::text = lower(player.value ->> 'id')
      and (
        jsonb_typeof(participant.team_snapshot) is distinct from 'object'
        or coalesce(
          participant.team_snapshot -> 'secondaryWeaponId',
          to_jsonb(case
            when participant.team_snapshot ->> 'weaponId' = 'iron-sword' then 'forest-bow'
            else 'iron-sword'
          end)
        ) is distinct from coalesce(
          player.value -> 'loadout' -> 'secondaryWeaponId',
          to_jsonb(case
            when player.value -> 'loadout' ->> 'weaponId' = 'iron-sword' then 'forest-bow'
            else 'iron-sword'
          end)
        )
      )
  ) then
    raise exception 'A segunda arma da Raid não corresponde ao snapshot salvo' using errcode = '22023';
  end if;
end;
$$;

revoke all on function private.assert_arpg_raid_secondary_weapon_snapshot(uuid, jsonb)
  from public, anon, authenticated, service_role;

-- Route calls through a narrow guard while retaining the already-versioned
-- server authority bodies. Running rooms marked legacy keep their old behavior.
alter function public.start_raid_room(uuid, jsonb)
  rename to start_raid_room_without_secondary_weapon_guard;
revoke all on function public.start_raid_room_without_secondary_weapon_guard(uuid, jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.start_raid_room(
  target_room_id uuid,
  submitted_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_arpg_raid_secondary_weapon_snapshot(target_room_id, submitted_state);
  return public.start_raid_room_without_secondary_weapon_guard(target_room_id, submitted_state);
end;
$$;

revoke all on function public.start_raid_room(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.start_raid_room(uuid, jsonb) to service_role;

alter function public.commit_raid_action(uuid, uuid, integer, uuid, text, jsonb, jsonb, jsonb)
  rename to commit_raid_action_without_secondary_weapon_guard;
revoke all on function public.commit_raid_action_without_secondary_weapon_guard(
  uuid, uuid, integer, uuid, text, jsonb, jsonb, jsonb
) from public, anon, authenticated, service_role;

create or replace function public.commit_raid_action(
  target_room_id uuid,
  acting_user_id uuid,
  expected_version integer,
  target_client_action_id uuid,
  target_action_type text,
  action_payload jsonb,
  result_state jsonb,
  result_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_arpg_raid_secondary_weapon_snapshot(target_room_id, result_state);
  return public.commit_raid_action_without_secondary_weapon_guard(
    target_room_id, acting_user_id, expected_version, target_client_action_id,
    target_action_type, action_payload, result_state, result_events
  );
end;
$$;

revoke all on function public.commit_raid_action(
  uuid, uuid, integer, uuid, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.commit_raid_action(
  uuid, uuid, integer, uuid, text, jsonb, jsonb, jsonb
) to service_role;
