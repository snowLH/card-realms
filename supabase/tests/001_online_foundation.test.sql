begin;

create extension if not exists pgtap with schema extensions;
select plan(45);

select has_table('public', 'battles', 'authoritative battles table exists');
select has_table('public', 'pvp_challenges', 'PVP challenges table exists');
select has_table('public', 'battle_results', 'persistent battle results table exists');
select has_table('public', 'region_areas', 'regional area catalog exists');
select has_index('public', 'friendships', 'one_friendship_per_pair', 'friend pairs are unique in either direction');
select has_index('public', 'team_members', 'team_members_player_creature_idx', 'team member foreign key is indexed');
select has_index('public', 'player_world_state', 'player_world_state_current_area_idx', 'current area foreign key is indexed');
select has_trigger('public', 'battle_events', 'broadcast_pvp_battle_event', 'battle events broadcast trigger exists');

select results_eq(
  $$select count(*)::bigint from public.region_areas where enabled$$,
  array[25::bigint],
  'five primary regions expose twenty-five enabled areas'
);
select results_eq(
  $$select count(*)::bigint from public.creature_catalog where enabled and art_slot between 25 and 49$$,
  array[25::bigint],
  'the second atlas contributes twenty-five enabled creatures'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.region_areas'::regclass),
  'the regional area catalog keeps RLS enabled'
);

select results_eq(
  $$
    select count(*)::bigint
    from pg_class relations
    join pg_namespace schemas on schemas.oid = relations.relnamespace
    where schemas.nspname = 'public'
      and relations.relname in (
        'profiles', 'player_creatures', 'teams', 'team_members',
        'player_world_state', 'pvp_challenges', 'battles',
        'battle_participants', 'battle_actions', 'battle_events', 'battle_results'
      )
      and relations.relrowsecurity
  $$,
  array[11::bigint],
  'every tested player/online table has RLS enabled'
);

select ok(
  not has_table_privilege('authenticated', 'public.battles', 'select'),
  'authenticated cannot select authoritative battle state'
);
select ok(
  not has_table_privilege('authenticated', 'public.battle_actions', 'select'),
  'authenticated cannot select stored action results'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.start_pvp_challenge(uuid,uuid,uuid,jsonb)',
    'execute'
  ),
  'authenticated cannot invoke the battle creation authority RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.commit_pvp_action(uuid,uuid,integer,uuid,text,jsonb,jsonb,jsonb)',
    'execute'
  ),
  'authenticated cannot invoke the battle commit authority RPC'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.create_pvp_challenge(uuid)',
    'execute'
  ),
  'authenticated may invoke the narrow challenge RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.visit_region_area(text,text)', 'execute'),
  'authenticated may invoke the narrow area visit RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.buy_energy_pack(public.card_element,integer)', 'execute'),
  'authenticated may invoke the server-priced energy shop RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.save_avatar_config(jsonb)', 'execute'),
  'authenticated may invoke the validated avatar RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.save_world_position(text,integer,integer)', 'execute'),
  'authenticated may invoke the bounded position RPC'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'players receive own pvp broadcasts'
      and cmd = 'SELECT'
  ),
  'private Broadcast read policy exists'
);

insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'pvp-a@test.invalid'),
  ('20000000-0000-4000-8000-000000000002', 'pvp-b@test.invalid'),
  ('30000000-0000-4000-8000-000000000003', 'pvp-outsider@test.invalid');

-- New accounts now choose a single starter. Seed the two PvP participants with
-- six owned creatures each so this suite exercises the legal duel path rather
-- than bypassing the production team validator.
with seeded_creatures as (
  insert into public.player_creatures (
    user_id, creature_id, acquired_from
  )
  select players.user_id, catalog.id, 'pgtap-pvp-fixture'
  from (
    values
      ('10000000-0000-4000-8000-000000000001'::uuid),
      ('20000000-0000-4000-8000-000000000002'::uuid)
  ) as players(user_id)
  cross join lateral (
    select id
    from public.creature_catalog
    where enabled
    order by art_slot
    limit 6
  ) as catalog
  returning id, user_id, creature_id
), ranked_creatures as (
  select
    id,
    user_id,
    row_number() over (partition by user_id order by creature_id)::smallint as slot
  from seeded_creatures
)
insert into public.team_members (team_id, slot, player_creature_id)
select teams.id, ranked_creatures.slot, ranked_creatures.id
from ranked_creatures
join public.teams
  on teams.user_id = ranked_creatures.user_id
 and teams.is_active;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$select public.visit_region_area('roots', 'roots-gate')$$,
  'A can enter the first area of the current region'
);
select lives_ok(
  $$select public.save_world_position('roots', 4, 20)$$,
  'A can save a valid position in the current local map'
);
select throws_ok(
  $$select public.visit_region_area('roots', 'roots-heart')$$,
  '22023',
  null,
  'A cannot skip the regional area sequence'
);
select throws_ok(
  $$select public.buy_energy_pack('fire', 2)$$,
  '22023',
  null,
  'A cannot invent an unsupported energy package'
);
select lives_ok(
  $$select public.buy_energy_pack('fire', 1)$$,
  'A can buy a server-priced energy package'
);
select throws_ok(
  $$select public.save_avatar_config('{"skin":"copper","hair":"braids","outfit":"traveler","armor":"guardian","accent":"gold"}'::jsonb)$$,
  '22023',
  null,
  'A cannot equip an armor that is not in inventory'
);
select lives_ok(
  $$select public.save_avatar_config('{"skin":"copper","hair":"braids","outfit":"traveler","armor":"leather","accent":"gold"}'::jsonb)$$,
  'A can save a valid base avatar'
);

select lives_ok(
  $$
    insert into public.friendships (requester_id, addressee_id)
    values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002'
    )
  $$,
  'A can create a pending friendship request to B'
);

select throws_ok(
  $$
    insert into public.friendships (requester_id, addressee_id, status)
    values (
      '10000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000003',
      'accepted'
    )
  $$,
  '42501',
  null,
  'A cannot forge an already accepted friendship'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.team_members members
    join public.teams teams on teams.id = members.team_id
    where teams.user_id = '10000000-0000-4000-8000-000000000001'
      and teams.is_active
  $$,
  array[6::bigint],
  'A receives an active team with exactly six creatures'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.team_members members
    join public.teams teams on teams.id = members.team_id
    where teams.user_id = '20000000-0000-4000-8000-000000000002'
      and teams.is_active
  $$,
  array[0::bigint],
  'A cannot inspect B team members through RLS'
);

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);

select lives_ok(
  $$
    update public.friendships
    set status = 'accepted'
    where requester_id = '10000000-0000-4000-8000-000000000001'
      and addressee_id = '20000000-0000-4000-8000-000000000002'
  $$,
  'B can accept the pending request'
);

select results_eq(
  $$select count(*)::bigint from public.friendships where status = 'accepted'$$,
  array[1::bigint],
  'B sees the accepted friendship'
);

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', true);
select results_eq(
  $$select count(*)::bigint from public.friendships$$,
  array[0::bigint],
  'an outsider cannot read the friendship'
);

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$
    insert into public.friendships (requester_id, addressee_id)
    values (
      '20000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000001'
    )
  $$,
  '23505',
  null,
  'the reverse friendship cannot be duplicated'
);

select throws_ok(
  $$
    update public.friendships
    set requester_id = '30000000-0000-4000-8000-000000000003'
    where addressee_id = '20000000-0000-4000-8000-000000000002'
  $$,
  '42501',
  null,
  'B cannot rewrite friendship participant IDs'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.create_pvp_challenge('20000000-0000-4000-8000-000000000002')$$,
  'A can challenge accepted friend B'
);

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select results_eq(
  $$select count(*)::bigint from public.pvp_challenges where status = 'pending'$$,
  array[1::bigint],
  'B can read the pending challenge'
);

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', true);
select results_eq(
  $$select count(*)::bigint from public.pvp_challenges$$,
  array[0::bigint],
  'an outsider cannot read the challenge'
);

select throws_ok(
  $$select state from public.battles$$,
  '42501',
  null,
  'authenticated users cannot fetch serialized authoritative state'
);
select throws_ok(
  $$select result from public.battle_actions$$,
  '42501',
  null,
  'authenticated users cannot fetch serialized action results'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select results_eq(
  $$select (public.get_my_player_snapshot() #>> '{profile,id}')::uuid$$,
  $$values ('10000000-0000-4000-8000-000000000001'::uuid)$$,
  'the progress RPC returns only the authenticated player snapshot'
);

select results_eq(
  $$select count(*)::bigint from public.profiles where id = '20000000-0000-4000-8000-000000000002'$$,
  array[0::bigint],
  'A cannot read B private profile row directly'
);

-- Raise when any assertion fails so direct remote execution and pg_prove both
-- produce a non-zero result instead of relying only on TAP text parsing.
select * from finish(true);
rollback;
