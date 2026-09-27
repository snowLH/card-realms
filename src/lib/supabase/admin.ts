import "server-only";

import { createClient } from "@supabase/supabase-js";
import { isSupabaseAdminConfigured } from "./env";

export function createAdminClient() {
  if (!isSupabaseAdminConfigured()) {
    throw new Error("Credencial administrativa do Supabase não configurada.");
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { "x-card-realms-authority": "pvp-server" } },
    },
  );
}
