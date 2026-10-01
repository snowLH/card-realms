import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createRaidState, visibleRaidState } from "@/game/raid";
import { ELEMENTS, emptyEnergyPool, type Element } from "@/game/domain/elements";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { loadRaidRoom, RaidRoomAccessError } from "@/server/raid/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const StartRaidSchema = z.strictObject({
  roomId: z.string().uuid(),
});

const TeamSnapshotSchema = z.array(z.object({
  catalogId: z.string().min(1),
})).length(6);

const BossConfigSchema = z.object({
  maxHp: z.number().int().positive().default(10000),
  speed: z.number().int().nonnegative().default(60),
  maxRounds: z.number().int().positive().default(30),
}).passthrough();

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
    }
    const body = StartRaidSchema.parse(await request.json());
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const actorId = claimsData?.claims?.sub;
    if (claimsError || typeof actorId !== "string") {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const { admin, room, event, participants } = await loadRaidRoom(body.roomId, actorId);
    if (room.host_id !== actorId) {
      return NextResponse.json({ error: "Somente o anfitrião pode iniciar a Raid." }, { status: 403 });
    }
    if (room.status !== "lobby") {
      return NextResponse.json({ error: "A sala já foi iniciada." }, { status: 409 });
    }
    if (participants.length < event.min_players || participants.length > event.max_players) {
      return NextResponse.json(
        { error: `A Raid exige entre ${event.min_players} e ${event.max_players} jogadores.` },
        { status: 409 },
      );
    }
    if (participants.some((participant) => !participant.is_ready)) {
      return NextResponse.json({ error: "Todos os jogadores precisam estar prontos." }, { status: 409 });
    }

    const participantIds = participants.map((participant) => participant.user_id);
    const { data: energyRows, error: energyError } = await admin
      .from("player_energy_inventory")
      .select("user_id,element,quantity")
      .in("user_id", participantIds);
    if (energyError) {
      return NextResponse.json({ error: "Não foi possível carregar as Energias das equipes." }, { status: 503 });
    }

    const energyByPlayer = new Map(participantIds.map((id) => [id, emptyEnergyPool()]));
    for (const row of energyRows ?? []) {
      if (ELEMENTS.includes(row.element as Element)) {
        energyByPlayer.get(row.user_id)![row.element as Element] = Math.max(0, row.quantity);
      }
    }

    const boss = BossConfigSchema.parse(event.boss_config);
    const random = () => randomInt(0, 0x1000000) / 0x1000000;
    const state = createRaidState(
      room.id,
      event.id,
      participants.map((participant) => ({
        id: participant.user_id,
        name: participant.name,
        seat: participant.seat,
        teamIds: TeamSnapshotSchema.parse(participant.team_snapshot).map((entry) => entry.catalogId),
        energy: energyByPlayer.get(participant.user_id)!,
      })),
      {
        catalogId: event.boss_creature_id,
        maxHp: boss.maxHp,
        speed: boss.speed,
        maxRounds: boss.maxRounds,
      },
      random,
    );

    const { data: committed, error: startError } = await admin.rpc("start_raid_room", {
      target_room_id: room.id,
      submitted_state: state,
    });
    if (startError) {
      console.error("Falha ao iniciar Raid.", startError.code);
      return NextResponse.json({ error: "A Raid não pôde ser iniciada." }, { status: 409 });
    }

    const committedState = z.object({ state: z.unknown(), version: z.number() }).parse(committed);
    const visible = visibleRaidState(state, actorId);
    return NextResponse.json({
      state: visible.state,
      hidden: visible.hidden,
      version: committedState.version,
      roomId: room.id,
      authority: "server",
    });
  } catch (caught) {
    if (caught instanceof RaidRoomAccessError) {
      return NextResponse.json({ error: caught.message }, { status: 404 });
    }
    if (caught instanceof z.ZodError) {
      return NextResponse.json({ error: "Configuração da Raid inválida." }, { status: 400 });
    }
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : "Não foi possível iniciar a Raid." },
      { status: 400 },
    );
  }
}
