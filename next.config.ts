import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Документи до 10 МБ + multipart-обгортка та решта полів форми:
    // ліміт тіла мусить бути БІЛЬШИМ за максимальний файл, інакше
    // файл рівно на 10 МБ падає з 413 замість зрозумілої помилки форми.
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
