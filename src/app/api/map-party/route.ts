import { NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_AVATAR_CONFIG } from "@/game/save/local-progress";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create") }),
  z.object({ action: z.literal("join"), inviteCode: z.string().trim().min(4).max(16) }),
  z.object({ action: z.literal("leave"), sessionId: z.string().uuid() }),
  z.object({
    action: z.literal("position"),
    sessionId: z.string().uuid(),
    x: z.number().int().min(0).max(39),
    y: z.number().int().min(0).max(24),
  }),
]);

async function auth() {
  if (!isSupabaseConfigured()) {
    return { ok: false, status: 503, error: "Supabase não configurado." } as const;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string") {
    return { ok: false, status: 401, error: "Autenticação necessária." } as const;
  }
  return { ok: true, supabase, userId } as const;
}

export async function GET(request: Request) {
  const authenticated = await auth();
  if (!authenticated.ok) {
    return NextResponse.json({ error: authenticated.error }, { status: authenticated.status });
  }

  const requestedSessionId = new URL(request.url).searchParams.get("sessionId");
  const admin = createAdminClient();
  let membershipQuery = admin
    .from("map_session_members")
    .select("session_id,user_id,x,y,presence_status,last_seen_at")
    .eq("user_id", authenticated.userId);

  if (requestedSessionId) membershipQuery = membershipQuery.eq("session_id", requestedSessionId);

  const { data: membership, error: membershipError } = await membershipQuery.maybeSingle();
  if (membershipError) {
    return NextResponse.json({ error: "Não foi possível consultar sua sessão de mapa." }, { status: 503 });
  }
  if (!membership) {
    return NextResponse.json({ session: null, members: [], authority: "server" });
  }

  const { data: session, error: sessionError } = await admin
    .from("map_sessions")
    .select("id,host_id,invite_code,region_id,status,max_players,created_at")
    .eq("id", membership.session_id)
    .single();

  if (sessionError || !session || session.status !== "active") {
    return NextResponse.json({ session: null, members: [], authority: "server" });
  }

  const { data: members, error: membersError } = await admin
    .from("map_session_members")
    .select("session_id,user_id,x,y,presence_status,last_seen_at")
    .eq("session_id", session.id)
    .order("joined_at");

  if (membersError) {
    return NextResponse.json({ error: "Não foi possível carregar os participantes." }, { status: 503 });
  }

  const ids = (members ?? []).map((member) => member.user_id);
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("id,display_name,avatar_config").in("id", ids)
    : { data: [] as Array<{ id: string; display_name: string; avatar_config: unknown }> };
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return NextResponse.json({
    session: {
      id: session.id,
      hostId: session.host_id,
      inviteCode: session.invite_code,
      regionId: session.region_id,
      maxPlayers: session.max_players,
    },
    members: (members ?? []).map((member) => {
      const profile = profileById.get(member.user_id);
      return {
        id: member.user_id,
        name: profile?.display_name ?? "Cartógrafo",
        x: member.x,
        y: member.y,
        presenceStatus: member.presence_status,
        avatar: profile?.avatar_config ?? DEFAULT_AVATAR_CONFIG,
        isSelf: member.user_id === authenticated.userId,
      };
    }),
    authority: "server",
  });
}

export async function POST(request: Request) {
  try {
    const action = actionSchema.parse(await request.json());
    const authenticated = await auth();
    if (!authenticated.ok) {
      return NextResponse.json({ error: authenticated.error }, { status: authenticated.status });
    }

    const rpc = action.action === "create"
      ? authenticated.supabase.rpc("create_map_session")
      : action.action === "join"
        ? authenticated.supabase.rpc("join_map_session", { target_invite_code: action.inviteCode })
        : action.action === "leave"
          ? authenticated.supabase.rpc("leave_map_session", { target_session_id: action.sessionId })
          : authenticated.supabase.rpc("update_map_session_position", {
              target_session_id: action.sessionId,
              target_x: action.x,
              target_y: action.y,
            });

    const { data, error } = await rpc;
    if (error) {
      const conflict = error.code === "22023" || error.code === "P0002" || error.code === "42501";
      return NextResponse.json(
        { error: conflict ? error.message : "A sessão cooperativa não pôde ser atualizada." },
        { status: conflict ? 409 : 503 },
      );
    }

    return NextResponse.json({ result: data, authority: "supabase" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? "Ação cooperativa inválida." : "Não foi possível processar a sessão." },
      { status: 400 },
    );
  }
}
