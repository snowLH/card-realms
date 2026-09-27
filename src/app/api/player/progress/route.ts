import { NextResponse } from "next/server";
import { z } from "zod";
import { RemotePlayerSnapshotSchema } from "@/game/player";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("travel"), regionId: z.string().min(1).max(80) }),
  z.object({ action: z.literal("claim_treasure"), regionId: z.string().min(1).max(80) }),
  z.object({ action: z.literal("activate_team"), teamId: z.string().uuid() }),
]);

async function authenticatedClient() {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não configurado.", status: 503 } as const;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || typeof data?.claims?.sub !== "string") {
    return { ok: false, error: "Autenticação necessária.", status: 401 } as const;
  }
  return { ok: true, supabase } as const;
}

export async function GET() {
  const auth = await authenticatedClient();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.supabase.rpc("get_my_player_snapshot");
  if (error) {
    console.error("Falha no snapshot remoto.", error.code);
    return NextResponse.json({ error: "Não foi possível carregar o progresso." }, { status: 503 });
  }
  const parsed = RemotePlayerSnapshotSchema.safeParse(data);
  if (!parsed.success) {
    return NextResponse.json({ error: "Snapshot remoto incompatível." }, { status: 500 });
  }
  return NextResponse.json({ snapshot: parsed.data, authority: "supabase" });
}

export async function PATCH(request: Request) {
  try {
    const payload = mutationSchema.parse(await request.json());
    const auth = await authenticatedClient();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const rpc = payload.action === "travel"
      ? auth.supabase.rpc("travel_to_region", { target_region_id: payload.regionId })
      : payload.action === "claim_treasure"
        ? auth.supabase.rpc("claim_region_treasure", { target_region_id: payload.regionId })
        : auth.supabase.rpc("activate_team", { target_team_id: payload.teamId });
    const { data, error } = await rpc;
    if (error) {
      const conflict = error.code === "23505" || error.code === "22023";
      return NextResponse.json(
        {
          error: conflict
            ? "A ação conflita com o estado atual do progresso. Atualize o jogo e tente novamente."
            : "A alteração remota não pôde ser concluída.",
        },
        { status: conflict ? 409 : 503 },
      );
    }
    return NextResponse.json({ result: data, authority: "supabase" });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? "A alteração de progresso é inválida."
      : "Não foi possível processar a alteração.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
