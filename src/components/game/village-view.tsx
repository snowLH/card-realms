"use client";

import Image from "next/image";
import { ArrowLeft, Coins, PackagePlus, ShoppingBag, Sparkles, TentTree } from "lucide-react";
import { ELEMENTS, type Element, type EnergyPool } from "@/game/types";
import { ELEMENT_META } from "@/game/catalog";
import { Button } from "@/components/ui/button";

const packs = [
  { quantity: 1 as const, price: 18, label: "+1 energia" },
  { quantity: 5 as const, price: 75, label: "+5 energias" },
];

export function VillageView({
  coins,
  energy,
  onBack,
  onBuy,
}: {
  coins: number;
  energy: EnergyPool;
  onBack: () => void;
  onBuy: (element: Element, quantity: 1 | 5, price: number) => Promise<void> | void;
}) {
  return (
    <section className="village-view" aria-labelledby="village-title">
      <header className="village-view__header">
        <Button type="button" variant="secondary" onClick={onBack}><ArrowLeft /> Voltar ao Atlas</Button>
        <div><span className="view-eyebrow">Entreposto de Aurória</span><h1 id="village-title">Vila Cartógrafa</h1><p>Recupere suprimentos, prepare seus baralhos e encontre viajantes antes da próxima expedição.</p></div>
        <div className="village-wallet"><Coins /><strong>{coins.toLocaleString("pt-BR")}</strong><span>moedas</span></div>
      </header>

      <div className="village-scene">
        <Image src="/art/village-tavern-reference.jpeg" alt="Taverna da Vila Cartógrafa vista de cima em arte 2D" fill sizes="100vw" className="object-cover [image-rendering:pixelated]" />
        <div className="village-scene__shade" />
        <span className="village-scene__sign"><TentTree /> Empório das Cinco Rotas</span>
      </div>

      <div className="village-shop">
        <div className="village-shop__intro"><ShoppingBag /><div><strong>Mercadora de energias</strong><span>Compre cartas de energia com moedas ganhas em combates e baús.</span></div></div>
        <div className="village-shop__grid">
          {ELEMENTS.map((element) => {
            const meta = ELEMENT_META[element];
            return (
              <article className="village-energy" key={element} style={{ "--energy": meta.color } as React.CSSProperties}>
                <div className="village-energy__icon"><Sparkles /><span>{meta.short}</span></div>
                <div><strong>{meta.name}</strong><span>Você possui {energy[element]}</span></div>
                <div className="village-energy__packs">
                  {packs.map((pack) => (
                    <button key={pack.quantity} type="button" disabled={coins < pack.price} onClick={() => void onBuy(element, pack.quantity, pack.price)}>
                      <PackagePlus /> <span>{pack.label}</span><strong><Coins /> {pack.price}</strong>
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
