import "server-only";

import {
  LOCAL_PLAYER_BOOTSTRAP,
  RemotePlayerSnapshotSchema,
  type PlayerBootstrap,
} from "@/game/player";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function loadPlayerBootstrap(): Promise<PlayerBootstrap> {
  if (!isSupabaseConfigured()) return LOCAL_PLAYER_BOOTSTRAP;

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const subject = typeof claims?.sub === "string"
    ? claims.sub
    : null;

  if (claimsError || !subject) return LOCAL_PLAYER_BOOTSTRAP;

  const identity = {
    id: subject,
    email: typeof claims?.email === "string" ? claims.email : null,
  };
  const { data, error } = await supabase.rpc("get_my_player_snapshot");
  if (error) {
    console.error("Falha ao carregar o progresso remoto.", error.code);
    return {
      source: "supabase-unavailable",
      identity,
      snapshot: null,
      error: "A conta foi autenticada, mas o progresso remoto não pôde ser carregado.",
    };
  }

  const parsed = RemotePlayerSnapshotSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Snapshot remoto incompatível.", parsed.error.issues);
    return {
      source: "supabase-unavailable",
      identity,
      snapshot: null,
      error: "O formato do progresso remoto é incompatível com esta versão do jogo.",
    };
  }

  return { source: "supabase", identity, snapshot: parsed.data };
}
