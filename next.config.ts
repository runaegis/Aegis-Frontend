import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/workspace",
        destination: "/dashboard/workspaces",
        permanent: false,
      },
      {
        source: "/workspace/:id",
        destination: "/workspaces/:id",
        permanent: false,
      },
      // /dashboard/integrations was retired — agent connection now happens
      // per-Room (each Room has its own Connect tab that auto-fills the
      // real MCP URL). Send stale bookmarks to the Rooms list so users
      // land where they can actually pick a Room and connect.
      {
        source: "/dashboard/integrations",
        destination: "/dashboard/rooms",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
