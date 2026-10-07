-- Boss-only legendary ARPG cards and weekly-raid mythic ability cards.
-- All high-value card IDs are selected by server-side functions, never by clients.

create or replace function private.claim_arpg_boss_card_reward(
  target_player_id uuid,
  target_run_id uuid,
  target_expedition_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_card_id text;
  existing_reward jsonb;
  reward jsonb;
begin
  if target_player_id is null or target_run_id is null then
    raise exception 'Jogador e run são obrigatórios' using errcode = '22023';
  end if;

  target_card_id := case target_expedition_id
    when 'arquipelago-das-mares' then 'kraken-grasp'
    else null
  end;

  if target_card_id is null then
    return jsonb_build_object('cardId', null, 'replayed', false);
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
    and ledger.source_type = 'arpg_boss_ability_card'
    and ledger.source_id = target_expedition_id;

  if existing_reward is not null then
    return existing_reward || jsonb_build_object('replayed', true);
  end if;

  reward := jsonb_build_object(
    'cardId', target_card_id,
    'runId', target_run_id,
    'expeditionId', target_expedition_id,
    'rarity', 'legendary'
  );

  insert into public.reward_ledger (user_id, source_type, source_id, reward)
  values (target_player_id, 'arpg_boss_ability_card', target_expedition_id, reward);

  insert into public.inventory_items (user_id, item_key, quantity, metadata)
  values (
    target_player_id,
    target_card_id,
    1,
    jsonb_build_object(
      'source', 'arpg_boss_ability_card',
      'expeditionId', target_expedition_id,
      'runId', target_run_id
    )
  )
  on conflict (user_id, item_key) do update
  set quantity = greatest(public.inventory_items.quantity, 1),
      metadata = public.inventory_items.metadata || excluded.metadata,
      updated_at = now();

  return reward || jsonb_build_object('replayed', false);
end;
$$;
revoke all on function private.claim_arpg_boss_card_reward(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function private.claim_arpg_boss_card_reward(uuid, uuid, text)
  to service_role;
create or replace function public.claim_arpg_boss_card_reward(
  target_player_id uuid,
  target_run_id uuid,
  target_expedition_id text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.claim_arpg_boss_card_reward(
    target_player_id,
    target_run_id,
    target_expedition_id
  );
$$;
revoke all on function public.claim_arpg_boss_card_reward(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_arpg_boss_card_reward(uuid, uuid, text)
  to service_role;
alter table public.raid_reward_ledger
  add column if not exists ability_card_id text;
create or replace function public.grant_raid_mythic_rewards(target_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  room public.raid_rooms;
  event public.raid_events;
  participant record;
  target_ability_card_id text;
  creature_granted_count integer := 0;
  ability_granted_count integer := 0;
begin
  select * into room
  from public.raid_rooms
  where id = target_room_id
  for update;

  if room.id is null or room.status <> 'victory' then
    raise exception 'A Raid ainda não foi vencida' using errcode = '22023';
  end if;

  select * into event
  from public.raid_events
  where id = room.event_id;

  target_ability_card_id := nullif(event.rewards ->> 'mythicAbilityCardId', '');
  if target_ability_card_id not in ('roc-horizon-storm') then
    target_ability_card_id := null;
  end if;

  for participant in
    select *
    from public.raid_participants
    where room_id = room.id
  loop
    if coalesce((participant.contribution ->> 'actions')::integer, 0) > 0 then
      insert into public.raid_reward_ledger (
        event_id, room_id, player_id, reward_id, reward_type, creature_card_id
      ) values (
        event.id, room.id, participant.user_id,
        event.slug || ':mythic-creature', 'mythical_reward', event.boss_creature_id
      )
      on conflict (event_id, player_id, reward_type) do nothing;

      if found then
        insert into public.player_creatures (user_id, creature_id, acquired_from)
        values (participant.user_id, event.boss_creature_id, 'raid:' || event.slug);
        creature_granted_count := creature_granted_count + 1;
      end if;

      if target_ability_card_id is not null then
        insert into public.raid_reward_ledger (
          event_id,
          room_id,
          player_id,
          reward_id,
          reward_type,
          ability_card_id
        ) values (
          event.id,
          room.id,
          participant.user_id,
          event.slug || ':mythic-ability',
          'mythic_ability_card',
          target_ability_card_id
        )
        on conflict (event_id, player_id, reward_type) do nothing;

        if found then
          insert into public.inventory_items (user_id, item_key, quantity, metadata)
          values (
            participant.user_id,
            target_ability_card_id,
            1,
            jsonb_build_object(
              'source', 'weekly_mythic_raid',
              'eventId', event.id,
              'raidSlug', event.slug
            )
          )
          on conflict (user_id, item_key) do update
          set quantity = greatest(public.inventory_items.quantity, 1),
              metadata = public.inventory_items.metadata || excluded.metadata,
              updated_at = now();
          ability_granted_count := ability_granted_count + 1;
        end if;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'grantedCount', creature_granted_count,
    'creatureCardId', event.boss_creature_id,
    'abilityGrantedCount', ability_granted_count,
    'abilityCardId', target_ability_card_id
  );
end;
$$;
revoke all on function public.grant_raid_mythic_rewards(uuid)
  from public, anon, authenticated;
grant execute on function public.grant_raid_mythic_rewards(uuid)
  to service_role;
update public.raid_events
set rewards = coalesce(rewards, '{}'::jsonb)
  || jsonb_build_object(
    'mythicAbilityCardId', 'roc-horizon-storm',
    'guaranteedAbilityCopies', 1
  )
where slug = 'raid-roc-2026-10-03'
  and boss_creature_id = 'roc';
