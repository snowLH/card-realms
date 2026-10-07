begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

select ok(
  has_function_privilege(
    'authenticated', 'public.save_arpg_loadout(text,text,text,text[])', 'execute'
  )
  and has_function_privilege(
    'authenticated', 'private.save_arpg_loadout(text,text,text,text[])', 'execute'
  )
  and not has_function_privilege(
    'anon', 'public.save_arpg_loadout(text,text,text,text[])', 'execute'
  )
  and not has_function_privilege(
    'service_role', 'public.save_arpg_loadout(text,text,text,text[])', 'execute'
  ),
  'authenticated callers can use the strict four-argument wrapper and helper'
);
select ok(
  (select not p.prosecdef
   from pg_catalog.pg_proc as p
   where p.oid =
     'public.save_arpg_loadout(text,text,text,text[])'::pg_catalog.regprocedure),
  'the public four-argument wrapper runs with invoker privileges'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.save_arpg_loadout(text,text,text,text,text[])', 'execute'
  )
  and not has_function_privilege(
    'anon', 'public.save_arpg_loadout(text,text,text,text,text[])', 'execute'
  )
  and not has_function_privilege(
    'service_role', 'public.save_arpg_loadout(text,text,text,text,text[])', 'execute'
  ),
  'the legacy public five-argument RPC is not executable by API roles'
);
select ok(
  not has_function_privilege(
    'authenticated', 'private.save_arpg_loadout(text,text,text,text,text[])', 'execute'
  )
  and not has_function_privilege(
    'anon', 'private.save_arpg_loadout(text,text,text,text,text[])', 'execute'
  )
  and not has_function_privilege(
    'service_role', 'private.save_arpg_loadout(text,text,text,text,text[])', 'execute'
  ),
  'the legacy private five-argument helper is not executable by API roles'
);

insert into auth.users (id, email) values
  ('b2000000-0000-4000-8000-000000000012', 'legend-loadout-rpc@test.invalid');

update public.profiles
set avatar_config = jsonb_build_object(
  'legendId', 'curupira',
  'favoriteLegendId', 'curupira',
  'skin', 'copper',
  'hair', 'mohawk',
  'outfit', 'ranger',
  'armor', 'none',
  'accent', 'crimson'
)
where id = 'b2000000-0000-4000-8000-000000000012';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub', 'b2000000-0000-4000-8000-000000000012', true
);

select lives_ok(
  $$select public.save_arpg_loadout(
      'forest-bow', 'leather-armor', 'cartographer-compass',
      array['curupira-root-snare','curupira-ember-arrow']::text[]
    )$$,
  'the authenticated player can save the active Curupira power pair'
);
select throws_ok(
  $$select public.save_arpg_loadout(
      'forest-bow', 'highland-coat', 'cartographer-compass',
      array['curupira-root-snare','curupira-ember-arrow']::text[]
    )$$,
  '22023', null,
  'the active loadout rejects retired armor equipment'
);
select throws_ok(
  $$select public.save_arpg_loadout(
      'forest-bow', 'leather-armor', 'cartographer-compass',
      array['iara-enchanting-song','iara-living-spring']::text[]
    )$$,
  '22023', null,
  'the four-argument RPC rejects another Legend’s signature pair'
);
select throws_ok(
  $$select public.save_arpg_loadout(
      'forest-bow', 'iron-sword', 'leather-armor', 'cartographer-compass',
      array['iara-enchanting-song','iara-living-spring']::text[]
    )$$,
  '42501', null,
  'the authenticated player cannot invoke the legacy five-argument RPC'
);
reset role;

select is(
  (select loadout.ability_ids
   from public.player_arpg_loadouts as loadout
   where loadout.user_id = 'b2000000-0000-4000-8000-000000000012'),
  array['curupira-root-snare','curupira-ember-arrow']::text[],
  'a rejected cross-Legend request leaves the active pair saved'
);

select * from finish();
rollback;
