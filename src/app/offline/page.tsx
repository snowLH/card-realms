import { GameShell } from "@/components/game/game-shell";
import { LOCAL_PLAYER_BOOTSTRAP } from "@/game/player";

// Public, account-free HTML can be safely stored for offline navigation.
// Never cache a player's authenticated home page or import offline rewards.
export const dynamic = "force-static";

export default function OfflineGame() {
  return <GameShell bootstrap={LOCAL_PLAYER_BOOTSTRAP} offlineMode />;
}
