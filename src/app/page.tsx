import { GameShell } from "@/components/game/game-shell";
import { loadPlayerBootstrap } from "@/server/player/progress";

export const dynamic = "force-dynamic";

export default async function Home() {
  const bootstrap = await loadPlayerBootstrap();
  return <GameShell bootstrap={bootstrap} />;
}
