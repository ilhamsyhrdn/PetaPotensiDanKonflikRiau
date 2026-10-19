import type { Database } from "./types";
import { geserHari, hariIni, indeksSentimen } from "./format";
import { WILAYAH, rantai } from "./wilayah";
import { konflikAktif } from "./kategori";

export type AngkaWilayah = {
  konflik: number; konflikAktif: number; belumDitangani: number;
  potensi: number; potensiKat: Record<string, number>;
  aktor: number; media30: number; negatif30: number; indeks: number;
};
export type Ringkasan = Record<string, AngkaWilayah>;

/** Angka ringkas per wilayah (provinsi, kabupaten, kecamatan, desa) untuk peta, tabel, dan presentasi. */
export function hitungRingkasan(db: Database): Ringkasan {
  const r: Ringkasan = {};
  const baru = (): AngkaWilayah => ({ konflik: 0, konflikAktif: 0, belumDitangani: 0, potensi: 0, potensiKat: {}, aktor: 0, media30: 0, negatif30: 0, indeks: 0 });
  for (const w of WILAYAH) r[w.id] = baru();
  const pos: Record<string, number> = {};
  const batas = geserHari(hariIni(), -30);
  const naik = (wilayahId: string, fn: (x: AngkaWilayah, id: string) => void) => {
    for (const w of [{ id: "riau" }, ...rantai(wilayahId)]) fn((r[w.id] ??= baru()), w.id);
  };
  for (const k of db.konflik) naik(k.wilayahId, (x) => { x.konflik++; if (konflikAktif(k.status)) x.konflikAktif++; if (k.status === "Belum ditangani") x.belumDitangani++; });
  for (const p of db.potensi) naik(p.wilayahId, (x, id) => { x.potensi++; if (!id.startsWith("desa-")) x.potensiKat[p.kategori] = (x.potensiKat[p.kategori] ?? 0) + 1; });
  for (const a of db.aktor) if (a.level !== "perusahaan") naik(a.wilayahId, (x) => { x.aktor++; });
  for (const m of db.media) {
    if (m.tanggal < batas || m.tipe !== "berita") continue;
    naik(m.wilayahId, (x, id) => {
      x.media30++;
      if (m.sentimen === "negatif") x.negatif30++;
      if (m.sentimen === "positif") pos[id] = (pos[id] ?? 0) + 1;
    });
  }
  for (const [id, x] of Object.entries(r)) x.indeks = indeksSentimen({ positif: pos[id] ?? 0, negatif: x.negatif30, total: x.media30 });
  return r;
}

/** Hanya kabupaten & kecamatan (untuk dikirim ke peta di klien, lebih ringan). */
export const ringkasanPoligon = (r: Ringkasan): Ringkasan =>
  Object.fromEntries(Object.entries(r).filter(([id]) => id.startsWith("kab-") || id.startsWith("kec-") || id === "riau"));
