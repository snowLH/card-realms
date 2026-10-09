import type { NextConfig } from "next";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  compiler: {
    async runAfterProductionCompile({ projectDir, distDir }) {
      // Generate public files before the hosting adapter collects build output.
      const { stdout } = await promisify(execFile)(process.execPath, [
        join(projectDir, "scripts/build-offline-manifest.mjs"), projectDir, distDir,
      ]);
      console.log(stdout.trim());
    },
  },
  async rewrites() {
    return [
      { source: "/api/raids", destination: "/api/player/progress?handler=raids" },
      { source: "/api/arpg/loadout", destination: "/api/player/progress?handler=loadout" },
      { source: "/api/arpg/powers/purchase", destination: "/api/player/progress?handler=power" },
      { source: "/api/player/avatar", destination: "/api/player/progress?handler=avatar" },
      { source: "/api/player/legends/purchase", destination: "/api/player/progress?handler=legend" },
      { source: "/auth/callback", destination: "/api/player/progress?handler=auth" },
    ];
  },
};

export default nextConfig;
