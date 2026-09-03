import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  reactStrictMode: true,
  typedRoutes: true,
  async redirects() {
    return ["/identification", "/peaks", "/result"].map((source) => ({
      source,
      destination: "/analysis",
      permanent: true,
    }));
  },
};

export default nextConfig;
