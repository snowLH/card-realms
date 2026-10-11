import type { ArpgExpeditionId } from "../content/expeditions";

export const FOLKLARD_WORLD_ORDER = [
  "mata-encantada",
  "arquipelago-das-mares",
  "montanhas-runicas",
] as const satisfies readonly ArpgExpeditionId[];

export type FolklardWorldNumber = 1 | 2 | 3;
export type FolklardStageNumber = 1 | 2 | 3 | 4 | 5;

export type FolklardCampaignStage = {
  world: FolklardWorldNumber;
  stage: FolklardStageNumber;
  label: `${FolklardWorldNumber}-${FolklardStageNumber}`;
  regionId: ArpgExpeditionId;
  isBossStage: boolean;
};

export function getCampaignStage(
  world: FolklardWorldNumber,
  stage: FolklardStageNumber,
): FolklardCampaignStage {
  const regionId = FOLKLARD_WORLD_ORDER[world - 1];
  return {
    world,
    stage,
    label: `${world}-${stage}`,
    regionId,
    isBossStage: stage === 5,
  };
}

export function campaignStageForRegion(
  regionId: ArpgExpeditionId,
  stage: FolklardStageNumber,
) {
  const world = (FOLKLARD_WORLD_ORDER.indexOf(regionId) + 1) as FolklardWorldNumber;
  if (world < 1 || world > 3) throw new Error(`Região fora da campanha principal: ${regionId}.`);
  return getCampaignStage(world, stage);
}

export function nextCampaignStage(current: FolklardCampaignStage): FolklardCampaignStage | null {
  if (current.stage < 5) {
    return getCampaignStage(current.world, (current.stage + 1) as FolklardStageNumber);
  }
  if (current.world < 3) {
    return getCampaignStage((current.world + 1) as FolklardWorldNumber, 1);
  }
  return null;
}

export const FOLKLARD_CAMPAIGN_STAGES: readonly FolklardCampaignStage[] =
  FOLKLARD_WORLD_ORDER.flatMap((_, worldIndex) =>
    ([1, 2, 3, 4, 5] as const).map((stage) =>
      getCampaignStage((worldIndex + 1) as FolklardWorldNumber, stage),
    ),
  );
