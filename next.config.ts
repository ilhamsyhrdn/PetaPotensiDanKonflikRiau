import type { NextConfig } from "next";
import { randomBytes } from "node:crypto";

// Kunci sesi cadangan bila AUTH_SECRET tidak diisi. Disimpan di process.env supaya proses pekerja build
// (yang memuat ulang berkas ini) mewarisi nilai yang sama, sehingga middleware dan API memakai kunci yang sama.
process.env.KUNCI_SESI_BUILD ??= randomBytes(32).toString("base64url");

const KEAMANAN = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  env: { KUNCI_SESI_BUILD: process.env.KUNCI_SESI_BUILD },
  headers: async () => [{ source: "/:path*", headers: KEAMANAN }],
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
