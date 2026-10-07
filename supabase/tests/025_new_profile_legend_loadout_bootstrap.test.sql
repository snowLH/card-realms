begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('f1000001-0000-4000-8000-000000000001', 'legend-bootstrap-requester@test.invalid'),
  ('f1000002-0000-4000-8000-000000000002', 'legend-bootstrap-addressee@test.invalid');

select is(
  (select profile.avatar_config
   from public.profiles as profile
   where profile.id = 'f1000001-0000-4000-8000-000000000001'),
  '{"legendId":"curupira","favoriteLegendId":"curupira","skin":"copper","hair":"mohawk","outfit":"ranger","armor":"none","accent":"crimson"}'::jsonb,
  'a future sign-up receives the complete seven-field Curupira avatar and favorite'
);
select is(
  (select count(*)::integer
   from public.profiles as profile,
        lateral jsonb_object_keys(profile.avatar_config) as avatar_key
   where profile.id = 'f1000001-0000-4000-8000-000000000001'),
  7,
  'the new avatar has exactly seven fields'
);
select is(
  (select inventory.quantity
   from public.inventory_items as inventory
   where inventory.user_id = 'f1000001-0000-4000-8000-000000000001'
     and inventory.item_key = 'legend-curupira'),
  1,
  'the free Curupira Legend is explicitly owned'
);
select is(
  (select jsonb_build_object(
     'weaponId', loadout.weapon_id,
     'secondaryWeaponId', loadout.secondary_weapon_id,
     'legacyArmorId', loadout.armor_id,
     'relicId', loadout.relic_id,
     'abilityIds', to_jsonb(loadout.ability_ids)
   )
   from public.player_arpg_loadouts as loadout
   where loadout.user_id = 'f1000001-0000-4000-8000-000000000001'),
  '{"weaponId":"forest-bow","secondaryWeaponId":"iron-sword","legacyArmorId":"leather-armor","relicId":"cartographer-compass","abilityIds":["curupira-root-snare","curupira-ember-arrow"]}'::jsonb,
  'the starter loadout satisfies weapon, relic and two-ability contracts'
);
select is(
  (select count(*)::bigint
   from public.inventory_items as inventory
   where inventory.user_id = 'f1000001-0000-4000-8000-000000000001'
     and inventory.item_key in (
       'leather-armor', 'forest-guardian-armor', 'ritual-cloak',
       'river-shell-armor', 'kelpie-mist-cloak', 'ahuizotl-guard-armor',
       'highland-coat', 'amarok-hunter-armor', 'carbunclo-mantle'
     )),
  0::bigint,
  'the bootstrap does not grant armor inventory'
);

insert into public.friendships (requester_id, addressee_id, status)
values (
  'f1000001-0000-4000-8000-000000000001',
  'f1000002-0000-4000-8000-000000000002',
  'accepted'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000001-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.save_arpg_loadout(
      'forest-bow', 'leather-armor', 'cartographer-compass',
      array['curupira-root-snare','curupira-ember-arrow']::text[]
    )$$,
  'a newly signed-up player can save the strict starter loadout'
);
select set_config('request.jwt.claim.sub', 'f1000002-0000-4000-8000-000000000002', true);
select lives_ok(
  $$select public.save_arpg_loadout(
      'forest-bow', 'leather-armor', 'cartographer-compass',
      array['curupira-root-snare','curupira-ember-arrow']::text[]
    )$$,
  'a second newly signed-up player can save the strict starter loadout'
);
select set_config('request.jwt.claim.sub', 'f1000001-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.create_pvp_challenge('f1000002-0000-4000-8000-000000000002')$$,
  'new profiles can enter the normal friend challenge flow'
);
reset role;

create temporary table new_profile_legend_pvp_fixture (
  challenge_id uuid not null,
  requester_id uuid not null,
  addressee_id uuid not null,
  battle_id uuid not null,
  initial_state jsonb not null
);

insert into pg_temp.new_profile_legend_pvp_fixture (
  challenge_id, requester_id, addressee_id, battle_id, initial_state
)
select
  challenge.id,
  challenge.requester_id,
  challenge.addressee_id,
  'f2000000-0000-4000-8000-000000000001'::uuid,
  jsonb_build_object(
    'kind', 'pvp_realtime',
    'version', 1,
    'id', 'f2000000-0000-4000-8000-000000000001',
    'status', 'active',
    'winnerId', null,
    'finishReason', null,
    'startedAtMs', 0,
    'serverTimeMs', 0,
    'players', jsonb_build_array(
      jsonb_build_object(
        'id', challenge.requester_id::text,
        'name', 'New Profile Requester',
        'avatarConfig', requester_snapshot.snapshot -> 'avatarConfig',
        'abilityIds', requester_snapshot.snapshot -> 'abilityIds',
        'x', 320, 'y', 360, 'hp', 100, 'maxHp', 100,
        'input', jsonb_build_object('moveX', 0, 'moveY', 0, 'aimX', 1, 'aimY', 0),
        'nextAttackAtMs', 0, 'nextDashAtMs', 0, 'dashingUntilMs', 0,
        'dashX', 0, 'dashY', 0, 'abilityReadyAtMs', jsonb_build_array(0, 0),
        'rootedUntilMs', 0
      ),
      jsonb_build_object(
        'id', challenge.addressee_id::text,
        'name', 'New Profile Addressee',
        'avatarConfig', addressee_snapshot.snapshot -> 'avatarConfig',
        'abilityIds', addressee_snapshot.snapshot -> 'abilityIds',
        'x', 960, 'y', 360, 'hp', 100, 'maxHp', 100,
        'input', jsonb_build_object('moveX', 0, 'moveY', 0, 'aimX', -1, 'aimY', 0),
        'nextAttackAtMs', 0, 'nextDashAtMs', 0, 'dashingUntilMs', 0,
        'dashX', 0, 'dashY', 0, 'abilityReadyAtMs', jsonb_build_array(0, 0),
        'rootedUntilMs', 0
      )
    ),
    'processedActionIds', jsonb_build_array(),
    'eventSequence', 1,
    'log', jsonb_build_array(jsonb_build_object(
      'id', 'battle-start',
      'sequence', 1,
      'atMs', 0,
      'actorId', challenge.requester_id::text,
      'kind', 'duel_started',
      'message', 'O duelo em tempo real começou.'
    ))
  )
from public.pvp_challenges as challenge
cross join lateral (
  select private.active_avatar_power_snapshot(challenge.requester_id) as snapshot
) as requester_snapshot
cross join lateral (
  select private.active_avatar_power_snapshot(challenge.addressee_id) as snapshot
) as addressee_snapshot
where challenge.requester_id = 'f1000001-0000-4000-8000-000000000001'
  and challenge.addressee_id = 'f1000002-0000-4000-8000-000000000002'
  and challenge.status = 'pending';

select lives_ok(
  $$select public.start_pvp_challenge(
      fixture.challenge_id,
      fixture.addressee_id,
      fixture.battle_id,
      fixture.initial_state
    )
    from pg_temp.new_profile_legend_pvp_fixture as fixture$$,
  'the PvP start authority accepts the new profiles’ saved avatar and exact ability snapshots'
);
select is(
  (select challenge.status
   from public.pvp_challenges as challenge
   join pg_temp.new_profile_legend_pvp_fixture as fixture
     on fixture.challenge_id = challenge.id),
  'accepted'::text,
  'the new profiles’ challenge reaches the accepted state'
);
select is(
  (select count(*)::bigint
   from public.battle_participants as participant
   join pg_temp.new_profile_legend_pvp_fixture as fixture
     on fixture.battle_id = participant.battle_id
   join public.profiles as profile on profile.id = participant.user_id
   join public.player_arpg_loadouts as loadout on loadout.user_id = participant.user_id
   where participant.team_snapshot is null
     and participant.combat_snapshot = jsonb_build_object(
       'avatarConfig', profile.avatar_config,
       'abilityIds', to_jsonb(loadout.ability_ids)
     )),
  2::bigint,
  'the accepted battle freezes both newly initialized avatar and two-ability snapshots'
);

select * from finish();
rollback;
