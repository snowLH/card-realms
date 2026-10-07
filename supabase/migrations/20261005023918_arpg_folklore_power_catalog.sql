-- Expand the authoritative power catalogue. The five culturally gated cards
-- remain present for stable IDs, but cannot roll, be purchased, or be equipped.
insert into private.arpg_power_gacha_catalog (
  card_id, tier, card_rarity, duplicate_fragments, enabled
) values
  ('boto-river-current', 'uncommon', 'uncommon', 8, true),
  ('cuca-echo-cauldron', 'rare', 'rare', 14, true),
  ('mula-cinder-stampede', 'uncommon', 'uncommon', 8, true),
  ('matinta-whistling-mark', 'common', 'common', 5, true),
  ('boiuna-eddy-snare', 'epic', 'epic', 24, true),
  ('mapinguari-hollow-roar', 'legendary', 'legendary', 45, true),
  ('vitoria-regia-moon-bloom', 'uncommon', 'uncommon', 8, true),
  ('alicanto-mineral-glint', 'rare', 'rare', 14, true),
  ('camahueto-hoofbreak', 'epic', 'epic', 24, true),
  ('ahuizotl-spring-hand', 'legendary', 'legendary', 45, true),
  ('llorona-river-lament', 'epic', 'epic', 24, true),
  ('cadejo-crossroads-pulse', 'common', 'common', 5, true),
  ('chupacabra-night-quills', 'common', 'common', 5, true),
  ('jackalope-bramble-bounce', 'common', 'common', 5, true),
  ('jersey-devil-pine-scream', 'uncommon', 'uncommon', 8, true),
  ('selkie-breaker-lance', 'rare', 'rare', 14, true),
  ('black-shuck-lantern-gaze', 'epic', 'epic', 24, true),
  ('baba-yaga-threshold-fence', 'legendary', 'legendary', 45, true),
  ('leshy-forest-circle', 'uncommon', 'uncommon', 8, true),
  ('anansi-thread-snare', 'rare', 'rare', 14, true),
  ('sasabonsam-canopy-strike', 'epic', 'epic', 24, false),
  ('impundulu-thunderclap', 'epic', 'epic', 24, true),
  ('tokoloshe-low-mist', 'uncommon', 'uncommon', 8, true),
  ('oni-kanabo-impact', 'rare', 'rare', 14, true),
  ('jiangshi-paper-seal', 'rare', 'rare', 14, true),
  ('huli-jing-foxfire', 'epic', 'epic', 24, true),
  ('tikbalang-hoofbeat', 'common', 'common', 5, true),
  ('manananggal-shadow-sweep', 'rare', 'rare', 14, false),
  ('penanggalan-return-tether', 'rare', 'rare', 14, false),
  ('bunyip-billabong-echo', 'uncommon', 'uncommon', 8, false),
  ('taniwha-place-ward', 'legendary', 'legendary', 45, false)
on conflict (card_id) do update set
  tier = excluded.tier,
  card_rarity = excluded.card_rarity,
  duplicate_fragments = excluded.duplicate_fragments,
  enabled = excluded.enabled;
-- Keep every current card's fragment compensation and odds band aligned with
-- its rarity. Roc is mythic but intentionally remains in the legendary band.
update private.arpg_power_gacha_catalog
set tier = case card_rarity
      when 'mythic' then 'legendary'
      else card_rarity
    end,
    duplicate_fragments = case card_rarity
      when 'common' then 5
      when 'uncommon' then 8
      when 'rare' then 14
      when 'epic' then 24
      when 'legendary' then 45
      when 'mythic' then 60
    end;
-- This is the single allowlist used by persisted loadouts, purchases, and
-- combat snapshots. The two starter powers stay valid outside the shop pool.
create or replace function private.active_arpg_power_card_ids()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(active.card_id order by active.card_id), array[]::text[])
  from (
    select 'ancestral-roots'::text as card_id
    union
    select 'boitata-flame'::text
    union
    select catalog.card_id
    from private.arpg_power_gacha_catalog as catalog
    where catalog.enabled
  ) as active;
$$;
revoke all on function private.active_arpg_power_card_ids() from public, anon, authenticated;
grant execute on function private.active_arpg_power_card_ids() to authenticated, service_role;
-- Revalidate existing rows as well as future writes against the live allowlist.
alter table public.player_arpg_loadouts
  drop constraint if exists player_arpg_loadouts_ability_ids_check;
alter table public.player_arpg_loadouts
  add constraint player_arpg_loadouts_ability_ids_check
  check (
    cardinality(ability_ids) = 2
    and array_position(ability_ids, null) is null
    and ability_ids[1] <> ability_ids[2]
    and ability_ids <@ private.active_arpg_power_card_ids()
  );
-- The five-argument save contract includes both weapons from the preceding
-- migration and still requires inventory ownership for every non-starter.
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
    or not (target_ability_ids <@ private.active_arpg_power_card_ids()) then
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
-- Raid snapshots keep the second weapon and reject powers outside the same
-- enabled catalogue while retaining explicit inventory possession checks.
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
    or not (selected_ability_ids <@ private.active_arpg_power_card_ids()) then
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
-- Classic PvP snapshots use the same IDs and retain the ownership check.
create or replace function private.active_avatar_power_snapshot(player_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  avatar jsonb;
  ability_ids text[];
begin
  select coalesce(profiles.avatar_config, jsonb_build_object(
    'skin', 'copper', 'hair', 'braids', 'outfit', 'traveler',
    'armor', 'none', 'accent', 'gold'
  ))
  into avatar
  from public.profiles
  where profiles.id = player_id;

  if avatar is null then
    raise exception 'Perfil do jogador não encontrado' using errcode = 'P0002';
  end if;
  if jsonb_typeof(avatar) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(avatar)) <> 5
    or avatar ->> 'skin' is null or avatar ->> 'skin' not in ('amber', 'copper', 'umber', 'rose')
    or avatar ->> 'hair' is null or avatar ->> 'hair' not in ('braids', 'short', 'waves', 'mohawk')
    or avatar ->> 'outfit' is null or avatar ->> 'outfit' not in ('traveler', 'scholar', 'ranger', 'merchant')
    or avatar ->> 'armor' is null or avatar ->> 'armor' not in ('none', 'leather', 'runic', 'guardian')
    or avatar ->> 'accent' is null or avatar ->> 'accent' not in ('gold', 'emerald', 'azure', 'crimson') then
    raise exception 'A aparência salva do jogador é inválida' using errcode = '22023';
  end if;

  select loadout.ability_ids
  into ability_ids
  from public.player_arpg_loadouts as loadout
  where loadout.user_id = player_id;

  if not found then
    raise exception 'O jogador precisa salvar dois poderes no Arquivo' using errcode = '22023';
  end if;
  if cardinality(ability_ids) is distinct from 2
    or array_position(ability_ids, null) is not null
    or ability_ids[1] = ability_ids[2]
    or not (ability_ids <@ private.active_arpg_power_card_ids()) then
    raise exception 'O loadout precisa ter dois poderes conhecidos e diferentes' using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(ability_ids) as selected(card_id)
    where not exists (
      select 1
      from public.inventory_items as inventory
      where inventory.user_id = player_id
        and inventory.item_key = selected.card_id
        and inventory.quantity > 0
    )
  ) then
    raise exception 'O jogador não possui um dos poderes equipados' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'avatarConfig', avatar,
    'abilityIds', to_jsonb(ability_ids)
  );
end;
$$;
revoke all on function private.active_avatar_power_snapshot(uuid) from public, anon, authenticated;
grant execute on function private.active_avatar_power_snapshot(uuid) to service_role;
-- Direct shop prices come from the private rarity table, with the one
-- explicitly priced mythic Roc exception. No ownership path accepts client cost.
create or replace function private.purchase_arpg_power_card(target_card_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  card_rarity text;
  card_price bigint;
  current_coins bigint;
  current_quantity integer;
  owned_card_ids text[];
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;
  if target_card_id is null then
    raise exception 'Carta obrigatória' using errcode = '22023';
  end if;

  select catalog.card_rarity
  into card_rarity
  from private.arpg_power_gacha_catalog as catalog
  where catalog.card_id = target_card_id
    and catalog.enabled;
  if not found then
    raise exception 'Carta não disponível na loja do lobby' using errcode = '22023';
  end if;

  card_price := case
    when target_card_id = 'roc-horizon-storm' then 500
    when card_rarity = 'common' then 80
    when card_rarity = 'uncommon' then 120
    when card_rarity = 'rare' then 180
    when card_rarity = 'epic' then 240
    when card_rarity = 'legendary' then 320
    else null
  end;
  if card_price is null then
    raise exception 'Raridade sem preço de loja' using errcode = '22023';
  end if;

  select profiles.coins into current_coins
  from public.profiles as profiles
  where profiles.id = player_id
  for update;
  if current_coins is null then
    raise exception 'Perfil não encontrado' using errcode = 'P0002';
  end if;

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
      and inventory.item_key = any(private.active_arpg_power_card_ids())
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
-- The public shop now owns every purchase path; keep the old Roc RPC and the
-- retired six-member team RPCs unavailable to authenticated clients.
revoke all on function private.purchase_roc_horizon_storm() from public, anon, authenticated;
grant execute on function private.purchase_roc_horizon_storm() to service_role;
revoke all on function public.activate_team(uuid) from public, anon, authenticated;
grant execute on function public.activate_team(uuid) to service_role;
revoke all on function private.activate_team(uuid) from public, anon, authenticated;
grant execute on function private.activate_team(uuid) to service_role;
revoke all on function public.save_active_team(uuid[], text) from public, anon, authenticated;
grant execute on function public.save_active_team(uuid[], text) to service_role;
