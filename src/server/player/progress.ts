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
  const [snapshotResult, profileResult, worldResult, evolutionResult, missionResult] = await Promise.all([
    supabase.rpc("get_my_player_snapshot"),
    supabase.from("profiles").select("avatar_config").single(),
    supabase.from("player_world_state").select("current_area_id,visited_area_ids,map_positions").single(),
    supabase.from("player_creatures").select("id,evolution_stage"),
    supabase.from("missions").select("id,objective,enabled").eq("enabled", true),
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

  const evolutionById = new Map(
    (evolutionResult.data ?? []).map((row) => [row.id, Number(row.evolution_stage) || 0]),
  );
  const missionTargets = new Map(
    (missionResult.data ?? []).map((row) => {
      const objective = row.objective && typeof row.objective === "object" && !Array.isArray(row.objective)
        ? row.objective as Record<string, unknown>
        : {};
      return [row.id, Math.max(1, Number(objective.count) || 1)] as const;
    }),
  );
  const raw = data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : null;
  const rawCollection = Array.isArray(raw?.collection) ? raw.collection : [];
  const rawTeams = Array.isArray(raw?.teams) ? raw.teams : [];
  const rawMissions = Array.isArray(raw?.missions) ? raw.missions : [];
  const enriched = raw
    ? {
        ...raw,
        profile: {
          ...(raw.profile && typeof raw.profile === "object" ? raw.profile : {}),
          avatarConfig: profileResult.data?.avatar_config,
        },
        world: {
          ...(raw.world && typeof raw.world === "object" ? raw.world : {}),
          currentAreaId: worldResult.data?.current_area_id ?? null,
          visitedAreaIds: worldResult.data?.visited_area_ids ?? [],
          mapPositions: worldResult.data?.map_positions ?? {},
        },
        collection: rawCollection.map((entry) => {
          const creature = entry as Record<string, unknown>;
          return {
            ...creature,
            evolutionStage: evolutionById.get(String(creature.instanceId)) ?? 0,
          };
        }),
        teams: rawTeams.map((entry) => {
          const team = entry as Record<string, unknown>;
          const members = Array.isArray(team.members) ? team.members : [];
          return {
            ...team,
            members: members.map((member) => {
              const typed = member as Record<string, unknown>;
              return {
                ...typed,
                evolutionStage: evolutionById.get(String(typed.playerCreatureId)) ?? 0,
              };
            }),
          };
        }),
        missions: rawMissions
          .filter((entry) => missionTargets.has(String((entry as Record<string, unknown>).id)))
          .map((entry) => {
            const mission = entry as Record<string, unknown>;
            return {
              ...mission,
              target: missionTargets.get(String(mission.id)) ?? 1,
            };
          }),
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
