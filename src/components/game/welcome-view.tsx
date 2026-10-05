"use client";

import { ArrowRight, BookOpen, Swords } from "lucide-react";
import type { CSSProperties } from "react";
import { LoginDialog } from "@/components/auth/login-dialog";
import { CREATURE_BY_ID, ELEMENT_META } from "@/game/catalog";
import { PixelCreature } from "./pixel-creature";

const STARTER_PREVIEW = ["boitata", "iara", "curupira"] as const;

export function WelcomeView({ onPreview }: { onPreview: () => void }) {
  return (
    <section className="welcome-view" aria-labelledby="welcome-title">
      <div className="welcome-view__copy">
        <span className="welcome-view__eyebrow">Sua coleção começa aqui</span>
        <h1 id="welcome-title">Crie seu avatar e abra seu primeiro caminho.</h1>
        <p>
          Explore Aurória com seu avatar, equipe dois poderes e descubra seres do folclore
          para sua coleção em baús e recompensas especiais.
        </p>
        <div className="welcome-view__actions">
          <LoginDialog prominent label="Começar com Google" />
          <button type="button" className="welcome-view__preview" onClick={onPreview}>
            Conhecer o jogo <ArrowRight />
          </button>
        </div>
        <small>Seu progresso fica vinculado à conta e acompanha você em outros dispositivos.</small>
      </div>

      <div className="welcome-view__scene" aria-hidden>
        <div className="welcome-view__scene-title">
          <BookOpen />
          <span><small>Arquivo da guilda</small><strong>Bestiário de Aurória</strong></span>
        </div>
        <div className="welcome-view__table">
          <div className="welcome-card welcome-card--back"><span>CR</span></div>
          {STARTER_PREVIEW.map((id, index) => {
            const creature = CREATURE_BY_ID.get(id)!;
            const element = ELEMENT_META[creature.element];
            return (
              <div
                className={`welcome-card welcome-card--front welcome-card--${index + 1}`}
                key={id}
                style={{ "--starter-element": element.color } as CSSProperties}
              >
                <PixelCreature sprite={creature.sprite} label="" />
                <strong>{creature.name}</strong>
                <small>{element.name} · {creature.hp} PV</small>
              </div>
            );
          })}
          <span className="welcome-view__seal"><Swords /></span>
        </div>
      </div>
    </section>
  );
}


