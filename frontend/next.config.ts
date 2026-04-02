import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  async rewrites() {
    if (process.env.NODE_ENV !== "development") {
      return [];
    }

    const frontendApiBaseUrl = process.env.NEXT_PUBLIC_FRONTEND_API_BASE_URL
      ?.trim()
      .replace(/\/$/, "");

    if (!frontendApiBaseUrl) {
      return [];
    }

    return [
      {
        source: "/api/ably/auth",
        destination: `${frontendApiBaseUrl}/api/ably/auth`,
      },
    ];
  },
};

export default nextConfig;
