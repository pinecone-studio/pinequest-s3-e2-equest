import type { NextConfig } from "next";

const isProductionBuild = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: isProductionBuild ? "export" : undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
