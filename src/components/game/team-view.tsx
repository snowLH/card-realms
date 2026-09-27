"use client";

import { CheckCircle2, Layers3, Plus, Sparkles } from "lucide-react";
import { CREATURE_BY_ID, STARTER_TEAM_IDS } from "@/game/catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreatureCard } from "./creature-card";

export function TeamView({ teamIds, teamName }: { teamIds?: string[]; teamName?: string }) {
  const remoteTeam = teamIds
    ?.map((id) => CREATURE_BY_ID.get(id))
    .filter((creature) => creature !== undefined);
  const resolvedTeam = remoteTeam?.length === 6
    ? remoteTeam
    : STARTER_TEAM_IDS.map((id) => CREATURE_BY_ID.get(id)).filter(
      (creature) => creature !== undefined,
    );
  return (
    <section className="content-view team-view">
      <header className="view-heading">
        <div>
          <span className="view-eyebrow">Equipe ativa</span>
          <h1>Seis cartas. Uma estratégia.</h1>
          <p>
            Sua coleção pode crescer sem limite, mas apenas estas seis criaturas entram em cada batalha. Energias e suportes usam um baralho separado.
          </p>
        </div>
        <Button variant="secondary" disabled title="Gerenciamento de equipes em desenvolvimento"><Plus /> Nova equipe</Button>
      </header>

      <div className="team-meta">
        <div><Layers3 /><span><strong>{teamName ?? "Equipe Atlas I"}</strong><small>Exploração e santuários</small></span></div>
        <Badge className="border-emerald-300/30 bg-emerald-300/10 text-emerald-200"><CheckCircle2 /> Equipe ativa</Badge>
      </div>

      <div className="team-grid">
        {resolvedTeam.map((creature, index) => {
          return (
            <div className="team-slot" key={creature.id}>
              <span className="team-slot__number">{index + 1}</span>
              <CreatureCard creature={creature} />
            </div>
          );
        })}
      </div>

      <div className="team-tip">
        <Sparkles />
        <div>
          <strong>Tipos complementares</strong>
          <p>Esta formação usa os cinco elementos-base. Trocas voluntárias consomem a ação principal; prepare equipes diferentes para cada desafio.</p>
        </div>
      </div>
    </section>
  );
}
