"use client";

import { useState } from "react";
import { PixelCreature } from "@/components/game/pixel-creature";
import { Crown, Play, X } from "@/components/ui/pixel-icon";
import {
  CAMPAIGN_CHAPTERS,
  type CampaignChapter,
} from "@/game/card-realms/content/campaign-chapters";
import { getCardDefinition } from "@/game/card-realms/domain/cards";
import { getCulture } from "@/game/card-realms/domain/cultures";
import { getWeatherDefinition } from "@/game/card-realms/domain/weather";
import { cn } from "@/lib/utils";

export function CardRealmsCampaign({
  onStartChapterBattle,
  onClose,
}: {
  onStartChapterBattle: (chapter: CampaignChapter) => void;
  onClose: () => void;
}) {
  const [clearedChapters] = useState<number[]>(() => {
    if (typeof window === "undefined") return [1];
    try {
      const saved = window.localStorage.getItem("card-realms-campaign-progress");
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number>(1);

  const selectedChapter =
    CAMPAIGN_CHAPTERS.find((c) => c.chapterIndex === selectedChapterIndex) ??
    CAMPAIGN_CHAPTERS[0];

  const opponentCultureDef = getCulture(selectedChapter.opponentCulture);
  const weatherDef = getWeatherDefinition(selectedChapter.initialWeather);
  const isCleared = clearedChapters.includes(selectedChapter.chapterIndex);

  const rewardCards = selectedChapter.rewardCardIds.map((id) => getCardDefinition(id));

  return (
    <div
      className="card-realms-campaign-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Campanha Folclórica: Crônicas das Lendas"
    >
      <div className="card-realms-campaign-window">
        {/* Header */}
        <header className="card-realms-campaign-header">
          <div className="card-realms-campaign-title">
            <Crown size={22} aria-hidden="true" />
            <div>
              <h2>CRÔNICAS DE AURÓRIA — CAMPANHA FOLCLÓRICA MUNDIAL</h2>
              <small>Avance pelos 5 reinos míticos e conquiste as lendas dos continentes</small>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar Campanha">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {/* Chapters Progression Map */}
        <nav className="card-realms-campaign-map" aria-label="Capítulos da Campanha">
          {CAMPAIGN_CHAPTERS.map((chapter) => {
            const cleared = clearedChapters.includes(chapter.chapterIndex);
            const isSelected = selectedChapter.chapterIndex === chapter.chapterIndex;
            return (
              <button
                key={chapter.chapterIndex}
                type="button"
                className={cn(
                  "card-realms-campaign-step",
                  isSelected && "is-selected",
                  cleared && "is-cleared",
                )}
                onClick={() => setSelectedChapterIndex(chapter.chapterIndex)}
              >
                <span className="card-realms-campaign-step-num">
                  {cleared ? "✓" : chapter.chapterIndex}
                </span>
                <span className="card-realms-campaign-step-title">{chapter.countryLabel}</span>
                <small>{chapter.realmName}</small>
              </button>
            );
          })}
        </nav>

        {/* Chapter Details View */}
        <div className="card-realms-campaign-body">
          {/* Story & Lore */}
          <section className="card-realms-campaign-story">
            <div className="card-realms-campaign-badge">
              <span>{selectedChapter.title}</span>
              {isCleared && <span className="is-cleared-tag">✓ CONCLUÍDO</span>}
            </div>

            <h3>{selectedChapter.realmName}</h3>
            <p className="card-realms-campaign-prologue">{selectedChapter.prologue}</p>

            <div className="card-realms-campaign-adversary-box">
              <div className="card-realms-campaign-adversary-header">
                <strong>Oponente: {selectedChapter.opponentName}</strong>
                <small>{selectedChapter.opponentTitle}</small>
              </div>
              <div className="card-realms-campaign-adversary-details">
                <span>🏛️ Cultura: {opponentCultureDef.name}</span>
                <span>❤️ Coração: {opponentCultureDef.kingdomHeart.name}</span>
                <span>
                  🌪️ Clima Inicial: {weatherDef.icon} {weatherDef.name}
                </span>
                <span>🧠 Perfil da IA: {selectedChapter.aiProfile}</span>
              </div>
            </div>

            {/* Victory Quote */}
            {isCleared && (
              <div className="card-realms-campaign-aftermath">
                <strong>Glória Eterna:</strong>
                <p>&ldquo;{selectedChapter.victoryQuote}&rdquo;</p>
              </div>
            )}
          </section>

          {/* Rewards & Start Battle */}
          <section className="card-realms-campaign-rewards-panel">
            <h4>Recompensas do Capítulo (Draft Mítico):</h4>
            <div className="card-realms-campaign-rewards-grid">
              {rewardCards.map((card) => (
                <div key={card.id} className="card-realms-campaign-reward-card">
                  <PixelCreature sprite={card.portrait} label={card.name} />
                  <strong>{card.name}</strong>
                  <small>{card.category}</small>
                </div>
              ))}
            </div>

            <div className="card-realms-campaign-launch">
              <button
                type="button"
                className="card-realms-campaign-start-btn"
                onClick={() => onStartChapterBattle(selectedChapter)}
              >
                <Play size={18} aria-hidden="true" /> INICIAR BATALHA DO CAPÍTULO
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
