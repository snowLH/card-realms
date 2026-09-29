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
  const [snapshotResult, profileResult, worldResult] = await Promise.all([
    supabase.rpc("get_my_player_snapshot"),
    supabase.from("profiles").select("avatar_config").single(),
    supabase.from("player_world_state").select("current_area_id,visited_area_ids,map_positions").single(),
  ]);
  const { data, error } = snapshotResult;
  if (error) {
    console.error("Falha ao carregar o progresso remoto.", error.code);
    return {
      source: "supabase-unavailable",
      identity,
      snapshot: null,
      error: "A conta foi autenticada, mas o progresso remoto não pôde ser carregado.",
    };
  }

  const enriched = data && typeof data === "object" && !Array.isArray(data)
    ? {
        ...data,
        profile: {
          ...((data as { profile?: object }).profile ?? {}),
          avatarConfig: profileResult.data?.avatar_config,
        },
        world: {
          ...((data as { world?: object }).world ?? {}),
          currentAreaId: worldResult.data?.current_area_id ?? null,
          visitedAreaIds: worldResult.data?.visited_area_ids ?? [],
          mapPositions: worldResult.data?.map_positions ?? {},
        },
      }
    : data;
  const parsed = RemotePlayerSnapshotSchema.safeParse(enriched);
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
