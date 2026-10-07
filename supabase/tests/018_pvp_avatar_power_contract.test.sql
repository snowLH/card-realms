begin;

create extension if not exists pgtap with schema extensions;
select plan(28);

select has_column(
  'public', 'battle_participants', 'combat_snapshot',
  'battle participants store frozen avatar and power snapshots'
);
select is(
  (select is_nullable from information_schema.columns
   where table_schema = 'public'
     and table_name = 'battle_participants'
     and column_name = 'team_snapshot'),
  'YES'::text,
  'the legacy team snapshot is nullable for new classic battles'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.battle_participants'::regclass
      and conname = 'battle_participants_team_snapshot_check'
      and convalidated
      and lower(pg_get_constraintdef(oid)) like '%team_snapshot is null%'
      and lower(pg_get_constraintdef(oid)) like '%jsonb_array_length%'
  ),
  'non-null legacy snapshots still require six-member arrays'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.battle_actions'::regclass
      and conname = 'battle_actions_action_type_check'
      and convalidated
      and pg_get_constraintdef(oid) like '%surrender%'
      and pg_get_constraintdef(oid) like '%draw_power%'
      and pg_get_constraintdef(oid) like '%ability%'
      and pg_get_constraintdef(oid) like '%concede%'
  ),
  'the action constraint keeps archived action names and accepts v3 actions'
);
select ok(
  not has_function_privilege('authenticated', 'public.start_pvp_challenge(uuid,uuid,uuid,jsonb)', 'execute'),
  'authenticated callers cannot invoke the battle creation authority directly'
);
select ok(
  has_function_privilege('service_role', 'public.start_pvp_challenge(uuid,uuid,uuid,jsonb)', 'execute'),
  'the trusted server can invoke the battle creation authority'
);
select ok(
  not has_function_privilege('authenticated', 'public.commit_pvp_action(uuid,uuid,integer,uuid,text,jsonb,jsonb,jsonb)', 'execute'),
  'authenticated callers cannot invoke the battle commit authority directly'
);
select ok(
  has_function_privilege('service_role', 'public.commit_pvp_action(uuid,uuid,integer,uuid,text,jsonb,jsonb,jsonb)', 'execute'),
  'the trusted server can invoke the battle commit authority'
);
select ok(
  not has_function_privilege('authenticated', 'private.active_avatar_power_snapshot(uuid)', 'execute'),
  'authenticated callers cannot read snapshots through the private helper'
);
select ok(
  has_function_privilege('service_role', 'private.active_avatar_power_snapshot(uuid)', 'execute'),
  'the trusted server can build the avatar and power snapshot'
);
select ok(
  has_function_privilege('authenticated', 'public.create_pvp_challenge(uuid)', 'execute'),
  'authenticated players can use the narrow challenge RPC'
);

insert into auth.users (id, email) values
  ('80000000-0000-4000-8000-000000000008', 'pvp-v3-requester@test.invalid'),
  ('90000000-0000-4000-8000-000000000009', 'pvp-v3-addressee@test.invalid'),
  ('a1000000-0000-4000-8000-000000000010', 'pvp-v3-outsider@test.invalid');

update public.profiles
set avatar_config = jsonb_build_object(
  'legendId', 'curupira', 'favoriteLegendId', 'curupira',
  'skin', 'copper', 'hair', 'mohawk', 'outfit', 'ranger',
  'armor', 'none', 'accent', 'crimson'
)
where id in (
  '80000000-0000-4000-8000-000000000008',
  '90000000-0000-4000-8000-000000000009',
  'a1000000-0000-4000-8000-000000000010'
);
insert into public.friendships (requester_id, addressee_id, status)
values (
  '80000000-0000-4000-8000-000000000008',
  '90000000-0000-4000-8000-000000000009',
  'accepted'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '80000000-0000-4000-8000-000000000008', true);
select lives_ok(
  $$select public.save_arpg_loadout(
      'forest-bow', 'leather-armor', 'cartographer-compass',
      array['curupira-root-snare','curupira-ember-arrow']::text[]
    )$$,
  'the requester saves the active Curupira signature pair'
);
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000009', true);
select lives_ok(
  $$select public.save_arpg_loadout(
      'forest-bow', 'leather-armor', 'cartographer-compass',
      array['curupira-root-snare','curupira-ember-arrow']::text[]
    )$$,
  'the addressee saves the active Curupira signature pair'
);
select set_config('request.jwt.claim.sub', '80000000-0000-4000-8000-000000000008', true);
select lives_ok(
  $$select public.create_pvp_challenge('90000000-0000-4000-8000-000000000009')$$,
  'a player with the active Legend signature pair can challenge an accepted friend'
);
select is(
  (select count(*)::bigint from public.pvp_challenges
   where requester_id = auth.uid()
     and addressee_id = '90000000-0000-4000-8000-000000000009'
     and status = 'pending'),
  1::bigint,
  'the authenticated challenge RPC creates one pending challenge'
);
reset role;

create temp table pvp_v3_fixture (
  challenge_id uuid not null,
  requester_id uuid not null,
  addressee_id uuid not null,
  outsider_id uuid not null,
  battle_id uuid not null,
  initial_state jsonb not null
);

insert into pg_temp.pvp_v3_fixture (
  challenge_id, requester_id, addressee_id, outsider_id, battle_id, initial_state
)
select
  challenge.id,
  challenge.requester_id,
  challenge.addressee_id,
  'a1000000-0000-4000-8000-000000000010'::uuid,
  'b1000000-0000-4000-8000-000000000011'::uuid,
  jsonb_build_object(
    'version', 3,
    'id', 'b1000000-0000-4000-8000-000000000011',
    'mode', 'pvp',
    'status', 'active',
    'turn', jsonb_build_object(
      'sideId', challenge.requester_id::text,
      'number', 1,
      'round', 1
    ),
    'sides', jsonb_build_array(
      jsonb_build_object(
        'id', challenge.requester_id::text,
        'name', 'Requester',
        'kind', 'player',
        'avatarConfig', requester_snapshot.snapshot -> 'avatarConfig',
        'abilityIds', requester_snapshot.snapshot -> 'abilityIds',
        'abilityCooldowns', jsonb_build_array(0, 0),
        'element', 'fire',
        'hp', 100,
        'maxHp', 100,
        'shield', 0,
        'statuses', '[]'::jsonb,
        'attachedEnergy', '[]'::jsonb,
        'energyDeck', '[]'::jsonb,
        'energyHand', '[]'::jsonb,
        'energyDiscard', '[]'::jsonb,
        'attachmentsRemaining', 1,
        'turnsStarted', 0
      ),
      jsonb_build_object(
        'id', challenge.addressee_id::text,
        'name', 'Addressee',
        'kind', 'player',
        'avatarConfig', addressee_snapshot.snapshot -> 'avatarConfig',
        'abilityIds', addressee_snapshot.snapshot -> 'abilityIds',
        'abilityCooldowns', jsonb_build_array(0, 0),
        'element', 'water',
        'hp', 100,
        'maxHp', 100,
        'shield', 0,
        'statuses', '[]'::jsonb,
        'attachedEnergy', '[]'::jsonb,
        'energyDeck', '[]'::jsonb,
        'energyHand', '[]'::jsonb,
        'energyDiscard', '[]'::jsonb,
        'attachmentsRemaining', 1,
        'turnsStarted', 0
      )
    ),
    'processedActionIds', '[]'::jsonb,
    'log', jsonb_build_array(jsonb_build_object(
      'id', 'battle-start',
      'turn', 1,
      'actorId', challenge.requester_id::text,
      'kind', 'battle_start',
      'message', 'A batalha começou.'
    ))
  )
from public.pvp_challenges as challenge
cross join lateral (
  select private.active_avatar_power_snapshot(challenge.requester_id) as snapshot
) as requester_snapshot
cross join lateral (
  select private.active_avatar_power_snapshot(challenge.addressee_id) as snapshot
) as addressee_snapshot
where challenge.requester_id = '80000000-0000-4000-8000-000000000008'
  and challenge.addressee_id = '90000000-0000-4000-8000-000000000009'
  and challenge.status = 'pending';

select throws_ok(
  $$select public.start_pvp_challenge(
      fixture.challenge_id, fixture.requester_id, fixture.battle_id, fixture.initial_state
    ) from pg_temp.pvp_v3_fixture as fixture$$,
  '42501', null,
  'only the challenged player can accept'
);
select throws_ok(
  $$select public.start_pvp_challenge(
      fixture.challenge_id, null, fixture.battle_id, fixture.initial_state
    ) from pg_temp.pvp_v3_fixture as fixture$$,
  '42501', null,
  'a missing actor ID cannot accept a challenge'
);
select throws_ok(
  $$select public.start_pvp_challenge(
      fixture.challenge_id,
      fixture.addressee_id,
      fixture.battle_id,
      fixture.initial_state - 'turn'
    ) from pg_temp.pvp_v3_fixture as fixture$$,
  '22023', null,
  'a v3 start state must identify its first-turn participant'
);
select lives_ok(
  $$select public.start_pvp_challenge(
      fixture.challenge_id, fixture.addressee_id, fixture.battle_id, fixture.initial_state
    ) from pg_temp.pvp_v3_fixture as fixture$$,
  'the challenged player can accept with the saved v3 avatar and signature abilities'
);
select is(
  (select count(*)::bigint from public.battle_participants as participant
   join pg_temp.pvp_v3_fixture as fixture on fixture.battle_id = participant.battle_id
   where participant.combat_snapshot is not null),
  2::bigint,
  'the accepted battle freezes both combat snapshots'
);
select is(
  (select count(*)::bigint from public.battle_participants as participant
   join pg_temp.pvp_v3_fixture as fixture on fixture.battle_id = participant.battle_id
   where participant.team_snapshot is null),
  2::bigint,
  'new classic participants leave the legacy team snapshot null'
);
select ok(
  exists (
    select 1 from public.battle_participants as participant
    join pg_temp.pvp_v3_fixture as fixture on fixture.battle_id = participant.battle_id
    join public.battles as battle on battle.id = fixture.battle_id
    where participant.user_id = fixture.requester_id
      and participant.combat_snapshot = jsonb_build_object(
        'avatarConfig', battle.state #> '{sides,0,avatarConfig}',
        'abilityIds', battle.state #> '{sides,0,abilityIds}'
      )
  )
  and exists (
    select 1 from public.battle_participants as participant
    join pg_temp.pvp_v3_fixture as fixture on fixture.battle_id = participant.battle_id
    join public.battles as battle on battle.id = fixture.battle_id
    where participant.user_id = fixture.addressee_id
      and participant.combat_snapshot = jsonb_build_object(
        'avatarConfig', battle.state #> '{sides,1,avatarConfig}',
        'abilityIds', battle.state #> '{sides,1,abilityIds}'
      )
  ),
  'each participant snapshot matches the v3 state created from the saved loadout'
);
select throws_ok(
  $$insert into public.battle_participants (battle_id, user_id, seat, team_snapshot)
    select fixture.battle_id, fixture.outsider_id, 3, '[]'::jsonb
    from pg_temp.pvp_v3_fixture as fixture$$,
  '23514', null,
  'non-null archived team snapshots must still contain six entries'
);
select throws_ok(
  $$select public.commit_pvp_action(
      fixture.battle_id,
      fixture.requester_id,
      1,
      'c1000000-0000-4000-8000-000000000012',
      'pass',
      jsonb_build_object(
        'battleId', fixture.battle_id::text,
        'expectedVersion', 1,
        'actionId', 'c1000000-0000-4000-8000-000000000012',
        'action', 'pass'
      ),
      jsonb_set(
        fixture.initial_state,
        '{sides,0}',
        (fixture.initial_state #> '{sides,0}') - 'kind'
      ),
      '[]'::jsonb
    ) from pg_temp.pvp_v3_fixture as fixture$$,
  '22023', null,
  'a committed v3 side must explicitly be a player'
);
select throws_ok(
  $$select public.commit_pvp_action(
      fixture.battle_id,
      fixture.requester_id,
      1,
      'c2000000-0000-4000-8000-000000000013',
      'pass',
      jsonb_build_object(
        'battleId', fixture.battle_id::text,
        'expectedVersion', 1,
        'actionId', 'c2000000-0000-4000-8000-000000000013',
        'action', 'pass'
      ),
      jsonb_set(
        fixture.initial_state,
        '{sides}',
        jsonb_build_array(
          fixture.initial_state #> '{sides,0}',
          fixture.initial_state #> '{sides,0}'
        )
      ),
      '[]'::jsonb
    ) from pg_temp.pvp_v3_fixture as fixture$$,
  '22023', null,
  'a committed v3 state must contain two distinct participant IDs'
);
select lives_ok(
  $$insert into public.battle_actions (
      battle_id, user_id, client_action_id, action_type, payload
    )
    select fixture.battle_id,
      fixture.requester_id,
      'c3000000-0000-4000-8000-000000000014',
      'surrender',
      '{}'::jsonb
    from pg_temp.pvp_v3_fixture as fixture$$,
  'the action constraint still accepts a legacy archived action type'
);
select lives_ok(
  $$select public.commit_pvp_action(
      fixture.battle_id,
      fixture.requester_id,
      1,
      'c4000000-0000-4000-8000-000000000015',
      'pass',
      jsonb_build_object(
        'battleId', fixture.battle_id::text,
        'expectedVersion', 1,
        'actionId', 'c4000000-0000-4000-8000-000000000015',
        'action', 'pass'
      ),
      jsonb_set(
        fixture.initial_state,
        '{turn,sideId}',
        to_jsonb(fixture.addressee_id::text)
      ),
      '[]'::jsonb
    ) from pg_temp.pvp_v3_fixture as fixture$$,
  'a valid v3 pass action commits through the authoritative RPC'
);
select is(
  (select battle.version::bigint
   from public.battles as battle
   join pg_temp.pvp_v3_fixture as fixture on fixture.battle_id = battle.id),
  2::bigint,
  'the successful v3 action advances the database version once'
);

select * from finish();
rollback;
