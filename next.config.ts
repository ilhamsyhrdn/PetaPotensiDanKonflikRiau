import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // folder build bisa dipindah (mis. uji build saat server dev sedang jalan)
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
