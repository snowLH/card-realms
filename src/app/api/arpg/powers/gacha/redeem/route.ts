import { NextResponse } from "next/server";
import { z } from "zod";
import { ARPG_ABILITY_CARD_BY_ID } from "@/game/arpg/content/ability-cards";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  accountId: z.string().uuid(),
  cardId: z.string().min(1).max(80),
  idempotencyKey: z.string().uuid(),
}).strict();

const resultSchema = z.object({
  itemId: z.string().min(1).max(80),
  rarity: z.enum(["common", "uncommon", "rare", "epic", "legendary", "mythic"]),
  tier: z.enum(["common", "uncommon", "rare", "epic", "legendary"]),
  fragmentsSpent: z.number().int().positive(),
  legendFragments: z.number().int().nonnegative(),
  ownedCardIds: z.array(z.string().min(1).max(80)),
  replayed: z.boolean(),
}).strict();

type AuthenticatedClientResult =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | { ok: false; response: NextResponse };

async function authenticatedClient(): Promise<AuthenticatedClientResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, response: NextResponse.json({ error: "O Arquivo está indisponível no momento." }, { status: 503 }) };
  }

  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || typeof claims?.claims?.sub !== "string") {
    return { ok: false, response: NextResponse.json({ error: "Entre na conta para resgatar poderes." }, { status: 401 }) };
  }
  return { ok: true, supabase, userId: claims.claims.sub };
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = requestSchema.parse(await request.json());
    const card = ARPG_ABILITY_CARD_BY_ID.get(body.cardId);
    if (!card?.purchasable) {
      return NextResponse.json({ error: "Este poder não está disponível para resgate." }, { status: 400 });
    }

    const auth = await authenticatedClient();
    if (!auth.ok) return auth.response;
    if (auth.userId !== body.accountId) {
      return NextResponse.json({ error: "A sessão mudou. Atualize o Arquivo antes de resgatar." }, { status: 401 });
    }

    const { data, error } = await auth.supabase.rpc("redeem_arpg_power_gacha_card", {
      target_user_id: body.accountId,
      target_card_id: body.cardId,
      target_idempotency_key: body.idempotencyKey,
    });
    if (error) {
      const status = error.code === "42501" ? 401
        : error.code === "P0002" ? 404
          : error.code === "23505" || error.code === "22023" ? 409
            : 503;
      const message = error.code === "42501"
        ? "A sessão mudou. Atualize o Arquivo antes de resgatar."
        : error.code === "23505"
          ? "Este poder já pertence à sua coleção."
          : error.code === "22023" && error.message?.toLowerCase().includes("fragmentos insuficientes")
            ? "Você ainda não tem fragmentos suficientes para este poder."
            : "O resgate não pôde ser concluído.";
      return NextResponse.json({ error: message }, { status });
    }

    const result = resultSchema.safeParse(data);
    if (!result.success || result.data.itemId !== body.cardId) {
      return NextResponse.json({ error: "A resposta do Arquivo é incompatível." }, { status: 503 });
    }
    return NextResponse.json({ ...result.data, authority: "server" }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? "Os dados deste resgate são inválidos."
      : "O resgate não pôde ser concluído.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
