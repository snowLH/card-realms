import { NextResponse } from "next/server";
import { z } from "zod";
import { CreateChallengeSchema, RespondChallengeSchema } from "@/game/pvp";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { acceptPvpChallenge } from "@/server/pvp/setup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function session() {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não configurado.", status: 503 } as const;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || typeof data?.claims?.sub !== "string") {
    return { ok: false, error: "Autenticação necessária.", status: 401 } as const;
  }
  return { ok: true, supabase, userId: data.claims.sub } as const;
}

export async function GET() {
  const auth = await session();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await auth.supabase
    .from("pvp_challenges")
    .select("id,requester_id,addressee_id,status,battle_id,expires_at,created_at,responded_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("Falha ao listar desafios PVP.", error.code);
    return NextResponse.json({ error: "Não foi possível carregar os desafios." }, { status: 503 });
  }

  let friends: Array<{ id: string; name: string; hasActiveTeam: boolean }> = [];
  if (isSupabaseAdminConfigured()) {
    const admin = createAdminClient();
    const { data: relationships } = await admin
      .from("friendships")
      .select("requester_id,addressee_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${auth.userId},addressee_id.eq.${auth.userId}`);
    const friendIds = [...new Set((relationships ?? []).map((relationship) =>
      relationship.requester_id === auth.userId
        ? relationship.addressee_id
        : relationship.requester_id,
    ))];
    if (friendIds.length > 0) {
      const [{ data: profiles }, { data: teams }] = await Promise.all([
        admin.from("profiles").select("id,display_name").in("id", friendIds),
        admin.from("teams").select("user_id").in("user_id", friendIds).eq("is_active", true),
      ]);
      const ready = new Set((teams ?? []).map((team) => team.user_id));
      friends = (profiles ?? []).map((profile) => ({
        id: profile.id,
        name: profile.display_name,
        hasActiveTeam: ready.has(profile.id),
      }));
    }
  }

  return NextResponse.json({ challenges: data, friends, authority: "supabase" });
}

export async function POST(request: Request) {
  try {
    const body = CreateChallengeSchema.parse(await request.json());
    const auth = await session();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { data, error } = await auth.supabase.rpc("create_pvp_challenge", {
      target_addressee_id: body.addresseeId,
    });
    if (error) {
      const conflict = error.code === "23505";
      return NextResponse.json(
        { error: conflict ? "Já existe um desafio pendente entre estes jogadores." : "O desafio não pôde ser criado." },
        { status: conflict ? 409 : 503 },
      );
    }
    return NextResponse.json({ challenge: data, authority: "supabase" }, { status: 201 });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? "Os dados do desafio são inválidos."
      : "Não foi possível processar o desafio.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = RespondChallengeSchema.parse(await request.json());
    const auth = await session();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (body.response === "accept") {
      if (!isSupabaseAdminConfigured()) {
        return NextResponse.json(
          { error: "O servidor PVP ainda não possui a credencial necessária." },
          { status: 503 },
        );
      }
      const battle = await acceptPvpChallenge(body.challengeId, auth.userId);
      const accepted = battle as { battleId?: unknown; version?: unknown } | null;
      if (typeof accepted?.battleId !== "string") {
        return NextResponse.json({ error: "A sala PVP não foi criada corretamente." }, { status: 500 });
      }
      return NextResponse.json({
        battle: { battleId: accepted.battleId, version: accepted.version },
        authority: "server",
      });
    }

    const functionName = body.response === "decline"
      ? "decline_pvp_challenge"
      : "cancel_pvp_challenge";
    const { data, error } = await auth.supabase.rpc(functionName, {
      target_challenge_id: body.challengeId,
    });
    if (error) {
      return NextResponse.json({ error: "O desafio não está mais disponível." }, { status: 409 });
    }
    return NextResponse.json({ challenge: data, authority: "supabase" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "A resposta ao desafio é inválida." }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível responder ao desafio." },
      { status: 409 },
    );
  }
}
