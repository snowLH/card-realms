"use client";

import {
  Album,
  Bell,
  CalendarDays,
  Coins,
  Home,
  Layers3,
  Map,
  Menu,
  ScrollText,
  ShieldCheck,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { REGIONS } from "@/game/catalog";
import type { RegionDefinition } from "@/game/types";
import { cn } from "@/lib/utils";
import { LoginDialog } from "@/components/auth/login-dialog";
import { Badge } from "@/components/ui/badge";
import { CollectionView } from "./collection-view";
import { RefugeView } from "./refuge-view";
import { TeamView } from "./team-view";
import { WorldMap } from "./world-map";

const BattleArena = dynamic(
  () => import("./battle-arena").then((module) => module.BattleArena),
  {
    ssr: false,
    loading: () => (
      <div className="battle-loading" role="status">
        Preparando a arena...
      </div>
    ),
  },
);

type View = "map" | "collection" | "team" | "refuge" | "profile";

const DEMO_PROGRESS_KEY = "card-realms:demo-progress:v1";

const navigation = [
  { id: "map", label: "Mapa", icon: Map },
  { id: "collection", label: "Coleção", icon: Album },
  { id: "team", label: "Equipe", icon: Layers3 },
  { id: "refuge", label: "Refúgio", icon: Home },
  { id: "profile", label: "Perfil", icon: UserRound },
] satisfies Array<{ id: View; label: string; icon: typeof Map }>;

export function GameShell() {
  const [view, setView] = useState<View>("map");
  const [selectedRegion, setSelectedRegion] = useState<RegionDefinition | null>(REGIONS[0]);
  const [battleOpen, setBattleOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [coins, setCoins] = useState(840);
  const [xp, setXp] = useState(1240);
  const [toast, setToast] = useState<string | null>(null);
  const [openedTreasures, setOpenedTreasures] = useState<string[]>([]);
  const [progressLoaded, setProgressLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(DEMO_PROGRESS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { coins?: number; xp?: number; openedTreasures?: string[] };
        if (typeof parsed.coins === "number") setCoins(parsed.coins);
        if (typeof parsed.xp === "number") setXp(parsed.xp);
        if (Array.isArray(parsed.openedTreasures)) setOpenedTreasures(parsed.openedTreasures);
      }
    } finally {
      setProgressLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!progressLoaded) return;
    window.localStorage.setItem(
      DEMO_PROGRESS_KEY,
      JSON.stringify({ version: 1, coins, xp, openedTreasures }),
    );
  }, [coins, openedTreasures, progressLoaded, xp]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const navigate = (next: View) => {
    setView(next);
    setMobileMenu(false);
  };

  const handleBattle = () => {
    setBattleOpen(true);
  };

  const handleTreasure = (region: RegionDefinition) => {
    if (openedTreasures.includes(region.id)) {
      setToast("Este baú já foi recolhido. Ele reaparecerá em outra expedição.");
      return;
    }
    setOpenedTreasures((current) => [...current, region.id]);
    setCoins((current) => current + 45);
    setToast("Baú cartográfico encontrado: +45 moedas e 1 fragmento de vínculo.");
  };

  const handleVictory = useCallback(() => {
    setCoins((current) => current + 120);
    setXp((current) => current + 80);
  }, []);

  return (
    <main className="game-app">
      <header className="app-header">
        <button type="button" className="menu-toggle" onClick={() => setMobileMenu((current) => !current)} aria-label="Abrir menu">
          {mobileMenu ? <X /> : <Menu />}
        </button>
        <button type="button" className="brand" onClick={() => navigate("map")}>
          <span className="brand__mark">CR</span>
          <span><strong>Card Realms</strong><small>Atlas de Aurória</small></span>
        </button>
        <div className="header-stats">
          <span><Coins /> {coins.toLocaleString("pt-BR")}</span>
          <span><ShieldCheck /> Nv. 7</span>
        </div>
        <div className="header-actions">
          <button type="button" aria-label="Eventos"><CalendarDays /></button>
          <button type="button" aria-label="Notificações"><Bell /></button>
          <LoginDialog />
        </div>
      </header>

      <aside className={cn("side-nav", mobileMenu && "side-nav--open")}>
        <nav>
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" className={cn(view === item.id && "is-active")} onClick={() => navigate(item.id)}>
                <Icon /> <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="side-quest">
          <span>Missão ativa</span>
          <strong>Vozes da mata</strong>
          <p>Vença a Guardiã Aya na Provação das Raízes.</p>
          <div><span style={{ width: `${Math.min(100, (xp / 1800) * 100)}%` }} /></div>
          <small>{xp}/1.800 XP</small>
        </div>
        <Badge className="side-build">Versão fundação · progresso local</Badge>
      </aside>

      <div className="app-content">
        {view === "map" ? (
          <WorldMap
            selected={selectedRegion}
            onSelect={setSelectedRegion}
            onBattle={handleBattle}
            onTreasure={handleTreasure}
          />
        ) : null}
        {view === "collection" ? <CollectionView /> : null}
        {view === "team" ? <TeamView /> : null}
        {view === "refuge" ? <RefugeView /> : null}
        {view === "profile" ? <ProfileView coins={coins} xp={xp} /> : null}
      </div>

      <nav className="mobile-nav" aria-label="Navegação principal">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} type="button" className={cn(view === item.id && "is-active")} onClick={() => navigate(item.id)}>
              <Icon /><span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {toast ? <div className="game-toast"><Trophy /> {toast}</div> : null}
      {battleOpen ? (
        <div className="battle-overlay">
          <BattleArena open={battleOpen} onClose={() => setBattleOpen(false)} onVictory={handleVictory} />
        </div>
      ) : null}
    </main>
  );
}

function ProfileView({ coins, xp }: { coins: number; xp: number }) {
  return (
    <section className="content-view profile-view">
      <header className="view-heading">
        <div><span className="view-eyebrow">Jornada pessoal</span><h1>Cartógrafo visitante</h1><p>Entre na sua conta para sincronizar este perfil entre celular, tablet e computador.</p></div>
        <LoginDialog />
      </header>
      <div className="profile-hero">
        <div className="profile-avatar"><UserRound /></div>
        <div><Badge>Nível 7</Badge><h2>Explorador das Raízes</h2><p>Membro da Liga Cartográfica desde esta expedição.</p></div>
      </div>
      <div className="profile-stats">
        <article><Coins /><strong>{coins.toLocaleString("pt-BR")}</strong><span>Moedas</span></article>
        <article><ScrollText /><strong>{xp.toLocaleString("pt-BR")}</strong><span>Experiência</span></article>
        <article><Album /><strong>25</strong><span>Seres catalogados</span></article>
        <article><Trophy /><strong>0</strong><span>Selos de santuário</span></article>
      </div>
      <div className="profile-note"><strong>Persistência transparente</strong><p>Nesta fundação, recompensas visuais ficam no dispositivo. Quando o projeto Supabase for autorizado, o mesmo fluxo passará a registrar tudo na conta com proteção contra duplicação.</p></div>
    </section>
  );
}
