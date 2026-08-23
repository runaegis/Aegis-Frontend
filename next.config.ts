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
      // /dashboard/integrations was retired. Send stale bookmarks to the
      // workspaces list where users can manage agent connections.
      {
        source: "/dashboard/integrations",
        destination: "/dashboard/workspaces",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
