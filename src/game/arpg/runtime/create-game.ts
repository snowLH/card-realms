import { ARPG_DUNGEON_CONFIGS, resolveDungeonLootPlan } from "../content/dungeons";
import { DEFAULT_ARPG_EXPEDITION_ID, type ArpgExpeditionId } from "../content/expeditions";
import { DEFAULT_ARPG_LOADOUT } from "../content/mata-encantada";
import { populateArpgDungeonContent } from "../dungeon/content";
import { generateDungeon } from "../dungeon/generator";
import { DungeonManager } from "../dungeon/manager";
import type { ArpgRunCheckpoint } from "../dungeon/run-checkpoint";
import type { ArpgLoadout, ArpgRuntimeBridge } from "../domain/types";
import { DEFAULT_AVATAR_CONFIG, type AvatarConfig } from "@/game/save/local-progress";
import { ARPG_GAMEPLAY_VIEWPORT, ARPG_PIXEL_RENDER_SETTINGS } from "./render-config";
import { createScenePauseControl } from "./scene-pause-control";
import { createArpgDungeonSeed } from "../dungeon/encounter-seed";

export async function createArpgGame(
  parent: HTMLElement,
  bridge: ArpgRuntimeBridge,
  loadout: ArpgLoadout = DEFAULT_ARPG_LOADOUT,
  expeditionId: ArpgExpeditionId = DEFAULT_ARPG_EXPEDITION_ID,
  lootItemIds?: readonly string[],
  runSeed?: string,
  checkpoint?: ArpgRunCheckpoint,
  avatarConfig: AvatarConfig = DEFAULT_AVATAR_CONFIG,
  viewport: { width: number; height: number } = ARPG_GAMEPLAY_VIEWPORT,
) {
  const dungeon = ARPG_DUNGEON_CONFIGS[expeditionId];
  if (!dungeon) throw new Error("Configuração da expedição não encontrada.");

  const lootPlan = resolveDungeonLootPlan(expeditionId, lootItemIds);
  const dungeonGraph = populateArpgDungeonContent(generateDungeon({
    seed: runSeed ?? createArpgDungeonSeed(expeditionId, globalThis.crypto.randomUUID()),
    regionId: expeditionId,
  }));
  const dungeonManager = new DungeonManager(dungeonGraph, checkpoint);
  const [Phaser, { createArpgDungeonScene }] = await Promise.all([import("phaser"), import("./dungeon-scene")]);
  const DungeonScene = createArpgDungeonScene(Phaser, bridge, dungeon, loadout, lootPlan, dungeonManager, checkpoint, avatarConfig);
  const pauseControl = createScenePauseControl(bridge);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    ...viewport,
    backgroundColor: "#102018",
    ...ARPG_PIXEL_RENDER_SETTINGS,
    physics: {
      default: "arcade",
      arcade: { debug: false },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      ...viewport,
    },
    scene: [DungeonScene],
    callbacks: {
      postBoot: (bootedGame) => pauseControl.attach(bootedGame.scene.getScenes(false)[0]),
    },
  });
  return {
    game,
    dungeonGraph: dungeonManager?.getGraph(),
    setPaused(paused: boolean) {
      pauseControl.setPaused(paused);
    },
    destroy() {
      pauseControl.destroy();
      game.destroy(true);
    },
  };
}
