begin;

create extension if not exists pgtap with schema extensions;
select plan(22);

select has_table('private', 'arpg_runs', 'authenticated dungeon runs live in the private schema');
select has_index('private', 'arpg_runs', 'arpg_runs_one_active_per_user', 'each player may have at most one active run');
select ok(
  (select relrowsecurity from pg_class where oid = 'private.arpg_runs'::regclass),
  'durable run checkpoints have RLS enabled'
);
select ok(not has_table_privilege('authenticated', 'private.arpg_runs', 'select'), 'players cannot read run rows directly');
select ok(not has_table_privilege('authenticated', 'private.arpg_runs', 'update'), 'players cannot rewrite run checkpoints directly');
select ok(not has_table_privilege('anon', 'private.arpg_runs', 'select'), 'visitors cannot read persistent run rows');
select ok(
  has_table_privilege('service_role', 'private.arpg_runs', 'select')
  and has_table_privilege('service_role', 'private.arpg_runs', 'insert')
  and has_table_privilege('service_role', 'private.arpg_runs', 'update')
  and has_table_privilege('service_role', 'private.arpg_runs', 'delete'),
  'the server role may access run rows'
);

select ok(not has_function_privilege(
  'authenticated', 'public.begin_or_resume_arpg_run(uuid,uuid,text,text,text,text,text[],text,jsonb)', 'execute'
), 'authenticated users cannot call the run creation authority');
select ok(not has_function_privilege(
  'authenticated', 'public.get_active_arpg_run(uuid)', 'execute'
), 'authenticated users cannot bypass the authenticated API route');
select ok(not has_function_privilege(
  'authenticated', 'public.save_arpg_run_checkpoint(uuid,uuid,integer,jsonb)', 'execute'
), 'authenticated users cannot write checkpoint RPCs directly');
select ok(not has_function_privilege(
  'authenticated', 'public.finish_arpg_run(uuid,uuid,text,boolean,text[])', 'execute'
), 'authenticated users cannot claim run results directly');
select ok(
  not has_function_privilege('anon', 'public.begin_or_resume_arpg_run(uuid,uuid,text,text,text,text,text[],text,jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.get_active_arpg_run(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.save_arpg_run_checkpoint(uuid,uuid,integer,jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.finish_arpg_run(uuid,uuid,text,boolean,text[])', 'execute'),
  'anonymous clients cannot call persistent-run RPC wrappers'
);
select ok(has_function_privilege(
  'service_role', 'public.begin_or_resume_arpg_run(uuid,uuid,text,text,text,text,text[],text,jsonb)', 'execute'
), 'the server role may start or resume a run');
select ok(has_function_privilege(
  'service_role', 'public.get_active_arpg_run(uuid)', 'execute'
), 'the server role may read the active-run summary');
select ok(has_function_privilege(
  'service_role', 'public.save_arpg_run_checkpoint(uuid,uuid,integer,jsonb)', 'execute'
), 'the server role may save validated checkpoints');
select ok(has_function_privilege(
  'service_role', 'public.finish_arpg_run(uuid,uuid,text,boolean,text[])', 'execute'
), 'the server role may atomically finish a run');

select ok(
  (select prosecdef from pg_proc where oid = 'private.finish_arpg_run(uuid,uuid,text,boolean,text[])'::regprocedure),
  'the private result function runs with the restricted database owner'
);
select ok(
  not (select prosecdef from pg_proc where oid = 'public.finish_arpg_run(uuid,uuid,text,boolean,text[])'::regprocedure),
  'the exposed wrapper does not add definer privileges'
);

select ok(
  has_function_privilege('service_role', 'private.begin_or_resume_arpg_run(uuid,uuid,text,text,text,text,text[],text,jsonb)', 'execute')
  and has_function_privilege('service_role', 'private.get_active_arpg_run(uuid)', 'execute')
  and has_function_privilege('service_role', 'private.save_arpg_run_checkpoint(uuid,uuid,integer,jsonb)', 'execute')
  and has_function_privilege('service_role', 'private.finish_arpg_run(uuid,uuid,text,boolean,text[])', 'execute'),
  'the server role may call all private run authorities'
);
select ok(
  not has_function_privilege('authenticated', 'private.begin_or_resume_arpg_run(uuid,uuid,text,text,text,text,text[],text,jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'private.get_active_arpg_run(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.save_arpg_run_checkpoint(uuid,uuid,integer,jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'private.finish_arpg_run(uuid,uuid,text,boolean,text[])', 'execute')
  and not has_function_privilege('anon', 'private.begin_or_resume_arpg_run(uuid,uuid,text,text,text,text,text[],text,jsonb)', 'execute')
  and not has_function_privilege('anon', 'private.get_active_arpg_run(uuid)', 'execute')
  and not has_function_privilege('anon', 'private.save_arpg_run_checkpoint(uuid,uuid,integer,jsonb)', 'execute')
  and not has_function_privilege('anon', 'private.finish_arpg_run(uuid,uuid,text,boolean,text[])', 'execute'),
  'clients cannot bypass public wrappers to call private run authorities'
);
select ok(
  not (select prosecdef from pg_proc where oid = 'public.begin_or_resume_arpg_run(uuid,uuid,text,text,text,text,text[],text,jsonb)'::regprocedure)
  and not (select prosecdef from pg_proc where oid = 'public.get_active_arpg_run(uuid)'::regprocedure)
  and not (select prosecdef from pg_proc where oid = 'public.save_arpg_run_checkpoint(uuid,uuid,integer,jsonb)'::regprocedure)
  and not (select prosecdef from pg_proc where oid = 'public.finish_arpg_run(uuid,uuid,text,boolean,text[])'::regprocedure),
  'every public RPC wrapper runs as invoker'
);
select ok(
  (select count(*) = 4
    from pg_proc
    where oid in (
      'private.begin_or_resume_arpg_run(uuid,uuid,text,text,text,text,text[],text,jsonb)'::regprocedure,
      'private.get_active_arpg_run(uuid)'::regprocedure,
      'private.save_arpg_run_checkpoint(uuid,uuid,integer,jsonb)'::regprocedure,
      'private.finish_arpg_run(uuid,uuid,text,boolean,text[])'::regprocedure
    )
    and prosecdef
    and proconfig @> array['search_path=""']),
  'every private definer function pins an empty search_path'
);

select * from finish(true);
rollback;
