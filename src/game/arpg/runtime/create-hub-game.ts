import type { HubDestinationId } from "../hub/content";
import type { PlayableLegendId } from "../content/legends";
import type { ArpgBridge } from "./bridge";
import { DEFAULT_AVATAR_CONFIG, type AvatarConfig } from "@/game/save/local-progress";
import { ARPG_LOGICAL_VIEWPORT, ARPG_PIXEL_RENDER_SETTINGS } from "./render-config";

export async function createArpgHubGame(
  parent: HTMLElement,
  bridge: ArpgBridge,
  onNavigate: (destination: HubDestinationId, legendId?: PlayableLegendId) => void,
  onPrompt: (message: string) => void,
  avatarConfig: AvatarConfig = DEFAULT_AVATAR_CONFIG,
) {
  const Phaser = await import("phaser");
  const { createArpgHubScene } = await import("./hub-scene");
  const HubScene = createArpgHubScene(Phaser, bridge, onNavigate, onPrompt, avatarConfig);
  const portraitMobile = window.matchMedia("(max-width: 900px) and (orientation: portrait)").matches;
  const viewport = portraitMobile
    ? { width: Math.max(1, parent.clientWidth), height: Math.max(1, parent.clientHeight) }
    : ARPG_LOGICAL_VIEWPORT;

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    ...viewport,
    backgroundColor: "#1c1718",
    ...ARPG_PIXEL_RENDER_SETTINGS,
    physics: { default: "arcade", arcade: { debug: false } },
    scale: {
      mode: portraitMobile ? Phaser.Scale.RESIZE : Phaser.Scale.FIT,
      ...(!portraitMobile ? { autoCenter: Phaser.Scale.CENTER_BOTH } : {}),
      ...viewport,
    },
    scene: [HubScene],
  });

  return { game, destroy: () => game.destroy(true) };
}
