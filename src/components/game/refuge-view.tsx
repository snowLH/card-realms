"use client";

import Image from "next/image";
import { Armchair, Lock, Move, Trophy } from "lucide-react";
import { CREATURE_BY_ID } from "@/game/catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PixelCreature } from "./pixel-creature";

export function RefugeView() {
  const companion = CREATURE_BY_ID.get("boto-cor-de-rosa")!;
  return (
    <section className="content-view refuge-view">
      <header className="view-heading">
        <div>
          <span className="view-eyebrow">Hub pessoal</span>
          <h1>Refúgio do Cartógrafo</h1>
          <p>Um espaço 2D em pixel art para exibir criaturas, relíquias e a história da sua jornada.</p>
        </div>
        <Button variant="secondary" disabled title="Editor do refúgio em desenvolvimento"><Armchair /> Decorar</Button>
      </header>

      <div className="refuge-room">
        <Image
          src="/art/refuge-pixel.png"
          alt="Refúgio de cartógrafo em pixel art, com mapas, estantes, mesa e lareira"
          fill
          sizes="(max-width: 768px) 100vw, calc(100vw - 300px)"
          className="object-cover [image-rendering:pixelated]"
        />
        <div className="refuge-companion">
          <PixelCreature sprite={companion.sprite} label={`${companion.name} descansando no refúgio`} />
          <span>{companion.name}</span>
        </div>
        <button type="button" className="refuge-hotspot refuge-hotspot--trophy" disabled title="Troféus em desenvolvimento"><Trophy /><span>Exibir troféu</span></button>
        <button type="button" className="refuge-hotspot refuge-hotspot--floor" disabled title="Editor do refúgio em desenvolvimento"><Move /><span>Posicionar móvel</span></button>
      </div>

      <div className="refuge-status">
        <Badge>Privacidade: somente amigos</Badge>
        <p><Lock /> Visitas serão liberadas quando a sincronização de amigos estiver conectada ao Supabase.</p>
      </div>
    </section>
  );
}
