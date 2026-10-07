"use client";

import { useState, type SyntheticEvent } from "react";
import { X } from "lucide-react";
import { LoginDialog } from "@/components/auth/login-dialog";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export type GameMenuAction =
  | "lobby"
  | "expeditions"
  | "arsenal"
  | "powers"
  | "appearance"
  | "bestiary"
  | "refuge"
  | "pvp"
  | "cooperative"
  | "profile";

type MenuItem = {
  action: Exclude<GameMenuAction, "lobby">;
  label: string;
  detail: string;
  art: "sword" | "staff" | "books" | "chest" | "map";
};

const menuItems: MenuItem[] = [
  { action: "arsenal", label: "Arsenal da Lenda", detail: "Armas e relíquias encontradas nas masmorras", art: "sword" },
  { action: "powers", label: "Ataques da Lenda", detail: "Seus dois ataques próprios", art: "staff" },
  { action: "appearance", label: "Lendas jogáveis", detail: "Escolha sua Lenda ativa", art: "books" },
];

export function GameMenu({
  currentView,
  playerName,
  level,
  coins,
  onNavigate,
}: {
  currentView: "hub" | "play" | "other";
  playerName: string;
  level: number;
  coins: number;
  onNavigate: (action: GameMenuAction) => void;
}) {
  const [open, setOpen] = useState(false);

  const choose = (event: SyntheticEvent, action: GameMenuAction) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    onNavigate(action);
  };

  return (
    <div className="game-menu">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button type="button" className="game-menu__trigger" aria-label="Abrir menu do jogo">
            <span className="game-menu__trigger-mark" aria-hidden="true" />
            <span>MENU</span>
          </button>
        </DialogTrigger>

        <DialogContent
          className="game-menu__panel"
          overlayClassName="game-menu__overlay"
          aria-label="Menu do jogo"
          showClose={false}
          disableCenterTranslate
        >
          <DialogTitle className="sr-only">Menu do jogo</DialogTitle>
          <header className="game-menu__header">
            <div>
              <small>SEU CARTÓGRAFO</small>
              <strong>{playerName}</strong>
              <span>Nv. {level} <i aria-hidden="true">·</i> {coins.toLocaleString("pt-BR")} moedas</span>
            </div>
            <DialogClose asChild>
              <button type="button" aria-label="Fechar menu"><X aria-hidden="true" /></button>
            </DialogClose>
          </header>

          {currentView !== "hub" ? (
            <button type="button" className="game-menu__return" onClick={(event) => choose(event, "lobby")}>
              <span aria-hidden="true">↩</span> Voltar à Guilda
            </button>
          ) : null}

          <div className="game-menu__section-label">MOCHILA E PREPARO</div>
          <nav className="game-menu__grid" aria-label="Acessos do jogo">
            {menuItems.map(({ action, label, detail, art }) => (
              <button
                key={action}
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => choose(event, action)}
              >
                <span className={`game-menu__pixel-icon game-menu__pixel-icon--${art}`} aria-hidden="true" />
                <strong>{label}</strong>
                <small>{detail}</small>
              </button>
            ))}
          </nav>

          <div className="game-menu__footer">
            <LoginDialog label="Conta e progresso" className="game-menu__account" />
          </div>

        </DialogContent>
      </Dialog>
    </div>
  );
}
