import type { Koordinat } from "./types";
import raw from "@/data/wilayah.json";

/**
 * Hierarki wilayah Provinsi Riau (Kab/Kota → Kecamatan → Desa/Kelurahan) dari OpenStreetMap.
 * Dibuat oleh scripts/data/wilayah.mjs. Batas desa belum tersedia, jadi desa hanya punya titik.
 */
export type Level = "provinsi" | "kabupaten" | "kecamatan" | "desa";
export type Wilayah = {
  id: string;
  nama: string;
  level: Level;
  induk: string | null;
  koordinat: Koordinat;
  jenis?: string; // Kabupaten | Kota
  luasKm2?: number;
  studi?: boolean;
  catatan?: string;
};

const CATATAN: Record<string, string> = {
  "kec-rokan-hilir-tanah-putih": "Perlu verifikasi: Rantau Bais kemungkinan masuk Kec. Rantau Bais hasil pemekaran (Perda 11/2014).",
  "kec-kampar-tapung": "Perlu verifikasi: lokasi Kijang Rejo baru terkonfirmasi dari satu sumber.",
};

type Baris = [string, string, Level, string | null, number, number, string | number | null];

export const WILAYAH: Wilayah[] = [
  { id: "riau", nama: "Riau", level: "provinsi", induk: null, koordinat: [101.45, 0.55] },
  ...(raw.data as Baris[]).map(([id, nama, level, induk, x, y, info]) => ({
    id, nama, level, induk: induk ?? "riau", koordinat: [x, y] as Koordinat,
    ...(level === "kabupaten" ? { jenis: String(info) } : level === "kecamatan" ? { luasKm2: Number(info) } : { studi: info === 1 }),
    ...(CATATAN[id] ? { catatan: CATATAN[id] } : {}),
  })),
];

const BY_ID = new Map(WILAYAH.map((w) => [w.id, w]));
const ANAK = new Map<string, Wilayah[]>();
for (const w of WILAYAH) if (w.induk) ANAK.set(w.induk, [...(ANAK.get(w.induk) ?? []), w]);

export const getWilayah = (id: string | null | undefined) => (id ? BY_ID.get(id) : undefined);
export const anak = (id: string) => ANAK.get(id) ?? [];
export const KABUPATEN = anak("riau").sort((a, b) => a.nama.localeCompare(b.nama));
export const DESA_STUDI = WILAYAH.filter((w) => w.studi);
export const KAB_STUDI = KABUPATEN.filter((k) => DESA_STUDI.some((d) => rantai(d.id).some((x) => x.id === k.id)));

/** Rantai dari kabupaten ke wilayah ini (tanpa provinsi), mis. [kab, kec, desa]. */
export function rantai(id: string): Wilayah[] {
  const out: Wilayah[] = [];
  let w = BY_ID.get(id);
  while (w && w.level !== "provinsi") {
    out.unshift(w);
    w = w.induk ? BY_ID.get(w.induk) : undefined;
  }
  return out;
}

export const kabupatenDari = (id: string) => rantai(id)[0];

/** true bila wilayahId berada di dalam (atau sama dengan) filterId. Filter kosong/"riau" = semua. */
export function dalamWilayah(wilayahId: string, filterId?: string | null): boolean {
  if (!filterId || filterId === "riau") return true;
  return rantai(wilayahId).some((w) => w.id === filterId);
}

export function namaLengkap(w: Wilayah | undefined) {
  if (!w) return "";
  if (w.level === "kabupaten") return `${w.jenis === "Kota" ? "Kota" : "Kab."} ${w.nama}`;
  if (w.level === "kecamatan") return `Kec. ${w.nama}`;
  if (w.level === "desa") return `Desa ${w.nama}`;
  return w.nama;
}

/** "Kab. Bengkalis › Kec. Bathin Solapan › Sebangar"; wilayah tingkat provinsi → "Riau". */
export const labelWilayah = (id: string) => {
  const r = rantai(id);
  return r.length ? r.map((w) => (w.level === "desa" ? w.nama : namaLengkap(w))).join(" › ") : "Riau";
};

export const namaWilayah = (id: string) => getWilayah(id)?.nama ?? id;
