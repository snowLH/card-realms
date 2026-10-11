import { describe, expect, it } from "vitest";
import {
  FOLKLARD_CAMPAIGN_STAGES,
  getCampaignStage,
  nextCampaignStage,
} from "./stages";

describe("Folklard campaign stages", () => {
  it("defines the full 1-1 through 3-5 route", () => {
    expect(FOLKLARD_CAMPAIGN_STAGES).toHaveLength(15);
    expect(FOLKLARD_CAMPAIGN_STAGES[0]).toMatchObject({
      label: "1-1",
      regionId: "mata-encantada",
      isBossStage: false,
    });
    expect(FOLKLARD_CAMPAIGN_STAGES[4]).toMatchObject({
      label: "1-5",
      regionId: "mata-encantada",
      isBossStage: true,
    });
    expect(FOLKLARD_CAMPAIGN_STAGES[9]).toMatchObject({
      label: "2-5",
      regionId: "arquipelago-das-mares",
      isBossStage: true,
    });
    expect(FOLKLARD_CAMPAIGN_STAGES[14]).toMatchObject({
      label: "3-5",
      regionId: "montanhas-runicas",
      isBossStage: true,
    });
  });

  it("advances worlds without returning to the hub", () => {
    expect(nextCampaignStage(getCampaignStage(1, 4))?.label).toBe("1-5");
    expect(nextCampaignStage(getCampaignStage(1, 5))?.label).toBe("2-1");
    expect(nextCampaignStage(getCampaignStage(2, 5))?.label).toBe("3-1");
    expect(nextCampaignStage(getCampaignStage(3, 5))).toBeNull();
  });
});
