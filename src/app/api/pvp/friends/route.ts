import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({ addresseeId: z.string().uuid() });
const respondSchema = z.object({
  friendshipId: z.string().uuid(),
  response: z.enum(["accept", "block"]),
});

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

export async function GET(request: Request) {
  const auth = await session();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "O diretório de amigos não está configurado." }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: relationships, error } = await auth.supabase
    .from("friendships")
    .select("id,requester_id,addressee_id,status,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Não foi possível carregar seus amigos." }, { status: 503 });

  const ids = [...new Set((relationships ?? []).flatMap((entry) => [entry.requester_id, entry.addressee_id]))]
    .filter((id) => id !== auth.userId);
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("id,username,display_name").in("id", ids)
    : { data: [] as Array<{ id: string; username: string; display_name: string }> };
  const safeProfiles = new Map((profiles ?? []).map((profile) => [profile.id, {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
  }]));
  const friendships = (relationships ?? []).map((entry) => {
    const otherId = entry.requester_id === auth.userId ? entry.addressee_id : entry.requester_id;
    return {
      id: entry.id,
      direction: entry.requester_id === auth.userId ? "outgoing" : "incoming",
      status: entry.status,
      player: safeProfiles.get(otherId) ?? { id: otherId, username: "viajante", displayName: "Viajante" },
      createdAt: entry.created_at,
    };
  });

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  let results: Array<{ id: string; username: string; displayName: string }> = [];
  if (query.length >= 3) {
    const normalized = query.replace(/[^a-zA-Z0-9_\- ]/g, "").slice(0, 30);
    if (normalized.length >= 3) {
      const { data } = await admin
        .from("profiles")
        .select("id,username,display_name")
        .or(`username.ilike.%${normalized}%,display_name.ilike.%${normalized}%`)
        .neq("id", auth.userId)
        .limit(8);
      const related = new Set(ids);
      results = (data ?? [])
        .filter((profile) => !related.has(profile.id))
        .map((profile) => ({ id: profile.id, username: profile.username, displayName: profile.display_name }));
    }
  }

  return NextResponse.json({ friendships, results, authority: "supabase" });
}

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json());
    const auth = await session();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (body.addresseeId === auth.userId) {
      return NextResponse.json({ error: "Você não pode adicionar a própria conta." }, { status: 400 });
    }
    const { data, error } = await auth.supabase
      .from("friendships")
      .insert({ requester_id: auth.userId, addressee_id: body.addresseeId })
      .select("id,status")
      .single();
    if (error) {
      return NextResponse.json(
        { error: error.code === "23505" ? "Já existe uma solicitação entre estas contas." : "A solicitação não pôde ser enviada." },
        { status: error.code === "23505" ? 409 : 503 },
      );
    }
    return NextResponse.json({ friendship: data, authority: "supabase" }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? "A conta escolhida é inválida." : "Não foi possível enviar a solicitação." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = respondSchema.parse(await request.json());
    const auth = await session();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const status = body.response === "accept" ? "accepted" : "blocked";
    const { data, error } = await auth.supabase
      .from("friendships")
      .update({ status })
      .eq("id", body.friendshipId)
      .select("id,status")
      .single();
    if (error) return NextResponse.json({ error: "A solicitação não está mais disponível." }, { status: 409 });
    return NextResponse.json({ friendship: data, authority: "supabase" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? "A resposta é inválida." : "Não foi possível responder." },
      { status: 400 },
    );
  }
}
