"use client";

import { ArrowRight, LockKeyhole, MapPinned, RotateCcw, Skull, Sparkles } from "@/components/ui/pixel-icon";
import { useEffect, useState } from "react";
import {
  ARPG_EXPEDITIONS,
  getArpgExpedition,
  type ArpgExpeditionId,
} from "@/game/arpg/content/expeditions";
import { readJsonResponse } from "@/lib/http/read-json-response";

type ActiveRunSummary = {
  runId: string;
  expeditionId: ArpgExpeditionId;
  currentRoom: number;
  clearedRoomCount: number;
  roomCount: number;
  stage?: 1 | 2 | 3 | 4 | 5;
  updatedAt: string;
};

export function ArpgExpeditionSelect({
  onSelect,
  restoreRemoteRun = true,
}: {
  onSelect: (id: ArpgExpeditionId, stage?: 1 | 2 | 3 | 4 | 5) => void;
  restoreRemoteRun?: boolean;
}) {
  const [activeRun, setActiveRun] = useState<ActiveRunSummary | null>(null);

  useEffect(() => {
    if (!restoreRemoteRun) return;
    const controller = new AbortController();
    void fetch("/api/arpg/run", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = await readJsonResponse<{ activeRun?: ActiveRunSummary | null }>(
          response,
          "A consulta da expedição ativa retornou uma resposta inválida.",
        );
        return payload.activeRun ?? null;
      })
      .then((run) => {
        if (!controller.signal.aborted) setActiveRun(run);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [restoreRemoteRun]);

  const activeExpedition = activeRun ? getArpgExpedition(activeRun.expeditionId) : null;

  return (
    <section className="arpg-expeditions">
      <header className="arpg-expeditions__hero">
        <div>
          <small>ROTAS DO CARTÓGRAFO</small>
          <h1>Escolha sua expedição</h1>
          <p>Escolha uma rota folclórica. A jornada avança por 1-1 até 3-5. Cada estágio monta 5–8 salas e apenas x-5 termina em uma Lenda corrompida.</p>
        </div>
        <MapPinned aria-hidden="true" />
      </header>

      {activeRun && activeExpedition ? (
        <section className="arpg-expedition-resume" aria-label="Run ativa">
          <div>
            <small>RUN ATIVA · CHECKPOINT SALVO</small>
            <strong>{activeExpedition.name}</strong>
            <span>{activeRun.stage ? `Estágio ${activeRun.expeditionId === "mata-encantada" ? 1 : activeRun.expeditionId === "arquipelago-das-mares" ? 2 : 3}-${activeRun.stage} · ` : ""}Sala {activeRun.currentRoom} · {activeRun.clearedRoomCount}/{activeRun.roomCount} salas limpas</span>
          </div>
          <button type="button" onClick={() => onSelect(activeRun.expeditionId, activeRun.stage ?? 1)}>
            <RotateCcw aria-hidden="true" /> Continuar run
          </button>
        </section>
      ) : null}

      <div className="arpg-expeditions__grid">
        {ARPG_EXPEDITIONS.map((expedition) => (
          <article
            key={expedition.id}
            className={`arpg-expedition-card ${expedition.available ? "is-available" : "is-locked"}`}
          >
            <div
              className="arpg-expedition-card__art"
              style={{ backgroundImage: `url(${expedition.background})` }}
            >
              <span>{expedition.available ? "DISPONÍVEL" : "EM PREPARAÇÃO"}</span>
              {!expedition.available ? <LockKeyhole aria-hidden="true" /> : null}
            </div>

            <div className="arpg-expedition-card__body">
              <small>{expedition.subtitle}</small>
              <h2>{expedition.name}</h2>
              <p>{expedition.description}</p>
              <div className="arpg-expedition-card__meta">
                <span><Skull /> {expedition.bossName}</span>
                <span><Sparkles /> {expedition.elementLabel}</span>
                <span>{expedition.roomCount} salas</span>
              </div>
              <div className="arpg-expedition-card__folklore">
                {expedition.folklore.map((name) => <span key={name}>{name}</span>)}
              </div>

              <button
                type="button"
                disabled={!expedition.available || Boolean(activeRun && activeRun.expeditionId !== expedition.id)}
                onClick={() => onSelect(expedition.id, activeRun?.expeditionId === expedition.id ? activeRun.stage ?? 1 : 1)}
              >
                {expedition.available ? (
                  <>{activeRun?.expeditionId === expedition.id ? "Continuar run" : "Preparar expedição"} <ArrowRight /></>
                ) : (
                  <>Próxima dungeon <LockKeyhole /></>
                )}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
