-- Keep legacy five-key avatar profiles usable under the seven-key playable
-- legend schema. Only exact legacy configs are backfilled; custom appearance
-- fields are preserved and incomplete/unknown objects are left untouched.

-- Players whose profile still has the original five-key avatar receive the
-- two Curupira starter powers. A null avatar is the historical default too.
update public.player_arpg_loadouts as loadout
set ability_ids = array['ancestral-roots', 'boitata-flame']::text[]
from public.profiles as profile
where profile.id = loadout.user_id
  and loadout.ability_ids is distinct from array['ancestral-roots', 'boitata-flame']::text[]
  and case
    when profile.avatar_config is null then true
    when pg_catalog.jsonb_typeof(profile.avatar_config) is distinct from 'object' then false
    when (profile.avatar_config ? 'legendId') or (profile.avatar_config ? 'favoriteLegendId') then false
    when not (profile.avatar_config ?& array['skin', 'hair', 'outfit', 'armor', 'accent']::text[]) then false
    else (select count(*) from pg_catalog.jsonb_object_keys(profile.avatar_config)) = 5
  end;

-- Preserve each valid legacy appearance while adding Curupira as the active
-- and favorite legend. Null configs receive the former visual defaults.
update public.profiles as profile
set avatar_config = case
  when profile.avatar_config is null then pg_catalog.jsonb_build_object(
    'legendId', 'curupira',
    'favoriteLegendId', 'curupira',
    'skin', 'copper',
    'hair', 'braids',
    'outfit', 'traveler',
    'armor', 'none',
    'accent', 'gold'
  )
  else pg_catalog.jsonb_set(
    pg_catalog.jsonb_set(profile.avatar_config, '{legendId}', '"curupira"'::jsonb, true),
    '{favoriteLegendId}', '"curupira"'::jsonb, true
  )
end
where case
  when profile.avatar_config is null then true
  when pg_catalog.jsonb_typeof(profile.avatar_config) is distinct from 'object' then false
  when (profile.avatar_config ? 'legendId') or (profile.avatar_config ? 'favoriteLegendId') then false
  when not (profile.avatar_config ?& array['skin', 'hair', 'outfit', 'armor', 'accent']::text[]) then false
  else (select count(*) from pg_catalog.jsonb_object_keys(profile.avatar_config)) = 5
end;

-- Armor is no longer part of the active dungeon/raid loadout. Keep the legacy
-- column valid with the zero-stat "no armor" entry; active-run checkpoints
-- intentionally retain their original snapshots.
update public.player_arpg_loadouts
set armor_id = 'leather-armor'
where armor_id is distinct from 'leather-armor';

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
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  if pg_catalog.jsonb_typeof(target_config) is distinct from 'object' then
    raise exception 'Configuração de personagem inválida' using errcode = '22023';
  end if;

  if (select count(*) from pg_catalog.jsonb_object_keys(target_config)) <> 7
    or not (target_config ?& array[
      'legendId', 'favoriteLegendId', 'skin', 'hair', 'outfit', 'armor', 'accent'
    ]::text[])
    or not coalesce(target_config ->> 'legendId' = any(array[
      'curupira', 'iara', 'boto', 'kappa', 'raiju', 'amarok', 'kelpie',
      'mapinguari', 'ahuizotl', 'ratatoskr', 'carbunclo', 'alicanto', 'yeti'
    ]::text[]), false)
    or not (
      target_config -> 'favoriteLegendId' = 'null'::jsonb
      or coalesce(target_config ->> 'favoriteLegendId' = any(array[
        'curupira', 'iara', 'boto', 'kappa', 'raiju', 'amarok', 'kelpie',
        'mapinguari', 'ahuizotl', 'ratatoskr', 'carbunclo', 'alicanto', 'yeti'
      ]::text[]), false)
    )
    or not coalesce(target_config ->> 'skin' = any(array['amber', 'copper', 'umber', 'rose']::text[]), false)
    or not coalesce(target_config ->> 'hair' = any(array['braids', 'short', 'waves', 'mohawk']::text[]), false)
    or not coalesce(target_config ->> 'outfit' = any(array['traveler', 'scholar', 'ranger', 'merchant']::text[]), false)
    or not coalesce(target_config ->> 'armor' = any(array['none', 'leather', 'runic', 'guardian']::text[]), false)
    or not coalesce(target_config ->> 'accent' = any(array['gold', 'emerald', 'azure', 'crimson']::text[]), false)
  then
    raise exception 'Configuração de personagem inválida' using errcode = '22023';
  end if;

  active_legend_id := target_config ->> 'legendId';
  favorite_legend_id := target_config ->> 'favoriteLegendId';

  if active_legend_id <> 'curupira' and not exists (
    select 1
    from public.inventory_items as inventory
    where inventory.user_id = player_id
      and inventory.item_key = 'legend-' || active_legend_id
      and inventory.quantity > 0
  ) then
    raise exception 'Você ainda não possui esta lenda' using errcode = '22023';
  end if;

  if favorite_legend_id is not null
    and favorite_legend_id <> 'curupira'
    and not exists (
      select 1
      from public.inventory_items as inventory
      where inventory.user_id = player_id
        and inventory.item_key = 'legend-' || favorite_legend_id
        and inventory.quantity > 0
    ) then
    raise exception 'Você ainda não possui sua lenda favorita' using errcode = '22023';
  end if;

  if target_config ->> 'armor' in ('runic', 'guardian') and not exists (
    select 1
    from public.inventory_items as inventory
    where inventory.user_id = player_id
      and inventory.item_key = (target_config ->> 'armor') || '-armor'
      and inventory.quantity > 0
  ) then
    raise exception 'Esta armadura ainda não foi encontrada' using errcode = '22023';
  end if;

  update public.profiles as profile
  set avatar_config = target_config
  where profile.id = player_id;
  if not found then
    raise exception 'Perfil não encontrado' using errcode = 'P0002';
  end if;
  return target_config;
end;
$$;

revoke all on function private.save_avatar_config(jsonb) from public, anon;
grant execute on function private.save_avatar_config(jsonb) to authenticated, service_role;

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
  favorite_legend_id text;
  ability_ids text[];
  signature_ability_ids text[];
begin
  select coalesce(profile.avatar_config, pg_catalog.jsonb_build_object(
    'legendId', 'curupira', 'favoriteLegendId', 'curupira',
    'skin', 'copper', 'hair', 'braids', 'outfit', 'traveler',
    'armor', 'none', 'accent', 'gold'
  ))
  into avatar
  from public.profiles as profile
  where profile.id = player_id;

  if avatar is null then
    raise exception 'Perfil do jogador não encontrado' using errcode = 'P0002';
  end if;
  if pg_catalog.jsonb_typeof(avatar) is distinct from 'object' then
    raise exception 'A aparência salva do jogador é inválida' using errcode = '22023';
  end if;
  if (select count(*) from pg_catalog.jsonb_object_keys(avatar)) <> 7
    or not (avatar ?& array[
      'legendId', 'favoriteLegendId', 'skin', 'hair', 'outfit', 'armor', 'accent'
    ]::text[])
    or not coalesce(avatar ->> 'legendId' = any(array[
      'curupira', 'iara', 'boto', 'kappa', 'raiju', 'amarok', 'kelpie',
      'mapinguari', 'ahuizotl', 'ratatoskr', 'carbunclo', 'alicanto', 'yeti'
    ]::text[]), false)
    or not (
      avatar -> 'favoriteLegendId' = 'null'::jsonb
      or coalesce(avatar ->> 'favoriteLegendId' = any(array[
        'curupira', 'iara', 'boto', 'kappa', 'raiju', 'amarok', 'kelpie',
        'mapinguari', 'ahuizotl', 'ratatoskr', 'carbunclo', 'alicanto', 'yeti'
      ]::text[]), false)
    )
    or not coalesce(avatar ->> 'skin' = any(array['amber', 'copper', 'umber', 'rose']::text[]), false)
    or not coalesce(avatar ->> 'hair' = any(array['braids', 'short', 'waves', 'mohawk']::text[]), false)
    or not coalesce(avatar ->> 'outfit' = any(array['traveler', 'scholar', 'ranger', 'merchant']::text[]), false)
    or not coalesce(avatar ->> 'armor' = any(array['none', 'leather', 'runic', 'guardian']::text[]), false)
    or not coalesce(avatar ->> 'accent' = any(array['gold', 'emerald', 'azure', 'crimson']::text[]), false)
  then
    raise exception 'A aparência salva do jogador é inválida' using errcode = '22023';
  end if;

  active_legend_id := avatar ->> 'legendId';
  favorite_legend_id := avatar ->> 'favoriteLegendId';
  if active_legend_id <> 'curupira' and not exists (
    select 1
    from public.inventory_items as inventory
    where inventory.user_id = player_id
      and inventory.item_key = 'legend-' || active_legend_id
      and inventory.quantity > 0
  ) then
    raise exception 'O jogador não possui a lenda ativa' using errcode = '42501';
  end if;
  if favorite_legend_id is not null
    and favorite_legend_id <> 'curupira'
    and not exists (
      select 1
      from public.inventory_items as inventory
      where inventory.user_id = player_id
        and inventory.item_key = 'legend-' || favorite_legend_id
        and inventory.quantity > 0
    ) then
    raise exception 'O jogador não possui a lenda favorita' using errcode = '42501';
  end if;

  select loadout.ability_ids
  into ability_ids
  from public.player_arpg_loadouts as loadout
  where loadout.user_id = player_id;

  if not found then
    raise exception 'O jogador precisa salvar dois poderes no Arquivo' using errcode = '22023';
  end if;
  if pg_catalog.cardinality(ability_ids) is distinct from 2
    or pg_catalog.array_position(ability_ids, null) is not null
    or ability_ids[1] = ability_ids[2]
    or not (ability_ids <@ array[
      'ancestral-roots', 'boitata-flame', 'saci-whirlwind', 'iara-song',
      'caipora-arrow', 'kappa-splash', 'kelpie-surge', 'tengu-gust',
      'banshee-wail', 'medusa-gaze', 'kraken-grasp', 'simurgh-renewal',
      'roc-horizon-storm'
    ]::text[]) then
    raise exception 'O loadout precisa ter dois poderes conhecidos e diferentes' using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.unnest(ability_ids) as selected(card_id)
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

  signature_ability_ids := case active_legend_id
    when 'curupira' then array['ancestral-roots', 'boitata-flame']::text[]
    when 'iara' then array['iara-song', 'simurgh-renewal']::text[]
    when 'boto' then array['saci-whirlwind', 'kelpie-surge']::text[]
    when 'kappa' then array['kappa-splash', 'kelpie-surge']::text[]
    when 'raiju' then array['roc-horizon-storm', 'boitata-flame']::text[]
    when 'amarok' then array['banshee-wail', 'medusa-gaze']::text[]
    when 'kelpie' then array['kelpie-surge', 'iara-song']::text[]
    when 'mapinguari' then array['medusa-gaze', 'kraken-grasp']::text[]
    when 'ahuizotl' then array['kraken-grasp', 'kelpie-surge']::text[]
    when 'ratatoskr' then array['caipora-arrow', 'saci-whirlwind']::text[]
    when 'carbunclo' then array['boitata-flame', 'simurgh-renewal']::text[]
    when 'alicanto' then array['roc-horizon-storm', 'simurgh-renewal']::text[]
    when 'yeti' then array['banshee-wail', 'kappa-splash']::text[]
    else null
  end;

  -- The pair is exact; allow the two slots to be reversed.
  if signature_ability_ids is null or not (
    (ability_ids[1] = signature_ability_ids[1] and ability_ids[2] = signature_ability_ids[2])
    or (ability_ids[1] = signature_ability_ids[2] and ability_ids[2] = signature_ability_ids[1])
  ) then
    raise exception 'Os poderes equipados não correspondem à lenda ativa' using errcode = '22023';
  end if;

  return pg_catalog.jsonb_build_object(
    'avatarConfig', avatar,
    'abilityIds', pg_catalog.to_jsonb(ability_ids)
  );
end;
$$;

revoke all on function private.active_avatar_power_snapshot(uuid) from public, anon, authenticated;
grant execute on function private.active_avatar_power_snapshot(uuid) to service_role;
