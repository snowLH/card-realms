import { describe, expect, it, vi } from "vitest";
import { DOWNLOADS, downloadUrl, getDownloadReleases } from "./releases";

function mockFetch(binary: Response = new Response(null, { headers: { "content-type": "application/octet-stream", "content-length": "128" } }), metadata = true) {
  return vi.fn<typeof fetch>(async (url) => {
    if (String(url).startsWith("https://api.github.com/")) {
      if (!metadata) return new Response(null, { status: 403 });
      const tag = String(url).split("/").at(-1);
      return Response.json({ tag_name: tag, name: "Edição de teste", draft: false,
        assets: Object.entries(DOWNLOADS).filter(([, value]) => value.tag === tag).map(([platform, value]) => ({
          name: value.file, state: "uploaded", size: 128, digest: `sha256:${"a".repeat(64)}`,
          updated_at: "2026-10-08T18:00:00Z", browser_download_url: downloadUrl(platform as keyof typeof DOWNLOADS),
        })),
      });
    }
    return binary.clone();
  });
}

describe("official installer availability", () => {
  it("checks the final binary and retrieves release size, date and checksum", async () => {
    const fetcher = mockFetch();
    const releases = await getDownloadReleases(fetcher);
    expect(releases.android).toMatchObject({ available: true, size: 128, tag: "downloads-android", sha256: "a".repeat(64) });
    expect(fetcher).toHaveBeenCalledTimes(5); // two releases, three files
    expect(fetcher).toHaveBeenCalledWith(downloadUrl("windows"), expect.objectContaining({ method: "HEAD", redirect: "follow" }));
  });
  it.each([
    ["an unfollowed redirect", new Response(null, { status: 302 })],
    ["an HTML error page", new Response(null, { headers: { "content-type": "text/html", "content-length": "128" } })],
    ["a truncated binary", new Response(null, { headers: { "content-type": "application/octet-stream", "content-length": "64" } })],
    ["a missing file", new Response(null, { status: 404 })],
  ])("rejects %s", async (_label, response) => {
    const releases = await getDownloadReleases(mockFetch(response));
    expect(releases.windows.available).toBe(false);
  });
  it("keeps verified downloads usable when GitHub metadata is rate limited", async () => {
    const releases = await getDownloadReleases(mockFetch(undefined, false));
    expect(releases.linux).toMatchObject({ available: true, size: 128, updatedAt: null, sha256: null });
  });
  it("does not enable a button for an asset missing from the release", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ tag_name: "downloads-desktop", draft: false, assets: [] }));
    const releases = await getDownloadReleases(fetcher);
    expect(releases.windows.available).toBe(false);
    expect(releases.linux.available).toBe(false);
  });
  it("reports network failures without failing the installation page", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"));
    const releases = await getDownloadReleases(fetcher);
    expect(Object.values(releases).every((release) => !release.available)).toBe(true);
  });
  it.each([true, false])("only displays build identity when metadata matches the binary (valid=%s)", async (valid) => {
    const base = mockFetch();
    const fetcher = vi.fn<typeof fetch>(async (url, options) => {
      if (String(url).endsWith("Folklard-Windows.json")) {
        return Response.json({ file: DOWNLOADS.windows.file, size: 128, version: "0.2.0",
          commit: "b".repeat(40), sha256: (valid ? "a" : "c").repeat(64) });
      }
      const response = await base(url, options);
      if (!String(url).endsWith("/downloads-desktop")) return response;
      const release = await response.json();
      release.assets.push({ name: "Folklard-Windows.json", state: "uploaded", size: 287,
        browser_download_url: "https://github.com/snowLH/card-realms/releases/download/downloads-desktop/Folklard-Windows.json" });
      return Response.json(release);
    });
    const releases = await getDownloadReleases(fetcher);
    expect(releases.windows).toMatchObject({ available: true,
      version: valid ? "0.2.0" : null, commit: valid ? "b".repeat(40) : null });
    expect(releases.android.version).toBeNull();
  });
  it("ignores a malformed release timestamp instead of breaking the installation page", async () => {
    const base = mockFetch();
    const fetcher = vi.fn<typeof fetch>(async (url, options) => {
      const response = await base(url, options);
      if (!String(url).startsWith("https://api.github.com/")) return response;
      const release = await response.json();
      release.assets[0].updated_at = "invalid-date";
      return Response.json(release);
    });
    expect((await getDownloadReleases(fetcher)).windows.updatedAt).toBeNull();
  });
});
