"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowLeft, Check, Coins, PackagePlus, ShoppingBag, TentTree } from "lucide-react";
import { ARPG_MERCHANT_PRODUCTS } from "@/game/arpg/content/merchant-catalog";
import { ArpgItemPixelIcon } from "@/components/arpg/item-pixel-icon";
import { Button } from "@/components/ui/button";

export function VillageView({
  coins,
  ownedItemKeys,
  onBack,
  onBuyItem,
  backLabel = "Voltar ao Atlas",
}: {
  coins: number;
  ownedItemKeys: string[];
  onBack: () => void;
  onBuyItem: (itemKey: string) => Promise<void> | void;
  backLabel?: string;
}) {
  const [pendingItemKey, setPendingItemKey] = useState<string | null>(null);

  async function buyItem(itemKey: string) {
    setPendingItemKey(itemKey);
    try {
      await onBuyItem(itemKey);
    } finally {
      setPendingItemKey(null);
    }
  }

  return (
    <section className="village-view" aria-labelledby="village-title">
      <header className="village-view__header">
        <Button type="button" variant="secondary" onClick={onBack}><ArrowLeft /> {backLabel}</Button>
        <div><span className="view-eyebrow">Entreposto de Aurória</span><h1 id="village-title">Vila Cartógrafa</h1><p>Encontre decorações, lembranças e viajantes antes da próxima expedição.</p></div>
        <div className="village-wallet"><Coins /><strong>{coins.toLocaleString("pt-BR")}</strong><span>moedas</span></div>
      </header>

      <div className="village-scene">
        <Image src="/art/village-tavern-pixel-v2.webp" alt="Empório pixel art da Vila Cartógrafa em perspectiva 2D" fill sizes="100vw" className="object-cover [image-rendering:pixelated]" />
        <div className="village-scene__shade" />
        <span className="village-scene__sign"><TentTree /> Empório das Cinco Rotas</span>
      </div>

      <div className="village-shop">
        <div className="village-shop__catalog" aria-labelledby="village-catalog-title">
          <div className="village-shop__intro">
            <ShoppingBag />
            <div>
              <strong id="village-catalog-title">Itens e cosméticos</strong>
              <span>Armas e relíquias são conquistadas nas masmorras. Esta banca oferece decorações para o Refúgio.</span>
            </div>
          </div>
          <div className="village-catalog-grid">
            {ARPG_MERCHANT_PRODUCTS.map((product) => {
              const owned = ownedItemKeys.includes(product.itemKey);
              const buying = pendingItemKey === product.itemKey;
              return (
                <article className="village-catalog-card" key={product.itemKey} data-category={product.category}>
                  <div className="village-catalog-card__icon">
                    <ArpgItemPixelIcon item={product.icon} size={40} />
                  </div>
                  <div className="village-catalog-card__copy">
                    <small>{product.kind}</small>
                    <strong>{product.name}</strong>
                    <span>{product.description}</span>
                  </div>
                  <button
                    type="button"
                    disabled={owned || coins < product.price || pendingItemKey !== null}
                    onClick={() => void buyItem(product.itemKey)}
                    aria-label={owned ? `${product.name} adquirido` : `Comprar ${product.name} por ${product.price} moedas`}
                  >
                    {owned ? <><Check /> Adquirido</> : <><PackagePlus /> {buying ? "Comprando…" : "Comprar"} <b><Coins /> {product.price}</b></>}
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
