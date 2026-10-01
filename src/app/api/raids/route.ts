import { NextResponse } from "next/server";
import { z } from "zod";
import { RaidLobbyActionSchema } from "@/game/raid";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authenticated() {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não configurado.", status: 503 } as const;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string") {
    return { ok: false, error: "Autenticação necessária.", status: 401 } as const;
  }
  return { ok: true, supabase, userId } as const;
}

export async function GET() {
  const auth = await authenticated();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [{ data: schedule, error: scheduleError }, { data: rewards }] = await Promise.all([
    auth.supabase.rpc("get_raid_schedule"),
    auth.supabase
      .from("raid_reward_ledger")
      .select("event_id,reward_type,creature_card_id,granted_at")
      .eq("player_id", auth.userId),
  ]);

  if (scheduleError) {
    console.error("Falha ao carregar agenda de Raids.", scheduleError.code);
    return NextResponse.json(
      { error: "O sistema de Raids ainda não está disponível no banco." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    schedule: schedule ?? [],
    rewards: rewards ?? [],
    serverAuthority: true,
  });
}

export async function POST(request: Request) {
  try {
    const action = RaidLobbyActionSchema.parse(await request.json());
    const auth = await authenticated();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const rpc = action.action === "create"
      ? { name: "create_raid_room", args: { target_event_id: action.eventId } }
      : action.action === "join"
        ? { name: "join_raid_room", args: { target_invite_code: action.inviteCode } }
        : action.action === "ready"
          ? { name: "set_raid_ready", args: { target_room_id: action.roomId, ready: action.ready } }
          : { name: "leave_raid_room", args: { target_room_id: action.roomId } };

    const { data, error } = await auth.supabase.rpc(rpc.name, rpc.args);
    if (error) {
      const message = error.message.includes("equipe")
        ? "Monte uma equipe ativa com exatamente seis criaturas antes da Raid."
        : error.message.includes("cheia")
          ? "A sala da Raid já está cheia."
          : error.message.includes("ativa")
            ? "Esta Raid não está ativa neste momento."
            : "A ação da Raid não pôde ser concluída.";
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json({ result: data, authority: "supabase" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? "Ação de Raid inválida." : "Não foi possível processar a Raid." },
      { status: 400 },
    );
  }
}
