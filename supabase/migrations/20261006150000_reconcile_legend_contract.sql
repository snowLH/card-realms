-- Reconcile the final Legend contract after importing the production migration
-- history. Every live mode uses one owned Legend and its exact two signature
-- powers; armour remains a compatibility-only database column.

create or replace function private.legend_signature_ability_ids(target_legend_id text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select catalogue.ability_ids
  from (values
    ('curupira', array['curupira-root-snare', 'curupira-ember-arrow']::text[]),
    ('iara', array['iara-enchanting-song', 'iara-living-spring']::text[]),
    ('boto', array['boto-river-whirl', 'boto-tidal-trick']::text[]),
    ('kappa', array['kappa-shell-surge', 'kappa-river-bind']::text[]),
    ('raiju', array['raiju-thunder-field', 'raiju-lightning-fang']::text[]),
    ('amarok', array['amarok-moon-howl', 'amarok-night-hunt']::text[]),
    ('kelpie', array['kelpie-drowning-reins', 'kelpie-mist-call']::text[]),
    ('mapinguari', array['mapinguari-earth-grip', 'mapinguari-forest-crush']::text[]),
    ('ahuizotl', array['ahuizotl-tail-grasp', 'ahuizotl-river-ambush']::text[]),
    ('ratatoskr', array['ratatoskr-acorn-shot', 'ratatoskr-branch-whirl']::text[]),
    ('carbunclo', array['carbunclo-gem-flare', 'carbunclo-gem-renewal']::text[]),
    ('alicanto', array['alicanto-golden-gale', 'alicanto-mineral-mending']::text[]),
    ('yeti', array['yeti-frozen-roar', 'yeti-avalanche-stomp']::text[])
  ) as catalogue(legend_id, ability_ids)
  where catalogue.legend_id = target_legend_id;
$$;

revoke all on function private.legend_signature_ability_ids(text) from public, anon, authenticated;
grant execute on function private.legend_signature_ability_ids(text) to service_role;

-- Normalize legacy or incomplete appearance records to a valid Curupira
-- profile, then guarantee the starter pair for every account.
update public.profiles
set avatar_config = jsonb_build_object(
  'legendId', 'curupira', 'favoriteLegendId', 'curupira',
  'skin', 'copper', 'hair', 'mohawk', 'outfit', 'ranger',
  'armor', 'none', 'accent', 'crimson'
)
where avatar_config is null
  or jsonb_typeof(avatar_config) <> 'object'
  or not coalesce(avatar_config ->> 'legendId' = any(array[
    'curupira', 'iara', 'boto', 'kappa', 'raiju', 'amarok', 'kelpie',
    'mapinguari', 'ahuizotl', 'ratatoskr', 'carbunclo', 'alicanto', 'yeti'
  ]::text[]), false);

update public.profiles
set avatar_config = jsonb_set(avatar_config, '{armor}', '"none"'::jsonb, true)
where avatar_config ->> 'armor' is distinct from 'none';

with owned_legends as (
  select profile.id as user_id, 'curupira'::text as legend_id
  from public.profiles as profile
  union
  select inventory.user_id, substring(inventory.item_key from 8)
  from public.inventory_items as inventory
  where inventory.item_key like 'legend-%' and inventory.quantity > 0
), entitlements as (
  select owned_legends.user_id, owned_legends.legend_id, ability.ability_id
  from owned_legends
  cross join lateral unnest(private.legend_signature_ability_ids(owned_legends.legend_id)) as ability(ability_id)
)
insert into public.inventory_items (user_id, item_key, quantity, metadata)
select entitlement.user_id, entitlement.ability_id, 1, jsonb_build_object(
  'source', 'legend_signature_reconciliation',
  'legendId', entitlement.legend_id,
  'grantedAt', now()
)
from entitlements as entitlement
on conflict (user_id, item_key) do update
set quantity = greatest(public.inventory_items.quantity, excluded.quantity),
    metadata = public.inventory_items.metadata || excluded.metadata,
    updated_at = now();

alter table public.player_arpg_loadouts
  drop constraint if exists player_arpg_loadouts_ability_ids_check;

update public.player_arpg_loadouts as loadout
set ability_ids = private.legend_signature_ability_ids(profile.avatar_config ->> 'legendId'),
    armor_id = 'leather-armor',
    updated_at = now()
from public.profiles as profile
where profile.id = loadout.user_id;

alter table public.player_arpg_loadouts
  add constraint player_arpg_loadouts_ability_ids_check
  check (
    cardinality(ability_ids) = 2
    and array_position(ability_ids, null) is null
    and ability_ids[1] <> ability_ids[2]
    and ability_ids <@ array[
      'curupira-root-snare', 'curupira-ember-arrow',
      'iara-enchanting-song', 'iara-living-spring',
      'boto-river-whirl', 'boto-tidal-trick',
      'kappa-shell-surge', 'kappa-river-bind',
      'raiju-thunder-field', 'raiju-lightning-fang',
      'amarok-moon-howl', 'amarok-night-hunt',
      'kelpie-drowning-reins', 'kelpie-mist-call',
      'mapinguari-earth-grip', 'mapinguari-forest-crush',
      'ahuizotl-tail-grasp', 'ahuizotl-river-ambush',
      'ratatoskr-acorn-shot', 'ratatoskr-branch-whirl',
      'carbunclo-gem-flare', 'carbunclo-gem-renewal',
      'alicanto-golden-gale', 'alicanto-mineral-mending',
      'yeti-frozen-roar', 'yeti-avalanche-stomp'
    ]::text[]
  );

create or replace function private.save_avatar_config(target_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  active_legend_id text;
  favorite_legend_id text;
  signature_ability_ids text[];
begin
  if player_id is null then raise exception 'Autenticação necessária' using errcode = '42501'; end if;
  if jsonb_typeof(target_config) <> 'object'
    or (select count(*) from jsonb_object_keys(target_config)) <> 7
    or not (target_config ?& array['legendId','favoriteLegendId','skin','hair','outfit','armor','accent']::text[])
    or not coalesce(target_config ->> 'legendId' = any(array[
      'curupira', 'iara', 'boto', 'kappa', 'raiju', 'amarok', 'kelpie',
      'mapinguari', 'ahuizotl', 'ratatoskr', 'carbunclo', 'alicanto', 'yeti'
    ]::text[]), false)
    or not (target_config -> 'favoriteLegendId' = 'null'::jsonb or coalesce(target_config ->> 'favoriteLegendId' = any(array[
      'curupira', 'iara', 'boto', 'kappa', 'raiju', 'amarok', 'kelpie',
      'mapinguari', 'ahuizotl', 'ratatoskr', 'carbunclo', 'alicanto', 'yeti'
    ]::text[]), false))
    or not coalesce(target_config ->> 'skin' = any(array['amber','copper','umber','rose']::text[]), false)
    or not coalesce(target_config ->> 'hair' = any(array['braids','short','waves','mohawk']::text[]), false)
    or not coalesce(target_config ->> 'outfit' = any(array['traveler','scholar','ranger','merchant']::text[]), false)
    or target_config ->> 'armor' <> 'none'
    or not coalesce(target_config ->> 'accent' = any(array['gold','emerald','azure','crimson']::text[]), false)
  then raise exception 'Configuração de Lenda inválida' using errcode = '22023'; end if;

  active_legend_id := target_config ->> 'legendId';
  favorite_legend_id := target_config ->> 'favoriteLegendId';
  if active_legend_id <> 'curupira' and not exists (
    select 1 from public.inventory_items
    where user_id = player_id and item_key = 'legend-' || active_legend_id and quantity > 0
  ) then raise exception 'Você ainda não possui esta Lenda' using errcode = '22023'; end if;
  if favorite_legend_id is not null and favorite_legend_id <> 'curupira' and not exists (
    select 1 from public.inventory_items
    where user_id = player_id and item_key = 'legend-' || favorite_legend_id and quantity > 0
  ) then raise exception 'Você ainda não possui sua Lenda favorita' using errcode = '22023'; end if;

  signature_ability_ids := private.legend_signature_ability_ids(active_legend_id);
  update public.profiles set avatar_config = target_config where id = player_id;
  if not found then raise exception 'Perfil não encontrado' using errcode = 'P0002'; end if;
  insert into public.player_arpg_loadouts (user_id, weapon_id, armor_id, relic_id, ability_ids, updated_at)
  values (player_id, 'forest-bow', 'leather-armor', 'cartographer-compass', signature_ability_ids, now())
  on conflict (user_id) do update set
    armor_id = 'leather-armor', ability_ids = excluded.ability_ids, updated_at = now();
  return target_config;
end;
$$;

create or replace function private.save_arpg_loadout(
  target_weapon_id text, target_armor_id text, target_relic_id text, target_ability_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  active_legend_id text;
  expected_ability_ids text[];
  result_row public.player_arpg_loadouts%rowtype;
begin
  if player_id is null then raise exception 'Autenticação necessária' using errcode = '42501'; end if;
  if target_weapon_id is null or target_weapon_id not in (
    'iron-sword','forest-bow','ritual-staff','tide-blade','river-bow','iara-song-staff','runic-sabre','alicanto-bow','raiju-staff'
  ) then raise exception 'Arma ARPG inválida' using errcode = '22023'; end if;
  if target_armor_id is distinct from 'leather-armor' then raise exception 'Armaduras não fazem parte do equipamento ativo' using errcode = '22023'; end if;
  if target_relic_id is null or target_relic_id not in ('cartographer-compass','curupira-track-talisman','iara-shell-charm') then
    raise exception 'Relíquia ARPG inválida' using errcode = '22023';
  end if;
  select avatar_config ->> 'legendId' into active_legend_id from public.profiles where id = player_id for update;
  if active_legend_id is null then raise exception 'Perfil do jogador não encontrado' using errcode = 'P0002'; end if;
  expected_ability_ids := private.legend_signature_ability_ids(active_legend_id);
  if expected_ability_ids is null or cardinality(target_ability_ids) <> 2 or array_position(target_ability_ids, null) is not null
    or target_ability_ids[1] = target_ability_ids[2]
    or not (target_ability_ids <@ expected_ability_ids and expected_ability_ids <@ target_ability_ids)
  then raise exception 'Os dois poderes precisam pertencer à Lenda ativa' using errcode = '22023'; end if;
  if target_weapon_id <> 'forest-bow' and not exists (
    select 1 from public.inventory_items where user_id = player_id and item_key = target_weapon_id and quantity > 0
  ) then raise exception 'A conta não possui esta arma' using errcode = '42501'; end if;
  if target_relic_id <> 'cartographer-compass' and not exists (
    select 1 from public.inventory_items where user_id = player_id and item_key = target_relic_id and quantity > 0
  ) then raise exception 'A conta não possui esta relíquia' using errcode = '42501'; end if;
  if exists (select 1 from unnest(target_ability_ids) as selected(card_id) where not exists (
    select 1 from public.inventory_items where user_id = player_id and item_key = selected.card_id and quantity > 0
  )) then raise exception 'A conta não possui os poderes desta Lenda' using errcode = '42501'; end if;
  insert into public.player_arpg_loadouts (user_id, weapon_id, armor_id, relic_id, ability_ids, updated_at)
  values (player_id, target_weapon_id, 'leather-armor', target_relic_id, target_ability_ids, now())
  on conflict (user_id) do update set weapon_id = excluded.weapon_id, armor_id = excluded.armor_id,
    relic_id = excluded.relic_id, ability_ids = excluded.ability_ids, updated_at = now()
  returning * into result_row;
  return jsonb_build_object('weaponId', result_row.weapon_id, 'armorId', result_row.armor_id,
    'relicId', result_row.relic_id, 'abilityIds', to_jsonb(result_row.ability_ids), 'updatedAt', result_row.updated_at);
end;
$$;

create or replace function private.purchase_playable_legend(target_legend_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  legend_price bigint;
  signature_ability_ids text[];
  current_coins bigint;
  inventory_key text;
  owned_quantity integer;
  owned_ability_ids text[];
begin
  if player_id is null then raise exception 'Autenticação necessária' using errcode = '42501'; end if;
  select catalogue.price into legend_price from (values
    ('iara',180::bigint),('boto',240::bigint),('kappa',220::bigint),('raiju',360::bigint),('amarok',420::bigint),('kelpie',300::bigint),
    ('mapinguari',500::bigint),('ahuizotl',540::bigint),('ratatoskr',380::bigint),('carbunclo',460::bigint),('alicanto',500::bigint),('yeti',620::bigint)
  ) as catalogue(legend_id, price) where catalogue.legend_id = target_legend_id;
  signature_ability_ids := private.legend_signature_ability_ids(target_legend_id);
  if legend_price is null or signature_ability_ids is null then raise exception 'Personagem indisponível na loja' using errcode = '22023'; end if;
  inventory_key := 'legend-' || target_legend_id;
  select coins into current_coins from public.profiles where id = player_id for update;
  if not found then raise exception 'Perfil do jogador não encontrado' using errcode = 'P0002'; end if;
  select quantity into owned_quantity from public.inventory_items where user_id = player_id and item_key = inventory_key for update;
  if coalesce(owned_quantity, 0) > 0 then raise exception 'Você já possui este personagem' using errcode = '23505'; end if;
  if current_coins < legend_price then raise exception 'Moedas insuficientes' using errcode = '22023'; end if;
  update public.profiles set coins = coins - legend_price where id = player_id returning coins into current_coins;
  insert into public.inventory_items (user_id, item_key, quantity, metadata) values (
    player_id, inventory_key, 1, jsonb_build_object('source','legend_shop','legendId',target_legend_id,'price',legend_price,'signatureAbilityIds',to_jsonb(signature_ability_ids),'acquiredAt',now())
  );
  insert into public.inventory_items (user_id, item_key, quantity, metadata)
  select player_id, ability.ability_id, 1, jsonb_build_object('source','legend_shop_bundle','legendId',target_legend_id,'acquiredAt',now())
  from unnest(signature_ability_ids) as ability(ability_id)
  on conflict (user_id, item_key) do update set quantity = greatest(public.inventory_items.quantity, excluded.quantity),
    metadata = public.inventory_items.metadata || excluded.metadata, updated_at = now();
  select coalesce(array_agg(item_key order by item_key), array[]::text[]) into owned_ability_ids
  from public.inventory_items where user_id = player_id and quantity > 0 and item_key = any(array[
    'curupira-root-snare','curupira-ember-arrow','iara-enchanting-song','iara-living-spring','boto-river-whirl','boto-tidal-trick',
    'kappa-shell-surge','kappa-river-bind','raiju-thunder-field','raiju-lightning-fang','amarok-moon-howl','amarok-night-hunt',
    'kelpie-drowning-reins','kelpie-mist-call','mapinguari-earth-grip','mapinguari-forest-crush','ahuizotl-tail-grasp','ahuizotl-river-ambush',
    'ratatoskr-acorn-shot','ratatoskr-branch-whirl','carbunclo-gem-flare','carbunclo-gem-renewal','alicanto-golden-gale','alicanto-mineral-mending',
    'yeti-frozen-roar','yeti-avalanche-stomp'
  ]::text[]);
  return jsonb_build_object('coins',current_coins,'price',legend_price,'legendId',target_legend_id,'itemKey',inventory_key,
    'signatureAbilityIds',to_jsonb(signature_ability_ids),'ownedAbilityIds',to_jsonb(owned_ability_ids));
end;
$$;

create or replace function private.active_avatar_power_snapshot(player_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  avatar jsonb;
  active_legend_id text;
  ability_ids text[];
  expected_ability_ids text[];
begin
  select avatar_config into avatar from public.profiles where id = player_id;
  if avatar is null then raise exception 'Perfil do jogador não encontrado' using errcode = 'P0002'; end if;
  active_legend_id := avatar ->> 'legendId';
  expected_ability_ids := private.legend_signature_ability_ids(active_legend_id);
  if expected_ability_ids is null then raise exception 'A Lenda ativa é inválida' using errcode = '22023'; end if;
  if active_legend_id <> 'curupira' and not exists (
    select 1 from public.inventory_items where user_id = player_id and item_key = 'legend-' || active_legend_id and quantity > 0
  ) then raise exception 'O jogador não possui a Lenda ativa' using errcode = '42501'; end if;
  select loadout.ability_ids into ability_ids from public.player_arpg_loadouts as loadout where loadout.user_id = player_id;
  if ability_ids is null or not (ability_ids <@ expected_ability_ids and expected_ability_ids <@ ability_ids) then
    raise exception 'Os poderes equipados não correspondem à Lenda ativa' using errcode = '22023';
  end if;
  return jsonb_build_object('avatarConfig', avatar, 'abilityIds', to_jsonb(ability_ids));
end;
$$;

update public.raid_events
set boss_config = jsonb_set(coalesce(boss_config, '{}'::jsonb), '{gameplayMode}', '"avatar"'::jsonb, true)
where boss_config ->> 'gameplayMode' is distinct from 'avatar';
update public.raid_rooms set status = 'closed', finished_at = coalesce(finished_at, now())
where status = 'lobby' and gameplay_mode = 'arpg';

-- Retire old purchasable power-card interfaces. Signature powers are bundled
-- only with their Legend, and the client uses the existing four-argument RPC.
revoke all on function public.purchase_arpg_power_card(text) from public, anon, authenticated;
revoke all on function private.purchase_arpg_power_card(text) from public, anon, authenticated;
revoke all on function public.get_arpg_power_gacha_state() from public, anon, authenticated;
revoke all on function public.roll_arpg_power_gacha(uuid, uuid) from public, anon, authenticated;
revoke all on function public.redeem_arpg_power_gacha_card(uuid, text, uuid) from public, anon, authenticated;
revoke all on function private.save_arpg_loadout(text, text, text, text[]) from public, anon;
grant execute on function private.save_arpg_loadout(text, text, text, text[]) to authenticated;
revoke all on function private.purchase_playable_legend(text) from public, anon;
grant execute on function private.purchase_playable_legend(text) to authenticated;
revoke all on function private.active_avatar_power_snapshot(uuid) from public, anon, authenticated;
grant execute on function private.active_avatar_power_snapshot(uuid) to service_role;
