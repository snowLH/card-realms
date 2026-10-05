import type { HubDestinationId } from "../hub/content";
import type { ArpgBridge } from "./bridge";
import { DEFAULT_AVATAR_CONFIG, type AvatarConfig } from "@/game/save/local-progress";
import { ARPG_LOGICAL_VIEWPORT, ARPG_PIXEL_RENDER_SETTINGS } from "./render-config";

export async function createArpgHubGame(
  parent: HTMLElement,
  bridge: ArpgBridge,
  onNavigate: (destination: HubDestinationId) => void,
  onPrompt: (message: string) => void,
  avatarConfig: AvatarConfig = DEFAULT_AVATAR_CONFIG,
) {
  const Phaser = await import("phaser");
  const { createArpgHubScene } = await import("./hub-scene");
  const HubScene = createArpgHubScene(Phaser, bridge, onNavigate, onPrompt, avatarConfig);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    ...ARPG_LOGICAL_VIEWPORT,
    backgroundColor: "#1c1718",
    ...ARPG_PIXEL_RENDER_SETTINGS,
    physics: { default: "arcade", arcade: { debug: false } },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      ...ARPG_LOGICAL_VIEWPORT,
    },
    scene: [HubScene],
  });

  return { game, destroy: () => game.destroy(true) };
}
