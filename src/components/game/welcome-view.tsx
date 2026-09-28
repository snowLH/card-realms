"use client";

import { ArrowRight, Layers3, ShieldCheck, Sparkles, Swords } from "lucide-react";
import { LoginDialog } from "@/components/auth/login-dialog";

export function WelcomeView({ onPreview }: { onPreview: () => void }) {
  return (
    <section className="welcome-view" aria-labelledby="welcome-title">
      <div className="welcome-view__copy">
        <span className="welcome-view__eyebrow">Sua coleção começa aqui</span>
        <h1 id="welcome-title">Entre, escolha uma carta e abra seu primeiro caminho.</h1>
        <p>
          Monte uma equipe com seres do folclore, conquiste novas cartas em batalhas
          e encontre recompensas nos baús de Aurória.
        </p>
        <div className="welcome-view__actions">
          <LoginDialog prominent label="Começar com Google" />
          <button type="button" className="welcome-view__preview" onClick={onPreview}>
            Conhecer o jogo <ArrowRight />
          </button>
        </div>
        <small>Seu progresso fica vinculado à conta e acompanha você em outros dispositivos.</small>
      </div>

      <div className="welcome-view__table" aria-hidden>
        <div className="welcome-card welcome-card--back"><span>CR</span></div>
        <div className="welcome-card welcome-card--front welcome-card--one">
          <Sparkles /><strong>Boitatá</strong><small>Fogo · 124 PV</small>
        </div>
        <div className="welcome-card welcome-card--front welcome-card--two">
          <ShieldCheck /><strong>Iara</strong><small>Água · 120 PV</small>
        </div>
        <div className="welcome-card welcome-card--front welcome-card--three">
          <Layers3 /><strong>Curupira</strong><small>Natureza · 126 PV</small>
        </div>
        <span className="welcome-view__seal"><Swords /></span>
      </div>
    </section>
  );
}


