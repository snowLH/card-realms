"use client";

import { ArrowRight, LockKeyhole, MapPinned, RotateCcw, Skull, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import {
  ARPG_EXPEDITIONS,
  getArpgExpedition,
  type ArpgExpeditionId,
} from "@/game/arpg/content/expeditions";

type ActiveRunSummary = {
  runId: string;
  expeditionId: ArpgExpeditionId;
  currentRoom: number;
  clearedRoomCount: number;
  roomCount: number;
  updatedAt: string;
};

export function ArpgExpeditionSelect({
  onSelect,
}: {
  onSelect: (id: ArpgExpeditionId) => void;
}) {
  const [activeRun, setActiveRun] = useState<ActiveRunSummary | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/arpg/run", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = await response.json() as { activeRun?: ActiveRunSummary | null };
        return payload.activeRun ?? null;
      })
      .then((run) => {
        if (!controller.signal.aborted) setActiveRun(run);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const activeExpedition = activeRun ? getArpgExpedition(activeRun.expeditionId) : null;

  return (
    <section className="arpg-expeditions">
      <header className="arpg-expeditions__hero">
        <div>
          <small>ROTAS DO CARTÓGRAFO</small>
          <h1>Escolha sua expedição</h1>
          <p>Escolha uma rota folclórica. Cada run monta 8–12 salas até um encontro folclórico final.</p>
        </div>
        <MapPinned aria-hidden="true" />
      </header>

      {activeRun && activeExpedition ? (
        <section className="arpg-expedition-resume" aria-label="Run ativa">
          <div>
            <small>RUN ATIVA · CHECKPOINT SALVO</small>
            <strong>{activeExpedition.name}</strong>
            <span>Sala {activeRun.currentRoom} · {activeRun.clearedRoomCount}/{activeRun.roomCount} salas limpas</span>
          </div>
          <button type="button" onClick={() => onSelect(activeRun.expeditionId)}>
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
              style={{ backgroundImage: `linear-gradient(180deg, transparent, rgba(17, 10, 8, .9)), url(${expedition.background})` }}
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
                onClick={() => onSelect(expedition.id)}
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
