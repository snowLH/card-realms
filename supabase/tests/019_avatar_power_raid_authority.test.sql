begin;

create extension if not exists pgtap with schema extensions;
select plan(43);

select has_column(
  'public', 'raid_rooms', 'gameplay_mode',
  'Raid rooms store a frozen gameplay mode'
);
select has_column(
  'public', 'raid_rooms', 'gameplay_version',
  'Raid rooms store a frozen gameplay version'
);
select has_column(
  'public', 'raid_participants', 'combat_snapshot',
  'classic Raid participants store their avatar and signature abilities'
);
select has_column(
  'public', 'raid_reward_ledger', 'coins_awarded',
  'Raid reward rows record awarded coins'
);
select has_column(
  'public', 'raid_reward_ledger', 'xp_awarded',
  'Raid reward rows record awarded experience'
);

select ok(
  has_function_privilege('authenticated', 'public.create_raid_room(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.join_raid_room(text)', 'execute')
  and has_function_privilege('authenticated', 'public.set_raid_ready(uuid,boolean)', 'execute')
  and not has_function_privilege('anon', 'public.create_raid_room(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.join_raid_room(text)', 'execute'),
  'authenticated players can use lobby RPCs and anonymous callers cannot'
);
select ok(
  not has_function_privilege('authenticated', 'public.start_raid_room(uuid,jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.commit_raid_action(uuid,uuid,integer,uuid,text,jsonb,jsonb,jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.grant_raid_mythic_rewards(uuid)', 'execute'),
  'clients cannot call the Raid start, commit, or reward authorities directly'
);
select ok(
  has_function_privilege('service_role', 'public.start_raid_room(uuid,jsonb)', 'execute')
  and has_function_privilege('service_role', 'public.commit_raid_action(uuid,uuid,integer,uuid,text,jsonb,jsonb,jsonb)', 'execute')
  and has_function_privilege('service_role', 'public.grant_raid_mythic_rewards(uuid)', 'execute'),
  'the trusted server can start, commit, and reward Raid rooms'
);
select ok(
  not has_function_privilege('anon', 'public.create_raid_room(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.start_raid_room(uuid,jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.commit_raid_action(uuid,uuid,integer,uuid,text,jsonb,jsonb,jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.grant_raid_mythic_rewards(uuid)', 'execute'),
  'anonymous callers cannot create, start, commit, or grant Raid rewards'
);
select ok(
  not has_function_privilege('authenticated', 'private.active_avatar_power_snapshot(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.arpg_raid_loadout_snapshot(uuid)', 'execute')
  and has_function_privilege('service_role', 'private.active_avatar_power_snapshot(uuid)', 'execute')
  and has_function_privilege('service_role', 'private.arpg_raid_loadout_snapshot(uuid)', 'execute'),
  'only the trusted server can call the private Raid snapshot helpers'
);

insert into auth.users (id, email) values
  ('ab000001-0000-4000-8000-000000000001', 'raid-authority-host@test.invalid'),
  ('ab000002-0000-4000-8000-000000000002', 'raid-authority-guest@test.invalid');

update public.profiles
set avatar_config = jsonb_build_object(
  'legendId', 'curupira', 'favoriteLegendId', 'curupira',
  'skin', 'copper', 'hair', 'mohawk', 'outfit', 'ranger',
  'armor', 'none', 'accent', 'crimson'
)
where id in (
  'ab000001-0000-4000-8000-000000000001',
  'ab000002-0000-4000-8000-000000000002'
);
insert into public.raid_events (
  id, slug, title, boss_creature_id, starts_at, ends_at, min_players,
  max_players, boss_config, rewards, is_published
) values
  (
    'ae000000-0000-4000-8000-000000000001',
    'raid-authority-avatar-test', 'Avatar Raid authority fixture', 'roc',
    now() - interval '1 day', now() + interval '1 day', 2, 2,
    '{"gameplayMode":"avatar"}'::jsonb,
    '{"coins":321,"xp":123}'::jsonb,
    true
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ab000001-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.save_arpg_loadout(
      'forest-bow', 'leather-armor', 'cartographer-compass',
      array['curupira-root-snare','curupira-ember-arrow']::text[]
    )$$,
  'the host saves the active Curupira signature pair'
);
select set_config('request.jwt.claim.sub', 'ab000002-0000-4000-8000-000000000002', true);
select lives_ok(
  $$select public.save_arpg_loadout(
      'forest-bow', 'leather-armor', 'cartographer-compass',
      array['curupira-root-snare','curupira-ember-arrow']::text[]
    )$$,
  'the guest saves the active Curupira signature pair'
);
reset role;

create temp table raid_authority_fixture (
  host_id uuid not null,
  guest_id uuid not null,
  avatar_event_id uuid not null,
  avatar_room_id uuid,
  avatar_invite_code text,
  avatar_initial_state jsonb,
  legacy_active_room_id uuid,
  legacy_lobby_room_id uuid,
  inventory_before jsonb,
  creatures_before jsonb,
  coins_before bigint,
  xp_before bigint
);

insert into pg_temp.raid_authority_fixture (
  host_id, guest_id, avatar_event_id,
  legacy_active_room_id, legacy_lobby_room_id
) values (
  'ab000001-0000-4000-8000-000000000001',
  'ab000002-0000-4000-8000-000000000002',
  'ae000000-0000-4000-8000-000000000001',
  'ac000000-0000-4000-8000-000000000001',
  'ac000000-0000-4000-8000-000000000002'
);

select set_config('request.jwt.claim.sub', 'ab000001-0000-4000-8000-000000000001', true);
with created as materialized (
  select public.create_raid_room(fixture.avatar_event_id) as payload
  from pg_temp.raid_authority_fixture as fixture
)
update pg_temp.raid_authority_fixture as fixture
set avatar_room_id = (created.payload ->> 'roomId')::uuid,
    avatar_invite_code = created.payload ->> 'inviteCode'
from created;

select set_config('request.jwt.claim.sub', 'ab000002-0000-4000-8000-000000000002', true);
select public.join_raid_room(avatar_invite_code)
from pg_temp.raid_authority_fixture;

select set_config('request.jwt.claim.sub', 'ab000001-0000-4000-8000-000000000001', true);
select public.set_raid_ready(avatar_room_id, true) from pg_temp.raid_authority_fixture;
select set_config('request.jwt.claim.sub', 'ab000002-0000-4000-8000-000000000002', true);
select public.set_raid_ready(avatar_room_id, true) from pg_temp.raid_authority_fixture;
reset role;

select is(
  (select count(*)::bigint
   from public.raid_rooms as room
   join pg_temp.raid_authority_fixture as fixture on room.id = fixture.avatar_room_id
   where room.gameplay_mode = 'avatar' and room.gameplay_version = 2),
  1::bigint,
  'a new classic room freezes avatar mode at gameplay version 2'
);
select is(
  (select count(*)::bigint
   from public.raid_participants as participant
   join public.profiles as profile on profile.id = participant.user_id
   join pg_temp.raid_authority_fixture as fixture on participant.room_id = fixture.avatar_room_id
   where participant.combat_snapshot is not null
     and participant.team_snapshot = 'null'::jsonb
     and jsonb_array_length(participant.combat_snapshot -> 'abilityIds') = 2
     and participant.combat_snapshot -> 'avatarConfig' is not distinct from profile.avatar_config
     and participant.combat_snapshot -> 'abilityIds' = to_jsonb(
       (select loadout.ability_ids from public.player_arpg_loadouts as loadout
        where loadout.user_id = participant.user_id)
     )),
  2::bigint,
  'both classic participants freeze the saved avatar and its two signature abilities'
);
select throws_ok(
  $$update public.raid_rooms as room
    set gameplay_mode = 'legacy'
    from pg_temp.raid_authority_fixture as fixture
    where room.id = fixture.avatar_room_id$$,
  '22023', null,
  'a room cannot change its frozen gameplay mode'
);
select throws_ok(
  $$update public.raid_rooms as room
    set gameplay_version = 1
    from pg_temp.raid_authority_fixture as fixture
    where room.id = fixture.avatar_room_id$$,
  '22023', null,
  'a room cannot change its frozen gameplay version'
);

insert into public.raid_rooms (
  id, event_id, host_id, invite_code, status, state, gameplay_mode, gameplay_version
)
select fixture.legacy_active_room_id, fixture.avatar_event_id, fixture.host_id,
  'LGCYACT1', 'active', '{"legacy":true}'::jsonb, 'legacy', 1
from pg_temp.raid_authority_fixture as fixture;
insert into public.raid_participants (room_id, user_id, seat, team_snapshot)
select fixture.legacy_active_room_id, fixture.host_id, 1,
  '["a","b","c","d","e","f"]'::jsonb
from pg_temp.raid_authority_fixture as fixture;
insert into public.raid_rooms (
  id, event_id, host_id, invite_code, status, gameplay_mode, gameplay_version
)
select fixture.legacy_lobby_room_id, fixture.avatar_event_id, fixture.host_id,
  'LGCYLOB1', 'lobby', 'legacy', 1
from pg_temp.raid_authority_fixture as fixture;
insert into public.raid_participants (room_id, user_id, seat, team_snapshot)
select fixture.legacy_lobby_room_id, fixture.host_id, 1,
  '["old-a","old-b","old-c","old-d","old-e","old-f"]'::jsonb
from pg_temp.raid_authority_fixture as fixture;

select is(
  (select room.gameplay_mode || ':' || room.gameplay_version::text || ':' || room.state::text
   from public.raid_rooms as room
   join pg_temp.raid_authority_fixture as fixture on room.id = fixture.legacy_active_room_id),
  'legacy:1:{"legacy": true}'::text,
  'an in-progress historical room retains its legacy state and version'
);
select is(
  (select participant.team_snapshot
   from public.raid_participants as participant
   join pg_temp.raid_authority_fixture as fixture on participant.room_id = fixture.legacy_active_room_id),
  '["a","b","c","d","e","f"]'::jsonb,
  'an archived historical room keeps its original team snapshot'
);
select set_config('request.jwt.claim.sub', 'ab000001-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.set_raid_ready(fixture.legacy_lobby_room_id, true)
    from pg_temp.raid_authority_fixture as fixture$$,
  '22023', null,
  'a legacy lobby cannot enter the new ready flow'
);
select throws_ok(
  $$select public.start_raid_room(fixture.legacy_lobby_room_id, '{}'::jsonb)
    from pg_temp.raid_authority_fixture as fixture$$,
  'P0002', null,
  'a legacy lobby cannot start under the new authority'
);
select throws_ok(
  $$select public.commit_raid_action(
      fixture.legacy_active_room_id, fixture.host_id, 0,
      'af000000-0000-4000-8000-000000000001', 'pass', '{}'::jsonb, '{}'::jsonb, '[]'::jsonb
    ) from pg_temp.raid_authority_fixture as fixture$$,
  '22023', null,
  'an active historical room cannot accept new authoritative actions'
);

update public.raid_events as event
set boss_config = '{"gameplayMode":"legacy"}'::jsonb
from pg_temp.raid_authority_fixture as fixture
where event.id = fixture.avatar_event_id;
select is(
  (select room.gameplay_mode || ':' || room.gameplay_version::text
   from public.raid_rooms as room
   join pg_temp.raid_authority_fixture as fixture on room.id = fixture.avatar_room_id),
  'avatar:2'::text,
  'changing event configuration does not change a room already frozen as avatar mode'
);

update pg_temp.raid_authority_fixture as fixture
set avatar_initial_state = jsonb_build_object(
  'version', 2,
  'roomId', fixture.avatar_room_id::text,
  'eventId', fixture.avatar_event_id::text,
  'status', 'active',
  'bossCreatureId', event.boss_creature_id,
  'boss', jsonb_build_object('catalogId', event.boss_creature_id),
  'log', '[]'::jsonb,
  'players', (
    select jsonb_agg(jsonb_build_object(
      'id', participant.user_id::text,
      'seat', participant.seat,
      'side', jsonb_build_object(
        'id', participant.user_id::text,
        'kind', 'player',
        'avatarConfig', participant.combat_snapshot -> 'avatarConfig',
        'abilityIds', participant.combat_snapshot -> 'abilityIds'
      )
    ) order by participant.seat)
    from public.raid_participants as participant
    where participant.room_id = fixture.avatar_room_id
  )
)
from public.raid_events as event
where event.id = fixture.avatar_event_id;

select throws_ok(
  $$select public.start_raid_room(
      fixture.avatar_room_id,
      jsonb_set(fixture.avatar_initial_state, '{players,0,side,kind}', '"enemy"'::jsonb, true)
    ) from pg_temp.raid_authority_fixture as fixture$$,
  '22023', null,
  'avatar Raid start rejects a side that is not the participant player'
);
select throws_ok(
  $$select public.start_raid_room(
      fixture.avatar_room_id,
      jsonb_set(fixture.avatar_initial_state, '{players,0,side,abilityIds}', '["curupira-root-snare"]'::jsonb, true)
    ) from pg_temp.raid_authority_fixture as fixture$$,
  '22023', null,
  'avatar Raid start rejects powers that diverge from the two-power snapshot'
);
select throws_ok(
  $$select public.start_raid_room(
      fixture.avatar_room_id,
      jsonb_set(fixture.avatar_initial_state, '{players,0,side,avatarConfig}', '{}'::jsonb, true)
    ) from pg_temp.raid_authority_fixture as fixture$$,
  '22023', null,
  'avatar Raid start rejects appearance data that diverges from the saved snapshot'
);
select throws_ok(
  $$select public.start_raid_room(
      fixture.avatar_room_id,
      jsonb_set(fixture.avatar_initial_state, '{bossCreatureId}', '"wrong-boss"'::jsonb, true)
    ) from pg_temp.raid_authority_fixture as fixture$$,
  '22023', null,
  'avatar Raid start rejects a boss that differs from the event'
);
select throws_ok(
  $$select public.start_raid_room(
      fixture.avatar_room_id,
      jsonb_set(fixture.avatar_initial_state, '{status}', '"pending"'::jsonb, true)
    ) from pg_temp.raid_authority_fixture as fixture$$,
  '22023', null,
  'Raid start rejects an invalid initial status'
);
select lives_ok(
  $$select public.start_raid_room(fixture.avatar_room_id, fixture.avatar_initial_state)
    from pg_temp.raid_authority_fixture as fixture$$,
  'a ready avatar room starts from the frozen avatar and power snapshots'
);

select throws_ok(
  $$select public.commit_raid_action(
      fixture.avatar_room_id, fixture.host_id, 1,
      'af000000-0000-4000-8000-000000000002', 'attack',
      jsonb_build_object('roomId', fixture.avatar_room_id::text, 'expectedVersion', 1,
        'actionId', 'af000000-0000-4000-8000-000000000002', 'action', 'attack'),
      fixture.avatar_initial_state, '[]'::jsonb
    ) from pg_temp.raid_authority_fixture as fixture$$,
  '22023', null,
  'avatar Raids reject action types outside their frozen contract'
);
select throws_ok(
  $$select public.commit_raid_action(
      fixture.avatar_room_id, fixture.host_id, 1,
      'af000000-0000-4000-8000-000000000003', 'pass',
      jsonb_build_object('roomId', fixture.avatar_room_id::text, 'expectedVersion', 1,
        'actionId', 'af000000-0000-4000-8000-000000000003', 'action', 'pass'),
      jsonb_set(fixture.avatar_initial_state, '{status}', '"paused"'::jsonb, true),
      '[]'::jsonb
    ) from pg_temp.raid_authority_fixture as fixture$$,
  '22023', null,
  'Raid commits reject statuses outside active, victory, or defeat'
);
select throws_ok(
  $$select public.commit_raid_action(
      fixture.avatar_room_id, fixture.host_id, 1,
      'af000000-0000-4000-8000-000000000007', 'pass',
      jsonb_build_object('roomId', fixture.avatar_room_id::text, 'expectedVersion', 1,
        'actionId', 'af000000-0000-4000-8000-000000000007', 'action', 'pass'),
      fixture.avatar_initial_state - 'status',
      '[]'::jsonb
    ) from pg_temp.raid_authority_fixture as fixture$$,
  '22023', null,
  'Raid commits reject a result state with no status'
);
select throws_ok(
  $$select public.commit_raid_action(
      fixture.avatar_room_id, fixture.host_id, 1,
      'af000000-0000-4000-8000-000000000004', 'pass',
      jsonb_build_object('roomId', fixture.avatar_room_id::text, 'expectedVersion', 1,
        'actionId', 'af000000-0000-4000-8000-000000000004', 'action', 'pass'),
      jsonb_set(fixture.avatar_initial_state, '{players,0,side,id}', '"other-player"'::jsonb, true),
      '[]'::jsonb
    ) from pg_temp.raid_authority_fixture as fixture$$,
  '22023', null,
  'avatar Raid commits reject a side that no longer identifies its participant'
);

select lives_ok(
  $$select public.commit_raid_action(
      fixture.avatar_room_id, fixture.host_id, 1,
      'af000000-0000-4000-8000-000000000005', 'pass',
      jsonb_build_object('roomId', fixture.avatar_room_id::text, 'expectedVersion', 1,
        'actionId', 'af000000-0000-4000-8000-000000000005', 'action', 'pass'),
      jsonb_set(
        jsonb_set(fixture.avatar_initial_state, '{status}', '"victory"'::jsonb, true),
        '{players,0,contribution}', '{"actions":1,"damage":20}'::jsonb, true
      ),
      '[]'::jsonb
    ) from pg_temp.raid_authority_fixture as fixture$$,
  'a valid avatar action commits the victory through the server authority'
);
select is(
  (select room.status || ':' || room.version::text
   from public.raid_rooms as room
   join pg_temp.raid_authority_fixture as fixture on room.id = fixture.avatar_room_id),
  'victory:2'::text,
  'a successful commit advances the room version exactly once'
);
select is(
  (select public.commit_raid_action(
      fixture.avatar_room_id, fixture.host_id, 1,
      'af000000-0000-4000-8000-000000000005', 'pass',
      jsonb_build_object('roomId', fixture.avatar_room_id::text, 'expectedVersion', 1,
        'actionId', 'af000000-0000-4000-8000-000000000005', 'action', 'pass'),
      jsonb_set(
        jsonb_set(fixture.avatar_initial_state, '{status}', '"victory"'::jsonb, true),
        '{players,0,contribution}', '{"actions":1,"damage":20}'::jsonb, true
      ),
      '[]'::jsonb
    )
    from pg_temp.raid_authority_fixture as fixture),
  (select action.result
   from public.raid_actions as action
   join pg_temp.raid_authority_fixture as fixture
     on action.room_id = fixture.avatar_room_id
   where action.user_id = fixture.host_id
     and action.client_action_id = 'af000000-0000-4000-8000-000000000005'),
  'same actor, action type, and payload replay the original committed result'
);
select throws_ok(
  $$select public.commit_raid_action(
      fixture.avatar_room_id, fixture.host_id, 1,
      'af000000-0000-4000-8000-000000000005', 'pass',
      jsonb_build_object('roomId', fixture.avatar_room_id::text, 'expectedVersion', 1,
        'actionId', 'af000000-0000-4000-8000-000000000005', 'action', 'ability', 'slot', 0),
      fixture.avatar_initial_state, '[]'::jsonb
    ) from pg_temp.raid_authority_fixture as fixture$$,
  '22023', null,
  'reusing an action ID with a divergent payload is rejected'
);

update pg_temp.raid_authority_fixture as fixture
set inventory_before = (
      select coalesce(jsonb_agg(jsonb_build_object(
        'itemKey', inventory.item_key,
        'quantity', inventory.quantity,
        'metadata', inventory.metadata
      ) order by inventory.item_key), '[]'::jsonb)
      from public.inventory_items as inventory
      where inventory.user_id = fixture.host_id
    ),
    creatures_before = (
      select coalesce(jsonb_agg(jsonb_build_object(
        'creatureId', creature.creature_id,
        'acquiredFrom', creature.acquired_from,
        'level', creature.level,
        'xp', creature.xp
      ) order by creature.creature_id, creature.acquired_at), '[]'::jsonb)
      from public.player_creatures as creature
      where creature.user_id = fixture.host_id
    ),
    coins_before = profile.coins,
    xp_before = profile.xp
from public.profiles as profile
where profile.id = fixture.host_id;

update public.raid_events as event
set rewards = '{"coins":2147483648,"xp":2147483648}'::jsonb
from pg_temp.raid_authority_fixture as fixture
where event.id = fixture.avatar_event_id;

select is(
  (select public.grant_raid_mythic_rewards(fixture.avatar_room_id)
   from pg_temp.raid_authority_fixture as fixture),
  '{"grantedCount":1,"coinsGranted":10000,"xpGranted":10000}'::jsonb,
  'Raid rewards above integer range clamp to 10000 coins and XP'
);
select is(
  (select public.grant_raid_mythic_rewards(fixture.avatar_room_id)
   from pg_temp.raid_authority_fixture as fixture),
  '{"grantedCount":0,"coinsGranted":0,"xpGranted":0}'::jsonb,
  'replaying Raid rewards does not grant currency or XP twice'
);
select ok(
  exists (
    select 1
    from public.raid_reward_ledger as reward
    join pg_temp.raid_authority_fixture as fixture
      on reward.room_id = fixture.avatar_room_id
    where reward.player_id = fixture.host_id
      and reward.reward_type = 'currency_reward'
      and reward.coins_awarded = 10000
      and reward.xp_awarded = 10000
      and reward.creature_card_id is null
      and reward.ability_card_id is null
  )
  and not exists (
    select 1
    from public.raid_reward_ledger as reward
    join pg_temp.raid_authority_fixture as fixture
      on reward.room_id = fixture.avatar_room_id
    where reward.reward_type <> 'currency_reward'
  ),
  'the Raid ledger records only currency and XP, without permanent creature or ability rewards'
);
select is(
  (select profile.coins - fixture.coins_before
   from public.profiles as profile
   join pg_temp.raid_authority_fixture as fixture on profile.id = fixture.host_id),
  10000::bigint,
  'Raid currency is added to the player wallet'
);
select is(
  (select profile.xp - fixture.xp_before
   from public.profiles as profile
   join pg_temp.raid_authority_fixture as fixture on profile.id = fixture.host_id),
  10000::bigint,
  'Raid experience is added to the player profile'
);
select is(
  (select coalesce(jsonb_agg(jsonb_build_object(
      'creatureId', creature.creature_id,
      'acquiredFrom', creature.acquired_from,
      'level', creature.level,
      'xp', creature.xp
    ) order by creature.creature_id, creature.acquired_at), '[]'::jsonb)
   from public.player_creatures as creature
   join pg_temp.raid_authority_fixture as fixture on creature.user_id = fixture.host_id),
  (select fixture.creatures_before from pg_temp.raid_authority_fixture as fixture),
  'Raid victory does not add a permanent creature to the player collection'
);
select is(
  (select coalesce(jsonb_agg(jsonb_build_object(
      'itemKey', inventory.item_key,
      'quantity', inventory.quantity,
      'metadata', inventory.metadata
    ) order by inventory.item_key), '[]'::jsonb)
   from public.inventory_items as inventory
   join pg_temp.raid_authority_fixture as fixture on inventory.user_id = fixture.host_id),
  (select fixture.inventory_before from pg_temp.raid_authority_fixture as fixture),
  'Raid victory does not alter the player inventory or Legend entitlement'
);

select * from finish();
rollback;
