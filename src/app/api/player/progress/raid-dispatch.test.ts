import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRaidLobby: vi.fn(),
  updateRaidLobby: vi.fn(),
}));

vi.mock("@/server/http-handlers/legacy/raids", () => ({
  GET: mocks.getRaidLobby,
  POST: mocks.updateRaidLobby,
}));

import { GET, POST } from "./route";

function raidRequest(method: "GET" | "POST", body?: unknown) {
  const url = new URL("http://localhost/api/player/progress?handler=raids");
  return new Request(url, {
    method,
    ...(method === "POST"
      ? {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
}

describe("shared endpoint raid dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRaidLobby.mockResolvedValue(new Response("get"));
    mocks.updateRaidLobby.mockResolvedValue(new Response("post"));
  });

  it("delegates GET to the legacy raid lobby handler", async () => {
    const request = raidRequest("GET");
    const response = await GET(request);

    expect(response).toBe(await mocks.getRaidLobby.mock.results[0].value);
    expect(mocks.getRaidLobby).toHaveBeenCalledOnce();
    expect(mocks.updateRaidLobby).not.toHaveBeenCalled();
  });

  it("delegates POST and preserves the original lobby action request", async () => {
    const request = raidRequest("POST", { action: "create", eventId: "event-1" });
    const response = await POST(request);

    expect(response).toBe(await mocks.updateRaidLobby.mock.results[0].value);
    expect(mocks.updateRaidLobby).toHaveBeenCalledOnce();
    expect(mocks.updateRaidLobby).toHaveBeenCalledWith(request);
    expect(mocks.getRaidLobby).not.toHaveBeenCalled();
  });
});
