import { GameShell } from "@/components/game/game-shell";
import { GameSessionBoundary } from "@/components/auth/game-session-boundary";
import { loadPlayerBootstrap, playerBootstrapKey } from "@/server/player/progress";

export const dynamic = "force-dynamic";

export default async function Home() {
  const bootstrap = await loadPlayerBootstrap();
  return <GameSessionBoundary accountId={bootstrap.identity?.id ?? null}>
    <GameShell key={playerBootstrapKey(bootstrap)} bootstrap={bootstrap} />
  </GameSessionBoundary>;
}
