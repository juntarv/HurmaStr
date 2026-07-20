import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Фото довідок можуть важити більше за стандартний ліміт 1 МБ.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
