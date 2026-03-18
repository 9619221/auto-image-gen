import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "openai"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // 限制请求体大小
    },
  },
};

export default nextConfig;
