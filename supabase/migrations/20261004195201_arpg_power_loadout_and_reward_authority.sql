-- Preserve the exact two-card contract at rest, even for privileged writes.
alter table public.player_arpg_loadouts
  drop constraint if exists player_arpg_loadouts_ability_ids_check;
alter table public.player_arpg_loadouts
  add constraint player_arpg_loadouts_ability_ids_check
  check (
    cardinality(ability_ids) = 2
    and array_position(ability_ids, null) is null
    and ability_ids[1] <> ability_ids[2]
    and ability_ids <@ array[
      'ancestral-roots', 'boitata-flame', 'saci-whirlwind', 'iara-song',
      'caipora-arrow', 'kappa-splash', 'kelpie-surge', 'tengu-gust',
      'banshee-wail', 'medusa-gaze', 'kraken-grasp', 'simurgh-renewal',
      'roc-horizon-storm'
    ]::text[]
  );
-- Keep the trusted save RPC aligned with the live catalogue, including the
-- three weapons and three armors added for the Runic Mountains expedition.
create or replace function private.save_arpg_loadout(
  target_weapon_id text,
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
    user_id, weapon_id, armor_id, relic_id, ability_ids, updated_at
  ) values (
    player_id, target_weapon_id, target_armor_id, target_relic_id,
    target_ability_ids, now()
  )
  on conflict (user_id) do update set
    weapon_id = excluded.weapon_id,
    armor_id = excluded.armor_id,
    relic_id = excluded.relic_id,
    ability_ids = excluded.ability_ids,
    updated_at = excluded.updated_at
  returning * into result_row;

  return jsonb_build_object(
    'weaponId', result_row.weapon_id,
    'armorId', result_row.armor_id,
    'relicId', result_row.relic_id,
    'abilityIds', to_jsonb(result_row.ability_ids),
    'updatedAt', result_row.updated_at
  );
end;
$$;
revoke all on function private.save_arpg_loadout(text, text, text, text[]) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.save_arpg_loadout(text, text, text, text[]) to authenticated;
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
    target_weapon_id, target_armor_id, target_relic_id, target_ability_ids
  );
$$;
revoke all on function public.save_arpg_loadout(text, text, text, text[]) from public, anon;
grant execute on function public.save_arpg_loadout(text, text, text, text[]) to authenticated;
-- Raid snapshots are built from the persisted loadout and re-check ownership
-- at the trusted server boundary. Supporter IDs remain archived in the table
-- but are deliberately omitted from the snapshot.
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
    selected_armor_id := 'leather-armor';
    selected_relic_id := 'cartographer-compass';
    selected_ability_ids := array['ancestral-roots', 'boitata-flame']::text[];
  else
    selected_weapon_id := loadout.weapon_id;
    selected_armor_id := loadout.armor_id;
    selected_relic_id := loadout.relic_id;
    selected_ability_ids := loadout.ability_ids;
  end if;

  if selected_weapon_id is null or selected_weapon_id not in (
    'iron-sword', 'forest-bow', 'ritual-staff',
    'tide-blade', 'river-bow', 'iara-song-staff',
    'runic-sabre', 'alicanto-bow', 'raiju-staff'
  ) or selected_armor_id is null or selected_armor_id not in (
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
    'armorId', selected_armor_id,
    'relicId', selected_relic_id,
    'abilityIds', to_jsonb(selected_ability_ids)
  );
end;
$$;
revoke all on function private.arpg_raid_loadout_snapshot(uuid)
  from public, anon, authenticated;
grant execute on function private.arpg_raid_loadout_snapshot(uuid)
  to service_role;
-- The third available expedition must finish through the same permanent
-- reward ledger. It grants only its equipment and never permanent powers.
create or replace function private.claim_arpg_expedition_reward(
  target_player_id uuid,
  target_run_id uuid,
  target_expedition_id text,
  target_victory boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_reward jsonb;
  reward jsonb;
  reward_items text[];
  reward_coins integer;
  reward_xp integer;
begin
  if target_player_id is null or target_run_id is null
    or target_expedition_id is null or target_victory is null then
    raise exception 'Jogador e run são obrigatórios' using errcode = '22023';
  end if;
  if target_expedition_id not in (
    'mata-encantada', 'arquipelago-das-mares', 'montanhas-runicas'
  ) then
    raise exception 'Expedição ARPG inválida' using errcode = '22023';
  end if;

  perform 1 from public.profiles where id = target_player_id for update;
  if not found then
    raise exception 'Perfil do jogador não encontrado' using errcode = 'P0002';
  end if;

  if not target_victory then
    return jsonb_build_object(
      'coins', 0, 'xp', 0, 'victory', false, 'items', '[]'::jsonb,
      'newItems', '[]'::jsonb, 'replayed', false
    );
  end if;

  select ledger.reward into existing_reward
  from public.reward_ledger as ledger
  where ledger.user_id = target_player_id
    and ledger.source_type = 'arpg_expedition_first_clear'
    and ledger.source_id = target_expedition_id;
  if existing_reward is not null then
    return existing_reward || jsonb_build_object('replayed', true, 'newItems', '[]'::jsonb);
  end if;

  if target_expedition_id = 'mata-encantada' then
    reward_coins := 60;
    reward_xp := 120;
    reward_items := array['ritual-staff', 'ritual-cloak', 'iron-sword']::text[];
  elsif target_expedition_id = 'arquipelago-das-mares' then
    reward_coins := 90;
    reward_xp := 180;
    reward_items := array['tide-blade', 'river-shell-armor', 'river-bow']::text[];
  else
    reward_coins := 120;
    reward_xp := 240;
    reward_items := array['runic-sabre', 'highland-coat', 'raiju-staff']::text[];
  end if;

  reward := jsonb_build_object(
    'coins', reward_coins,
    'xp', reward_xp,
    'victory', true,
    'runId', target_run_id,
    'expeditionId', target_expedition_id,
    'items', to_jsonb(reward_items)
  );

  insert into public.reward_ledger (user_id, source_type, source_id, reward)
  values (target_player_id, 'arpg_expedition_first_clear', target_expedition_id, reward);

  update public.profiles
  set coins = profiles.coins + reward_coins,
      xp = profiles.xp + reward_xp
  where id = target_player_id;

  insert into public.inventory_items (user_id, item_key, quantity, metadata)
  select
    target_player_id,
    reward_item,
    1,
    jsonb_build_object('source', 'arpg_expedition_first_clear', 'expeditionId', target_expedition_id)
  from unnest(reward_items) as reward_item
  on conflict (user_id, item_key) do update
  set quantity = greatest(public.inventory_items.quantity, 1),
      metadata = public.inventory_items.metadata || excluded.metadata,
      updated_at = now();

  return reward || jsonb_build_object('replayed', false, 'newItems', '[]'::jsonb);
end;
$$;
revoke all on function private.claim_arpg_expedition_reward(uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function private.claim_arpg_expedition_reward(uuid, uuid, text, boolean)
  to service_role;
