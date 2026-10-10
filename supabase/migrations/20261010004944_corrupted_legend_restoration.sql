-- Forgotten Legends: code-only migration, never auto-applied by the application.
create table if not exists public.player_boss_progress (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  purified_boss_ids text[] not null default '{}',
  unlocked_legend_ids text[] not null default '{}',
  seen_boss_intro_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.player_boss_progress enable row level security;
create policy boss_progress_owner_read on public.player_boss_progress for select
  to authenticated using ((select auth.uid()) = user_id);
revoke all on public.player_boss_progress from public, anon, authenticated;
grant select on public.player_boss_progress to authenticated;
grant all on public.player_boss_progress to service_role;

-- No old defeat record is promoted to a purification entitlement.
insert into public.player_boss_progress(user_id) select id from public.profiles
on conflict (user_id) do nothing;

create or replace function private.corrupted_legend_progress(target_player_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'purifiedBossIds', coalesce(p.purified_boss_ids, '{}'::text[]),
    'unlockedLegendIds', coalesce(p.unlocked_legend_ids, '{}'::text[]),
    'seenBossIntroIds', coalesce(p.seen_boss_intro_ids, '{}'::text[])
  ) from (select target_player_id as id) as requested
  left join public.player_boss_progress p on p.user_id = requested.id;
$$;
revoke all on function private.corrupted_legend_progress(uuid) from public, anon, authenticated;
grant execute on function private.corrupted_legend_progress(uuid) to service_role;
create or replace function public.get_corrupted_legend_progress(target_player_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.corrupted_legend_progress(target_player_id);
$$;
revoke all on function public.get_corrupted_legend_progress(uuid) from public, anon, authenticated;
grant execute on function public.get_corrupted_legend_progress(uuid) to service_role;

-- Service-only adapter. Proof is reconstructed from an owned run or the shared
-- room; there is no client-supplied boss ID, HP, unlock ID, or completion flag.
create or replace function private.record_corrupted_legend_progress(
  target_player_id uuid, target_run_id uuid, target_room_id uuid, target_restore boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  stored jsonb;
  encounter jsonb;
  region_id text;
  expected_boss text;
  eligible_ids uuid[];
  seen_ids uuid[];
  player_id uuid;
  boss_id text;
  legend_id text;
  grant_item_key text;
begin
  if target_player_id is null or (target_run_id is null) = (target_room_id is null) then
    raise exception 'Escopo de encontro inválido' using errcode = '22023';
  end if;
  if target_run_id is not null then
    select r.checkpoint, r.expedition_id into stored, region_id from private.arpg_runs r
      where r.run_id = target_run_id and r.user_id = target_player_id
      and r.checkpoint -> 'serverCombatState' ->> 'roomId' = r.boss_room_id
      for update;
    encounter := stored -> 'serverCombatState' -> 'bossEncounter';
    eligible_ids := array[target_player_id];
    seen_ids := eligible_ids;
  else
    select r.state into stored from public.raid_rooms r
      where r.id = target_room_id and exists (
        select 1 from public.raid_participants p where p.room_id = r.id and p.user_id = target_player_id
      ) for update;
    encounter := stored -> 'bossEncounter';
    region_id := stored -> 'dungeon' ->> 'regionId';
    select array_agg((p ->> 'id')::uuid order by p ->> 'id') into seen_ids
      from jsonb_array_elements(stored -> 'players') p
      where encounter -> 'participantIds' ? (p ->> 'id')
      and exists (select 1 from public.raid_participants rp where rp.room_id = target_room_id and rp.user_id = (p ->> 'id')::uuid);
    select array_agg((p ->> 'id')::uuid order by p ->> 'id') into eligible_ids
      from jsonb_array_elements(stored -> 'players') p
      where (p ->> 'id')::uuid = any(seen_ids)
      and coalesce((p -> 'contribution' ->> 'actions')::int, 0) > 0
      and coalesce((p -> 'contribution' ->> 'damage')::int, 0) + coalesce((p -> 'contribution' ->> 'healing')::int, 0) > 0;
  end if;
  expected_boss := case region_id when 'montanhas-runicas' then 'king-arthur'
    when 'arquipelago-das-mares' then 'deep-iara' when 'mata-encantada' then 'ancestral-curupira' else null end;
  boss_id := encounter ->> 'bossId';
  if encounter is null or expected_boss is null or boss_id is distinct from expected_boss
    or coalesce(encounter ->> 'state', '') not in ('COMBAT','DEFEATED','PURIFICATION','RESTORED','UNLOCK','CLEARED') then
    raise exception 'Encontro autoritativo não confirmado' using errcode = '42501';
  end if;
  if target_restore and (
    coalesce(encounter ->> 'state', '') not in ('RESTORED','UNLOCK','CLEARED')
    or coalesce((encounter ->> 'hp')::int, -1) <> 0
    or coalesce((encounter ->> 'stateAtMs')::bigint, 0) < coalesce((encounter ->> 'enteredAtMs')::bigint, 0) + 7700
  ) then raise exception 'A purificação ainda não terminou' using errcode = '42501'; end if;
  legend_id := case boss_id when 'king-arthur' then 'king-arthur' else null end;
  -- Consistent profile ordering serializes entitlements across concurrent runs.
  foreach player_id in array coalesce(seen_ids, '{}'::uuid[]) loop
    perform 1 from public.profiles where id = player_id for update;
    insert into public.player_boss_progress(user_id) values(player_id) on conflict do nothing;
    update public.player_boss_progress set
      seen_boss_intro_ids = array(select distinct unnest(seen_boss_intro_ids || array[boss_id]) order by 1),
      updated_at = now() where user_id = player_id and not boss_id = any(seen_boss_intro_ids);
    if target_restore and player_id = any(eligible_ids) then
      update public.player_boss_progress set
        purified_boss_ids = array(select distinct unnest(purified_boss_ids || array[boss_id]) order by 1),
        unlocked_legend_ids = array(select distinct unnest(unlocked_legend_ids || case when legend_id is null then '{}'::text[] else array[legend_id] end) order by 1),
        updated_at = now() where user_id = player_id;
      if legend_id is not null then
        foreach grant_item_key in array array['legend-' || legend_id, 'arthur-camelot-cut', 'arthur-round-table-oath'] loop
          insert into public.inventory_items(user_id,item_key,quantity,metadata)
            values(player_id,grant_item_key,1,jsonb_build_object('source','legend_restoration','bossId',boss_id))
          on conflict(user_id,item_key) do update set quantity = greatest(public.inventory_items.quantity, 1),
            metadata = public.inventory_items.metadata || excluded.metadata, updated_at = now();
        end loop;
      end if;
    end if;
  end loop;
  return jsonb_build_object('confirmed', true, 'progress', private.corrupted_legend_progress(target_player_id));
end;
$$;
revoke all on function private.record_corrupted_legend_progress(uuid,uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function private.record_corrupted_legend_progress(uuid,uuid,uuid,boolean) to service_role;
create or replace function public.record_corrupted_legend_progress(
  target_player_id uuid, target_run_id uuid, target_room_id uuid, target_restore boolean
) returns jsonb language sql security invoker set search_path = '' as $$
  select private.record_corrupted_legend_progress(target_player_id,target_run_id,target_room_id,target_restore);
$$;
revoke all on function public.record_corrupted_legend_progress(uuid,uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.record_corrupted_legend_progress(uuid,uuid,uuid,boolean) to service_role;
create or replace function private.legend_signature_ability_ids(target_legend_id text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select catalogue.ability_ids
  from (values
    ('king-arthur', array['arthur-camelot-cut', 'arthur-round-table-oath']::text[]),
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
      'mapinguari', 'ahuizotl', 'ratatoskr', 'carbunclo', 'alicanto', 'yeti', 'king-arthur'
    ]::text[]), false)
    or not (target_config -> 'favoriteLegendId' = 'null'::jsonb or coalesce(target_config ->> 'favoriteLegendId' = any(array[
      'curupira', 'iara', 'boto', 'kappa', 'raiju', 'amarok', 'kelpie',
      'mapinguari', 'ahuizotl', 'ratatoskr', 'carbunclo', 'alicanto', 'yeti', 'king-arthur'
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


alter table public.player_arpg_loadouts drop constraint player_arpg_loadouts_ability_ids_check;

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
      'yeti-frozen-roar', 'yeti-avalanche-stomp',
      'arthur-camelot-cut', 'arthur-round-table-oath'
    ]::text[]
  );
