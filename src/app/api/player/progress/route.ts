import { NextResponse } from "next/server";
import { z } from "zod";
import { ARPG_MERCHANT_PRODUCT_KEYS } from "@/game/arpg/content/merchant-catalog";
import { loadAuthenticatedPlayerBootstrap } from "@/server/player/progress";
import {
  REFUGE_FURNITURE_KEYS,
  REFUGE_FURNITURE_UNLOCK_ITEM_KEYS,
  REFUGE_THEMES,
} from "@/game/refuge";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { PATCH as saveArpgLoadout } from "@/server/http-handlers/arpg-loadout";
import { POST as purchaseArpgPower } from "@/server/http-handlers/arpg-power-purchase";
import { PATCH as saveAvatar } from "@/server/http-handlers/player-avatar";
import { POST as purchaseLegend } from "@/server/http-handlers/player-legend-purchase";
import { GET as authCallback } from "@/server/http-handlers/auth-callback";
import { GET as loadPreferences, PATCH as savePreferences } from "@/server/http-handlers/player-preferences";
import { GET as loadRaidLobby, POST as updateRaidLobby } from "@/server/http-handlers/arpg-raid-lobby";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function delegatedHandler(request: Request) {
  return new URL(request.url).searchParams.get("handler");
}

const refugeFurnitureSchema = z.object({
  id: z.string().min(1).max(100),
  itemKey: z.enum(REFUGE_FURNITURE_KEYS),
  x: z.number().min(8).max(92),
  y: z.number().min(24).max(88),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
});

const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("travel"), regionId: z.string().min(1).max(80) }),
  z.object({ action: z.literal("claim_treasure"), regionId: z.string().min(1).max(80) }),
  z.object({
    action: z.literal("visit_area"),
    regionId: z.string().min(1).max(80),
    areaId: z.string().min(1).max(80),
  }),
  z.object({
    action: z.literal("save_position"),
    regionId: z.string().min(1).max(80),
    x: z.number().int().min(0).max(39),
    y: z.number().int().min(0).max(24),
  }),
  z.object({
    action: z.literal("buy_merchant_item"),
    itemKey: z.string().min(1).max(80).refine((itemKey) => ARPG_MERCHANT_PRODUCT_KEYS.has(itemKey)),
  }),
  z.object({ action: z.literal("activate_team"), teamId: z.string().uuid() }),
  z.object({
    action: z.literal("save_team"),
    memberIds: z.array(z.string().uuid()).min(1).max(6),
    name: z.string().trim().min(1).max(60).optional(),
  }),
  z.object({ action: z.literal("claim_mission"), missionId: z.string().min(1).max(80) }),
  z.object({
    action: z.literal("save_refuge"),
    companionId: z.string().min(1).max(80).nullable(),
    theme: z.enum(REFUGE_THEMES),
    furniture: z.array(refugeFurnitureSchema).max(12),
  }),
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
  return { ok: true, supabase, userId: data.claims.sub } as const;
}

export async function GET(request: Request) {
  const handler = delegatedHandler(request);
  if (handler === "auth") {
    return authCallback(request);
  }
  if (handler === "preferences") return loadPreferences();
  if (handler === "raids") {
    return loadRaidLobby();
  }
  if (handler !== null) {
    return NextResponse.json({ error: "Método não permitido." }, { status: 405 });
  }

  const auth = await authenticatedClient();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const bootstrap = await loadAuthenticatedPlayerBootstrap(auth.supabase, { id: auth.userId, email: null });
  if (bootstrap.source !== "supabase" || !bootstrap.snapshot) {
    return NextResponse.json({ error: bootstrap.error ?? "Não foi possível carregar o progresso." }, { status: 503 });
  }
  return NextResponse.json({ snapshot: bootstrap.snapshot, authority: "supabase" }, {
    headers: { "cache-control": "private, no-store" },
  });
}
export async function POST(request: Request) {
  switch (delegatedHandler(request)) {
    case "raids":
      return updateRaidLobby(request);
    case "power":
      return purchaseArpgPower(request);
    case "legend":
      return purchaseLegend(request);
    default:
      return NextResponse.json({ error: "Ação de progresso inválida." }, { status: 405 });
  }
}

export async function PATCH(request: Request) {
  const handler = delegatedHandler(request);
  switch (handler) {
    case "preferences":
      return savePreferences(request);
    case "loadout":
      return saveArpgLoadout(request);
    case "avatar":
      return saveAvatar(request);
  }
  if (handler !== null) {
    return NextResponse.json({ error: "Método não permitido." }, { status: 405 });
  }

  try {
    const payload = mutationSchema.parse(await request.json());
    const auth = await authenticatedClient();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (payload.action === "activate_team" || payload.action === "save_team") {
      return NextResponse.json(
        { error: "Equipes de criaturas foram desativadas; escolha uma Lenda e configure seus dois poderes." },
        { status: 410 },
      );
    }

    if (payload.action === "claim_mission") {
      const { data, error } = await auth.supabase.rpc("claim_mission_reward", {
        target_mission_id: payload.missionId,
      });
      if (error) {
        const conflict = error.code === "22023" || error.code === "P0002";
        return NextResponse.json(
          { error: conflict ? error.message : "Não foi possível resgatar a missão." },
          { status: conflict ? 409 : 503 },
        );
      }
      return NextResponse.json({ result: data, authority: "supabase" });
    }

    if (payload.action === "save_refuge") {
      const requiredCosmeticKeys = [...new Set(payload.furniture
        .map((item) => REFUGE_FURNITURE_UNLOCK_ITEM_KEYS[item.itemKey])
        .filter((itemKey): itemKey is string => Boolean(itemKey)))];
      if (requiredCosmeticKeys.length > 0) {
        const { data: ownedCosmetics, error: cosmeticsError } = await auth.supabase
          .from("inventory_items")
          .select("item_key,quantity")
          .eq("user_id", auth.userId)
          .in("item_key", requiredCosmeticKeys);
        if (cosmeticsError) {
          return NextResponse.json({ error: "Não foi possível validar os cosméticos do Refúgio." }, { status: 503 });
        }
        const ownedCosmeticKeys = new Set((ownedCosmetics ?? [])
          .filter((item) => item.quantity > 0)
          .map((item) => item.item_key));
        if (requiredCosmeticKeys.some((itemKey) => !ownedCosmeticKeys.has(itemKey))) {
          return NextResponse.json(
            { error: "Compre os móveis especiais no Mercador antes de usá-los no Refúgio." },
            { status: 409 },
          );
        }
      }

      if (payload.companionId) {
        const { data: owned, error: ownedError } = await auth.supabase
          .from("player_creatures")
          .select("id")
          .eq("user_id", auth.userId)
          .eq("creature_id", payload.companionId)
          .limit(1)
          .maybeSingle();
        if (ownedError) {
          return NextResponse.json({ error: "Não foi possível validar a lenda escolhida." }, { status: 503 });
        }
        if (!owned) {
          return NextResponse.json(
            { error: "Você só pode exibir no Refúgio uma lenda que realmente possui." },
            { status: 409 },
          );
        }
      }

      const { data: house, error: houseError } = await auth.supabase
        .from("houses")
        .select("layout")
        .eq("user_id", auth.userId)
        .single();
      if (houseError || !house) {
        return NextResponse.json({ error: "O Refúgio desta conta não foi encontrado." }, { status: 404 });
      }

      const previousLayout = house.layout
        && typeof house.layout === "object"
        && !Array.isArray(house.layout)
        ? house.layout as Record<string, unknown>
        : {};
      const nextLayout = {
        ...previousLayout,
        residentCreatureId: payload.companionId,
        furniture: payload.furniture,
      };

      const { data: updatedHouse, error: updateError } = await auth.supabase
        .from("houses")
        .update({ theme: payload.theme, layout: nextLayout })
        .eq("user_id", auth.userId)
        .select("id,theme,layout")
        .single();
      if (updateError || !updatedHouse) {
        return NextResponse.json({ error: "Não foi possível salvar a decoração do Refúgio." }, { status: 503 });
      }

      return NextResponse.json({
        result: {
          companionId: payload.companionId,
          theme: updatedHouse.theme,
          furniture: payload.furniture,
        },
        authority: "supabase",
      });
    }

    const rpc = payload.action === "travel"
      ? auth.supabase.rpc("travel_to_region", { target_region_id: payload.regionId })
      : payload.action === "claim_treasure"
        ? auth.supabase.rpc("claim_region_treasure", { target_region_id: payload.regionId })
        : payload.action === "visit_area"
          ? auth.supabase.rpc("visit_region_area", {
              target_region_id: payload.regionId,
              target_area_id: payload.areaId,
            })
          : payload.action === "save_position"
            ? auth.supabase.rpc("save_world_position", {
                target_region_id: payload.regionId,
                target_x: payload.x,
                target_y: payload.y,
              })
          : auth.supabase.rpc("purchase_arpg_merchant_item", {
              target_item_key: payload.itemKey,
            });

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
