import { NextResponse } from "next/server";
import { z } from "zod";
import { ARPG_ABILITY_CARD_BY_ID } from "@/game/arpg/content/ability-cards";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tierSchema = z.enum(["common", "uncommon", "rare", "epic", "legendary"]);
const raritySchema = z.enum(["common", "uncommon", "rare", "epic", "legendary", "mythic"]);
const probabilitiesSchema = z.object({
  common: z.number().min(0).max(100),
  uncommon: z.number().min(0).max(100),
  rare: z.number().min(0).max(100),
  epic: z.number().min(0).max(100),
  legendary: z.number().min(0).max(100),
}).strict();

const stateSchema = z.object({
  accountId: z.string().uuid(),
  cost: z.number().int().positive(),
  coins: z.number().int().nonnegative(),
  legendFragments: z.number().int().nonnegative(),
  ownedCardIds: z.array(z.string().min(1).max(80)),
  fragmentCosts: z.object({
    common: z.number().int().positive(),
    uncommon: z.number().int().positive(),
    rare: z.number().int().positive(),
    epic: z.number().int().positive(),
    legendary: z.number().int().positive(),
    mythic: z.number().int().positive(),
  }).strict(),
  pityMisses: z.number().int().min(0).max(19),
  softPityStartsAtMisses: z.number().int().positive(),
  hardPityAfterMisses: z.number().int().positive(),
  rollsUntilGuaranteedEpic: z.number().int().min(0).max(20),
  probabilities: probabilitiesSchema,
}).strict();

const rollResultSchema = z.object({
  coins: z.number().int().nonnegative(),
  itemId: z.string().min(1).max(80),
  rarity: raritySchema,
  tier: tierSchema,
  duplicate: z.boolean(),
  fragmentsAwarded: z.number().int().nonnegative(),
  legendFragments: z.number().int().nonnegative(),
  pityMisses: z.number().int().min(0).max(19),
  rollsUntilGuaranteedEpic: z.number().int().min(0).max(20),
  probabilities: probabilitiesSchema,
  replayed: z.boolean(),
}).strict();

const requestSchema = z.object({
  accountId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
}).strict();

type AuthenticatedClientResult =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | { ok: false; response: NextResponse };

function rpcStatus(code: string) {
  if (code === "42501") return 401;
  if (code === "P0002") return 404;
  if (code === "22023") return 409;
  return 503;
}

async function authenticatedClient(): Promise<AuthenticatedClientResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, response: NextResponse.json({ error: "O Arquivo está indisponível no momento." }, { status: 503 }) };
  }

  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || typeof claims?.claims?.sub !== "string") {
    return { ok: false, response: NextResponse.json({ error: "Entre na conta para usar a roletagem." }, { status: 401 }) };
  }
  return { ok: true, supabase, userId: claims.claims.sub };
}

export async function GET(): Promise<NextResponse> {
  try {
    const auth = await authenticatedClient();
    if (!auth.ok) return auth.response;

    const { data, error } = await auth.supabase.rpc("get_arpg_power_gacha_state");
    if (error) {
      return NextResponse.json({ error: "O estado da roletagem não pôde ser carregado." }, { status: rpcStatus(error.code) });
    }

    const result = stateSchema.safeParse(data);
    if (!result.success) {
      return NextResponse.json({ error: "A resposta do Arquivo é incompatível." }, { status: 503 });
    }
    return NextResponse.json({ ...result.data, authority: "server" }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "O estado da roletagem não pôde ser carregado." }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = requestSchema.parse(await request.json());
    const auth = await authenticatedClient();
    if (!auth.ok) return auth.response;
    if (auth.userId !== body.accountId) {
      return NextResponse.json({ error: "A sessão mudou. Atualize o Arquivo antes de rolar." }, { status: 401 });
    }

    const { data, error } = await auth.supabase.rpc("roll_arpg_power_gacha", {
      target_idempotency_key: body.idempotencyKey,
      target_user_id: body.accountId,
    });
    if (error) {
      const status = rpcStatus(error.code);
      const message = error.code === "22023" && error.message?.includes("Moedas insuficientes")
        ? "Você precisa de 80 moedas para esta roletagem."
        : status === 401
          ? "Entre na conta para usar a roletagem."
          : "A roletagem não pôde ser concluída.";
      return NextResponse.json({ error: message }, { status });
    }

    const result = rollResultSchema.safeParse(data);
    if (!result.success || !ARPG_ABILITY_CARD_BY_ID.has(result.data.itemId)) {
      return NextResponse.json({ error: "A resposta do Arquivo é incompatível." }, { status: 503 });
    }
    return NextResponse.json({ ...result.data, authority: "server" }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? "A chave desta rolagem é inválida."
      : "A roletagem não pôde ser concluída.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
