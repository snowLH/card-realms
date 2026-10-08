-- Folklard: preserve ownership checks while preventing per-row auth.uid()
-- evaluation. Existing SECURITY DEFINER lobby RPCs are intentionally retained.
DO $$
DECLARE
  policy_record record;
  predicate_sql text;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual LIKE '%auth.uid()%' AND qual NOT ILIKE '%SELECT auth.uid()%')
        OR (with_check LIKE '%auth.uid()%' AND with_check NOT ILIKE '%SELECT auth.uid()%')
      )
  LOOP
    predicate_sql := '';
    IF policy_record.qual IS NOT NULL THEN
      predicate_sql := ' USING (' || replace(policy_record.qual, 'auth.uid()', '(select auth.uid())') || ')';
    END IF;
    IF policy_record.with_check IS NOT NULL THEN
      predicate_sql := predicate_sql || ' WITH CHECK ('
        || replace(policy_record.with_check, 'auth.uid()', '(select auth.uid())') || ')';
    END IF;
    EXECUTE format(
      'ALTER POLICY %I ON %I.%I%s',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename,
      predicate_sql
    );
  END LOOP;
END;
$$;

-- Historical gacha ledgers are read-only but retaining FK indexes avoids
-- expensive scans during eventual data exports or maintenance.
CREATE INDEX IF NOT EXISTS idx_arpg_gacha_redemptions_card_id
  ON private.arpg_power_gacha_redemptions (card_id);
CREATE INDEX IF NOT EXISTS idx_arpg_gacha_rolls_card_id
  ON private.arpg_power_gacha_rolls (card_id);
