"use client";
import type { BossEncounterSnapshot } from "@/game/arpg/bosses/boss-encounter-controller";
import { arthurPixels } from "@/game/arpg/bosses/king-arthur/pixel-art";
import { introPose } from "@/game/arpg/bosses/boss-intro-controller";
import { bossById } from "@/game/arpg/bosses/registry";
import { purificationPose, purificationColor } from "@/game/arpg/bosses/boss-purification-controller";
import { PLAYABLE_LEGENDS } from "@/game/arpg/content/legends";
import type { ArpgRaidPlayerState } from "@/game/arpg/raid";
import { ARTHUR_WARD_RADIUS } from "@/game/arpg/bosses/king-arthur/playable-kit";

export function RoundTableWardView({ players, width, height, nowMs }: { players: readonly ArpgRaidPlayerState[]; width: number; height: number; nowMs: number }) {
  const wards = players.flatMap((player) => player.arthurOaths?.ward ? [player.arthurOaths.ward] : []).filter((ward, index, all) => nowMs < ward.expiresAtMs && all.findIndex((other) => other.x === ward.x && other.y === ward.y && other.expiresAtMs === ward.expiresAtMs) === index);
  return <svg className="forgotten-legend-effects" viewBox={"0 0 " + width + " " + height} aria-hidden="true">{wards.map((ward, index) => <circle key={index} cx={ward.x} cy={ward.y} r={ARTHUR_WARD_RADIUS} fill="#b1c2d7" fillOpacity={0.06} stroke="#d2bc82" strokeWidth={3} />)}</svg>;
}

export function ForgottenLegendActor({ encounter }: { encounter: BossEncounterSnapshot }) {
  const restored = ["RESTORED", "UNLOCK", "CLEARED"].includes(encounter.state);
  const pose = ["ROOM_ENTERED", "INTRO_LOCK", "AWAKENING"].includes(encounter.state)
    ? introPose(encounter.serverTimeMs - encounter.enteredAtMs, encounter.seenByAll)
    : encounter.state === "PURIFICATION" ? purificationPose(encounter.serverTimeMs - encounter.stateAtMs)
      : encounter.state === "DEFEATED" ? "kneeling" : restored ? "restored" : "ready";
  return <svg viewBox="0 0 64 80" width="128" height="160" shapeRendering="crispEdges" role="img" aria-label="Rei Arthur, ilustração pixel-art temporária">
    {arthurPixels(pose, restored).map((p, index) => <rect key={index} x={p.x} y={p.y} width={p.width} height={p.height} fill={"#" + p.color.toString(16).padStart(6, "0")} />)}
  </svg>;
}
export function BossEncounterView({ encounter, width, height, players, onSkip }: {
  encounter: BossEncounterSnapshot; width: number; height: number;
  players: readonly ArpgRaidPlayerState[]; onSkip: () => void;
}) {
  const definition = bossById(encounter.bossId);
  const intro = ["ROOM_ENTERED", "INTRO_LOCK", "AWAKENING"].includes(encounter.state);
  const restored = ["RESTORED", "UNLOCK", "CLEARED"].includes(encounter.state);
  const title = restored ? "LENDA RESTAURADA • " + definition.title
    : encounter.state === "PURIFICATION" ? "Não viemos destruir as histórias esquecidas. Viemos fazê-las lembrar."
      : encounter.state === "DEFEATED" ? "RECORDAÇÃO" : intro ? definition.corruptedTitle : definition.phases[encounter.phase - 1].title;
  return <>
    <svg className="forgotten-legend-effects" viewBox={"0 0 " + width + " " + height} preserveAspectRatio="none" aria-hidden="true">
      {encounter.bossId === "king-arthur" ? <g fill="#515664">
        <rect x={width / 2 - 64} y={40} width={128} height={140} />
        <rect x={width / 2 - 90} y={180} width={180} height={12} fill="#ac9a72" />
        {[80, width - 120].flatMap((x) => [160, 420, 680].map((y) => <g key={x + ":" + y}>
          <rect x={x} y={y} width={35} height={80} /><rect x={x + 10} y={y + 24} width={6} height={20} fill="#262f3e" />
          <rect x={x + 48} y={y} width={32} height={64} fill="#3e5575" />
        </g>))}
      </g> : null}
      {encounter.hazards.map((hazard) => {
        const color = encounter.serverTimeMs >= hazard.impactAtMs ? "#f1e6c7" : "#c7b6d9";
        const start = hazard.angle - hazard.arc / 2, end = hazard.angle + hazard.arc / 2;
        const path = "M " + hazard.x + " " + hazard.y + " L " + (hazard.x + Math.cos(start) * hazard.radius) + " " + (hazard.y + Math.sin(start) * hazard.radius) + " A " + hazard.radius + " " + hazard.radius + " 0 " + (hazard.arc > Math.PI ? 1 : 0) + " 1 " + (hazard.x + Math.cos(end) * hazard.radius) + " " + (hazard.y + Math.sin(end) * hazard.radius) + " Z";
        return <g key={hazard.id} fill={color} fillOpacity={0.24} stroke={color} strokeWidth={4}>
          {hazard.shape === "arc" && hazard.arc < Math.PI * 2 - 0.001 ? <path d={path} /> : hazard.shape === "circle" || hazard.shape === "arc" ? <circle cx={hazard.x} cy={hazard.y} r={hazard.radius} /> : <rect x={hazard.x - hazard.width / 2} y={hazard.y - hazard.height / 2} width={hazard.width} height={hazard.height} transform={"rotate(" + hazard.angle * 180 / Math.PI + " " + hazard.x + " " + hazard.y + ")"} />}
        </g>;
      })}
      {encounter.state === "PURIFICATION" ? players.map((player) => {
        const legend = PLAYABLE_LEGENDS.find((legend) => legend.signatureAbilityIds.every((id) => player.loadout.abilityIds.includes(id)));
        return <line key={player.id} x1={player.x} y1={player.y} x2={encounter.x} y2={encounter.y} stroke={"#" + purificationColor(legend?.id ?? "").toString(16)} strokeWidth={5} />;
      }) : null}
    </svg>
    <div className="forgotten-legend-title" role="status">
      {title}
      {encounter.state === "RESTORED" ? <small>Confirmando restauração…</small> : null}
      {encounter.state === "CLEARED" ? <small>{definition.unlock.label}</small> : null}
      {intro && encounter.seenByAll ? <button type="button" onClick={onSkip}>Pular recordação ({encounter.skipVotes.length}/{encounter.participantIds.length})</button> : null}
      {encounter.state === "PURIFICATION" && encounter.serverTimeMs - encounter.stateAtMs > 3400 ? <small>{definition.purification.dialogue[encounter.serverTimeMs - encounter.stateAtMs > 5000 ? 1 : 0]}</small> : null}
    </div>
  </>;
}
