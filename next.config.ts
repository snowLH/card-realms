import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
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
