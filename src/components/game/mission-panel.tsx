"use client";

import { Check, ChevronLeft, ChevronRight, Gift, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { RemotePlayerSnapshot } from "@/game/player";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Mission = RemotePlayerSnapshot["missions"][number];

export function MissionPanel({
  missions,
  onClaim,
}: {
  missions: Mission[];
  onClaim?: (missionId: string) => Promise<void>;
}) {
  const visible = useMemo(
    () => missions.filter((mission) => !mission.claimedAt),
    [missions],
  );
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (index >= visible.length) setIndex(0);
  }, [index, visible.length]);

  if (visible.length === 0) {
    return (
      <div className="side-quest side-quest--complete">
        <span>Missões</span>
        <strong><Check /> Tudo concluído</strong>
        <p>As missões disponíveis desta etapa já foram resgatadas.</p>
      </div>
    );
  }

  const mission = visible[index];
  const progress = Math.min(mission.target, mission.progress);
  const percent = Math.min(100, (progress / mission.target) * 100);
  const complete = Boolean(mission.completedAt) || progress >= mission.target;
  const rewards = mission.rewards as Record<string, unknown>;
  const rewardCoins = Number(rewards.coins) || 0;
  const rewardXp = Number(rewards.xp) || 0;

  async function claim() {
    if (!onClaim || !complete || mission.claimedAt) return;
    setBusy(true);
    setMessage("");
    try {
      await onClaim(mission.id);
      setMessage("Recompensa resgatada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível resgatar a missão.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("side-quest", complete && "is-complete")}>
      <div className="side-quest__nav">
        <span>Missão ativa</span>
        {visible.length > 1 ? (
          <div>
            <button type="button" onClick={() => setIndex((current) => (current - 1 + visible.length) % visible.length)} aria-label="Missão anterior"><ChevronLeft /></button>
            <small>{index + 1}/{visible.length}</small>
            <button type="button" onClick={() => setIndex((current) => (current + 1) % visible.length)} aria-label="Próxima missão"><ChevronRight /></button>
          </div>
        ) : null}
      </div>
      <strong>{mission.title}</strong>
      <p>{mission.description}</p>
      <div className="side-quest__progress"><span style={{ width: percent + "%" }} /></div>
      <small>{progress}/{mission.target} · {rewardCoins} moedas{rewardXp ? " · " + rewardXp + " XP" : ""}</small>
      {complete ? (
        <Button size="sm" variant="game" disabled={!onClaim || busy} onClick={() => void claim()}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Gift />}
          Resgatar
        </Button>
      ) : null}
      {message ? <em role="status">{message}</em> : null}
    </div>
  );
}
