-- Character powers are permanent inventory cards. A player equips exactly two.
-- Preserve the previous four-card loadout and supporters as archival data.

alter table public.player_arpg_loadouts
  add column if not exists legacy_ability_ids text[];

-- Existing supporter pairs stay byte-for-byte intact. New rows use no active
-- supporters, and the relaxed legacy shape only permits an empty or old pair.
alter table public.player_arpg_loadouts
  drop constraint if exists player_arpg_loadouts_support_ids_check;
alter table public.player_arpg_loadouts
  alter column support_ids set default array[]::text[];
alter table public.player_arpg_loadouts
  add constraint player_arpg_loadouts_support_ids_legacy_shape
  check (cardinality(support_ids) in (0, 2));

update public.player_arpg_loadouts
set legacy_ability_ids = ability_ids
where legacy_ability_ids is null;

-- Previously equipped cards are already-earned progress. Move all four legacy
-- slots into permanent inventory before projecting the live loadout to two.
insert into public.inventory_items (user_id, item_key, quantity, metadata)
select distinct
  loadout.user_id,
  card.card_id,
  1,
  jsonb_build_object('source', 'arpg_legacy_loadout', 'backfilled', true)
from public.player_arpg_loadouts as loadout
cross join lateral unnest(loadout.legacy_ability_ids) as card(card_id)
where card.card_id in (
  'ancestral-roots', 'boitata-flame', 'saci-whirlwind', 'iara-song',
  'caipora-arrow', 'kappa-splash', 'kelpie-surge', 'tengu-gust',
  'banshee-wail', 'medusa-gaze', 'kraken-grasp', 'simurgh-renewal',
  'roc-horizon-storm'
)
on conflict (user_id, item_key) do update
set quantity = greatest(public.inventory_items.quantity, excluded.quantity),
    metadata = public.inventory_items.metadata || excluded.metadata,
    updated_at = now();

alter table public.player_arpg_loadouts
  drop constraint if exists player_arpg_loadouts_ability_ids_check;

alter table public.player_arpg_loadouts
  alter column ability_ids set default array['ancestral-roots', 'boitata-flame']::text[];

update public.player_arpg_loadouts
set ability_ids = legacy_ability_ids[1:2];

alter table public.player_arpg_loadouts
  add constraint player_arpg_loadouts_ability_ids_check
  check (cardinality(ability_ids) = 2 and ability_ids[1] <> ability_ids[2]);

-- New Raid snapshots use the same two-attack contract as the lobby and dungeon
-- runtime. The database column remains available to old rows as archival data.
create or replace function private.arpg_raid_loadout_snapshot(target_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  loadout public.player_arpg_loadouts%rowtype;
begin
  select * into loadout
  from public.player_arpg_loadouts
  where user_id = target_player_id;

  if loadout.user_id is null then
    return jsonb_build_object(
      'weaponId', 'forest-bow',
      'armorId', 'leather-armor',
      'relicId', 'cartographer-compass',
      'abilityIds', jsonb_build_array('ancestral-roots', 'boitata-flame')
    );
  end if;

  return jsonb_build_object(
    'weaponId', loadout.weapon_id,
    'armorId', loadout.armor_id,
    'relicId', loadout.relic_id,
    'abilityIds', to_jsonb(loadout.ability_ids)
  );
end;
$$;

revoke all on function private.arpg_raid_loadout_snapshot(uuid)
  from public, anon, authenticated;
grant execute on function private.arpg_raid_loadout_snapshot(uuid)
  to service_role;

-- Seed the only free power cards for current and future profiles. The upsert is
-- deliberately idempotent and does not grant the former Saci/Iara starters.
insert into public.inventory_items (user_id, item_key, quantity, metadata)
select
  profiles.id,
  starter.card_id,
  1,
  jsonb_build_object('source', 'arpg_power_starter')
from public.profiles
cross join unnest(array['ancestral-roots', 'boitata-flame']::text[]) as starter(card_id)
on conflict (user_id, item_key) do update
set quantity = greatest(public.inventory_items.quantity, excluded.quantity),
    metadata = public.inventory_items.metadata || excluded.metadata,
    updated_at = now();

create or replace function private.seed_arpg_power_starters()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.inventory_items (user_id, item_key, quantity, metadata)
  values
    (new.id, 'ancestral-roots', 1, jsonb_build_object('source', 'arpg_power_starter')),
    (new.id, 'boitata-flame', 1, jsonb_build_object('source', 'arpg_power_starter'))
  on conflict (user_id, item_key) do update
  set quantity = greatest(public.inventory_items.quantity, excluded.quantity),
      metadata = public.inventory_items.metadata || excluded.metadata,
      updated_at = now();
  return new;
end;
$$;

revoke all on function private.seed_arpg_power_starters() from public, anon, authenticated;
drop trigger if exists seed_arpg_power_starters_after_profile on public.profiles;
create trigger seed_arpg_power_starters_after_profile
after insert on public.profiles
for each row execute function private.seed_arpg_power_starters();

-- The old supporter column remains untouched on conflict and is never exposed
-- in new loadout contracts. This function derives the owner from auth.uid().
drop function if exists public.save_arpg_loadout(uuid, text, text, text, text[], text[]);
drop function if exists private.save_arpg_loadout(uuid, text, text, text, text[], text[]);
drop function if exists public.save_arpg_loadout(uuid, text, text, text[], text[]);
drop function if exists private.save_arpg_loadout(uuid, text, text, text[], text[]);

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
    'tide-blade', 'river-bow', 'iara-song-staff'
  ) then
    raise exception 'Arma ARPG inválida' using errcode = '22023';
  end if;
  if target_armor_id is null or target_armor_id not in (
    'leather-armor', 'forest-guardian-armor', 'ritual-cloak',
    'river-shell-armor', 'kelpie-mist-cloak', 'ahuizotl-guard-armor'
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

-- Server-priced power cards. Prices and eligibility are independently fixed in
-- the database so direct RPC requests cannot change the catalogue price.
create or replace function private.purchase_arpg_power_card(target_card_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  card_price bigint;
  current_coins bigint;
  current_quantity integer;
  owned_card_ids text[];
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  card_price := case target_card_id
    when 'saci-whirlwind' then 120
    when 'iara-song' then 240
    when 'caipora-arrow' then 80
    when 'kappa-splash' then 80
    when 'kelpie-surge' then 120
    when 'tengu-gust' then 120
    when 'banshee-wail' then 180
    when 'medusa-gaze' then 320
    when 'kraken-grasp' then 320
    when 'simurgh-renewal' then 320
    else null
  end;
  if card_price is null then
    raise exception 'Carta não disponível na loja do lobby' using errcode = '22023';
  end if;

  select profiles.coins into current_coins
  from public.profiles
  where profiles.id = player_id
  for update;
  if current_coins is null then
    raise exception 'Perfil não encontrado' using errcode = 'P0002';
  end if;

  -- Repair starter ownership idempotently for any profile created before the
  -- starter trigger was added or whose first initialization was incomplete.
  insert into public.inventory_items (user_id, item_key, quantity, metadata)
  values
    (player_id, 'ancestral-roots', 1, jsonb_build_object('source', 'arpg_power_starter')),
    (player_id, 'boitata-flame', 1, jsonb_build_object('source', 'arpg_power_starter'))
  on conflict (user_id, item_key) do update
  set quantity = greatest(public.inventory_items.quantity, excluded.quantity),
      metadata = public.inventory_items.metadata || excluded.metadata,
      updated_at = now();

  select inventory_items.quantity into current_quantity
  from public.inventory_items
  where inventory_items.user_id = player_id
    and inventory_items.item_key = target_card_id
  for update;
  if coalesce(current_quantity, 0) > 0 then
    raise exception 'Carta já adquirida' using errcode = '23505';
  end if;
  if current_coins < card_price then
    raise exception 'Moedas insuficientes' using errcode = '22023';
  end if;

  update public.profiles
  set coins = profiles.coins - card_price
  where profiles.id = player_id
  returning profiles.coins into current_coins;

  insert into public.inventory_items (user_id, item_key, quantity, metadata)
  values (
    player_id,
    target_card_id,
    1,
    jsonb_build_object('source', 'arpg_power_shop', 'acquired_at', now())
  );

  select array_agg(owned.card_id order by owned.card_id)
  into owned_card_ids
  from (
    select distinct inventory.item_key as card_id
    from public.inventory_items as inventory
    where inventory.user_id = player_id
      and inventory.quantity > 0
      and inventory.item_key = any(array[
        'ancestral-roots', 'boitata-flame', 'saci-whirlwind', 'iara-song',
        'caipora-arrow', 'kappa-splash', 'kelpie-surge', 'tengu-gust',
        'banshee-wail', 'medusa-gaze', 'kraken-grasp', 'simurgh-renewal',
        'roc-horizon-storm'
      ]::text[])
  ) as owned;

  return jsonb_build_object(
    'coins', current_coins,
    'ownedAbilityIds', to_jsonb(coalesce(owned_card_ids, array[]::text[]))
  );
end;
$$;

revoke all on function private.purchase_arpg_power_card(text) from public, anon;
grant execute on function private.purchase_arpg_power_card(text) to authenticated;

create or replace function public.purchase_arpg_power_card(target_card_id text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.purchase_arpg_power_card(target_card_id); $$;

revoke all on function public.purchase_arpg_power_card(text) from public, anon;
grant execute on function public.purchase_arpg_power_card(text) to authenticated;

-- Equipment is dungeon loot; the legacy merchant RPC remains available only
-- for Refuge cosmetics. Existing purchased gear stays in inventory untouched.
create or replace function private.purchase_arpg_merchant_item(target_item_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  item_price bigint;
  current_coins bigint;
  current_quantity integer;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  item_price := case target_item_key
    when 'refuge-furniture-books' then 45
    when 'refuge-furniture-chest' then 60
    when 'refuge-furniture-map-stand' then 75
    else null
  end;
  if item_price is null then
    raise exception 'Item indisponível no Mercador' using errcode = '22023';
  end if;

  select profiles.coins into current_coins
  from public.profiles
  where profiles.id = player_id
  for update;
  if current_coins is null then
    raise exception 'Perfil não encontrado' using errcode = 'P0002';
  end if;

  select inventory_items.quantity into current_quantity
  from public.inventory_items
  where inventory_items.user_id = player_id
    and inventory_items.item_key = target_item_key
  for update;
  if coalesce(current_quantity, 0) > 0 then
    raise exception 'Item já adquirido' using errcode = '23505';
  end if;
  if current_coins < item_price then
    raise exception 'Moedas insuficientes' using errcode = '22023';
  end if;

  update public.profiles
  set coins = profiles.coins - item_price
  where profiles.id = player_id
  returning profiles.coins into current_coins;

  insert into public.inventory_items (user_id, item_key, quantity, metadata)
  values (
    player_id,
    target_item_key,
    1,
    jsonb_build_object('source', 'arpg_merchant', 'acquired_at', now())
  );

  return jsonb_build_object('coins', current_coins, 'itemKey', target_item_key, 'quantity', 1);
end;
$$;

-- Stop new dungeon clears from granting folklore power cards or supporters.
-- Existing reward ledger rows and existing inventory are deliberately retained.
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
  if target_player_id is null or target_run_id is null then
    raise exception 'Jogador e run são obrigatórios' using errcode = '22023';
  end if;
  if target_expedition_id not in ('mata-encantada', 'arquipelago-das-mares') then
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
  else
    reward_coins := 90;
    reward_xp := 180;
    reward_items := array['tide-blade', 'river-shell-armor', 'river-bow']::text[];
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

revoke all on function private.purchase_arpg_merchant_item(text) from public, anon;
grant execute on function private.purchase_arpg_merchant_item(text) to authenticated, service_role;

create or replace function public.purchase_arpg_merchant_item(target_item_key text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.purchase_arpg_merchant_item(target_item_key); $$;

revoke all on function public.purchase_arpg_merchant_item(text) from public, anon;
grant execute on function public.purchase_arpg_merchant_item(text) to authenticated, service_role;

revoke all on function private.claim_arpg_expedition_reward(uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function private.claim_arpg_expedition_reward(uuid, uuid, text, boolean)
  to service_role;

-- Legendary boss cards now come from the lobby shop. Keep the old RPC shape for
-- deployed server callers, but make it a no-op; historical grants remain intact.
create or replace function private.claim_arpg_boss_card_reward(
  target_player_id uuid,
  target_run_id uuid,
  target_expedition_id text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select jsonb_build_object('cardId', null, 'replayed', false);
$$;
