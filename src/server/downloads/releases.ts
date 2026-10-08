import "server-only";

const REPOSITORY = "snowLH/card-realms";
export const DOWNLOADS = {
  windows: { tag: "downloads-desktop", file: "Folklard-Windows.exe" },
  android: { tag: "downloads-android", file: "Folklard-Android.apk" },
  linux: { tag: "downloads-desktop", file: "Folklard-Linux.AppImage" },
} as const;
export type DownloadPlatform = keyof typeof DOWNLOADS;
export type DownloadSigning = "development-test" | "unsigned-test" | "signed-release";
const DOWNLOAD_SIGNINGS = new Set<DownloadSigning>(["development-test", "unsigned-test", "signed-release"]);
export type DownloadRelease = {
  available: boolean;
  url: string;
  tag: string;
  name: string | null;
  size: number | null;
  updatedAt: string | null;
  sha256: string | null;
  version: string | null;
  commit: string | null;
  signing: DownloadSigning | null;
};
type Asset = { name: string; state: string; size: number; updated_at?: string; digest?: string; browser_download_url: string };
type Release = { tag_name: string; name?: string; draft: boolean; assets: Asset[] };

async function readBuildMetadata(platform: DownloadPlatform, release: Release | null | undefined, asset: Asset | undefined, fetcher: typeof fetch) {
  const empty = { version: null, commit: null, signing: null as DownloadSigning | null };
  if (!release || !asset) return empty;
  const platformName = { windows: "Windows", linux: "Linux", android: "Android" }[platform];
  const file = `Folklard-${platformName}.json`;
  const url = `https://github.com/${REPOSITORY}/releases/download/${release.tag_name}/${file}`;
  if (!release.assets.some((candidate) => candidate.name === file && candidate.state === "uploaded"
    && candidate.size > 0 && candidate.size <= 4096 && candidate.browser_download_url === url)) return empty;
  try {
    const response = await fetcher(url, { next: { revalidate: 300 }, signal: AbortSignal.timeout(6500) });
    if (!response.ok) return empty;
    const metadata = await response.json();
    if (metadata.file !== asset.name || metadata.size !== asset.size
      || typeof metadata.version !== "string" || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(metadata.version)
      || typeof metadata.commit !== "string" || !/^[a-f0-9]{40}$/i.test(metadata.commit)
      || typeof metadata.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(metadata.sha256)
      || typeof metadata.signing !== "string" || !DOWNLOAD_SIGNINGS.has(metadata.signing as DownloadSigning)
      || (asset.digest && `sha256:${metadata.sha256}` !== asset.digest)) return empty;
    return {
      version: metadata.version as string,
      commit: metadata.commit as string,
      signing: metadata.signing as DownloadSigning,
    };
  } catch { return empty; }
}

export function downloadUrl(platform: DownloadPlatform) {
  const { tag, file } = DOWNLOADS[platform];
  return `https://github.com/${REPOSITORY}/releases/download/${tag}/${file}`;
}

async function readRelease(tag: string, fetcher: typeof fetch): Promise<Release | null> {
  try {
    const response = await fetcher(`https://api.github.com/repos/${REPOSITORY}/releases/tags/${tag}`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 300 }, signal: AbortSignal.timeout(6500),
    });
    if (!response.ok) return null;
    const release = await response.json() as Release;
    return release.tag_name === tag && !release.draft && Array.isArray(release.assets) ? release : null;
  } catch { return null; }
}

// A redirect or an HTML error page does not prove that an installer is downloadable.
async function checkBinary(url: string, expectedSize: number | null, fetcher: typeof fetch) {
  try {
    const response = await fetcher(url, {
      method: "HEAD", redirect: "follow", next: { revalidate: 300 }, signal: AbortSignal.timeout(6500),
    });
    const mime = response.headers.get("content-type")?.split(";")[0].trim();
    const binary = mime === "application/octet-stream" || mime === "application/vnd.android.package-archive"
      || mime === "application/x-executable" || mime === "application/x-msdownload";
    const size = Number(response.headers.get("content-length"));
    const hostname = new URL(response.url || url).hostname;
    const officialHost = hostname === "github.com" || hostname.endsWith(".githubusercontent.com");
    return {
      available: response.status === 200 && binary && officialHost && size > 0
        && (expectedSize === null || size === expectedSize),
      size: size > 0 ? size : null,
    };
  } catch { return { available: false, size: null }; }
}

export async function getDownloadReleases(fetcher: typeof fetch = fetch): Promise<Record<DownloadPlatform, DownloadRelease>> {
  const tags = [...new Set(Object.values(DOWNLOADS).map(({ tag }) => tag))];
  const releases = new Map(await Promise.all(tags.map(async (tag) => [tag, await readRelease(tag, fetcher)] as const)));
  const results = await Promise.all((Object.keys(DOWNLOADS) as DownloadPlatform[]).map(async (platform) => {
    const spec = DOWNLOADS[platform];
    const url = downloadUrl(platform);
    const release = releases.get(spec.tag);
    const asset = release?.assets.find((candidate) => candidate.name === spec.file
      && candidate.state === "uploaded" && candidate.size > 0 && candidate.browser_download_url === url);
    // If metadata is temporarily rate limited, the real binary can still be checked.
    const [check, metadata] = await Promise.all([
      release && !asset ? Promise.resolve({ available: false, size: null }) : checkBinary(url, asset?.size ?? null, fetcher),
      readBuildMetadata(platform, release, asset, fetcher),
    ]);
    const digest = asset?.digest?.match(/^sha256:([a-f0-9]{64})$/i)?.[1] ?? null;
    return [platform, {
      available: check.available, url, tag: spec.tag, name: release?.name ?? null,
      size: asset?.size ?? check.size,
      updatedAt: asset?.updated_at && Number.isFinite(Date.parse(asset.updated_at)) ? asset.updated_at : null,
      sha256: digest,
      ...metadata,
    }] as const;
  }));
  return Object.fromEntries(results) as Record<DownloadPlatform, DownloadRelease>;
}
