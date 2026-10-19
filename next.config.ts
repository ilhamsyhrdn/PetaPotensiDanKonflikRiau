import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // folder build bisa dipindah (mis. uji build saat server dev sedang jalan)
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // skrip data dijalankan sebagai proses terpisah oleh tombol Perbarui, jadi tidak terdeteksi otomatis;
  // hosting yang hanya menyalin berkas hasil tracing (mis. Hostinger) perlu didaftarkan di sini
  outputFileTracingIncludes: {
    "/api/pembaruan": [
      "./scripts/data/*.mjs",
      "./src/data/wilayah.json",
      "./public/geo/*.geojson",
      "./node_modules/@turf/boolean-point-in-polygon/**/*",
      "./node_modules/@turf/helpers/**/*",
      "./node_modules/@turf/invariant/**/*",
      "./node_modules/point-in-polygon-hao/**/*",
      "./node_modules/robust-predicates/**/*",
      "./node_modules/tslib/**/*",
    ],
  },
};

export default nextConfig;
