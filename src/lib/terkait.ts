import type { Database, Media } from "./types";
import { kabupatenDari, rantai } from "./wilayah";

const BUANG = new Set(["dan", "di", "ke", "dari", "yang", "untuk", "dengan", "pada", "dalam", "atas", "warga", "desa", "kabupaten", "kecamatan", "riau", "pt", "vs", "oleh", "ini", "itu", "akan", "tidak", "sebagai", "kab", "kota"]);
const token = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((t) => t.length > 3 && !BUANG.has(t)));

/** Berita di kabupaten yang sama, diurutkan menurut kemiripan kata dengan teks acuan, lalu tanggal. */
export function beritaTerkait(db: Database, wilayahId: string, teks: string, n = 5, kecuali?: string): Media[] {
  const kab = kabupatenDari(wilayahId)?.id;
  const t = token(teks);
  return db.media
    .filter((m) => m.id !== kecuali && m.tipe === "berita" && (!kab || rantai(m.wilayahId).some((w) => w.id === kab)))
    .map((m) => ({ m, s: [...token(m.judul + " " + m.ringkasan)].filter((x) => t.has(x)).length }))
    .sort((a, b) => b.s - a.s || (a.m.tanggal < b.m.tanggal ? 1 : -1))
    .slice(0, n)
    .map((x) => x.m);
}

export const satuKab = (a: string, b: string) => kabupatenDari(a)?.id === kabupatenDari(b)?.id;
export const satuKec = (a: string, b: string) => {
  const ka = rantai(a)[1]?.id, kb = rantai(b)[1]?.id;
  return !!ka && ka === kb;
};

/** Jarak kira-kira (km) antara dua koordinat [bujur, lintang]. */
export const jarakKm = ([x1, y1]: [number, number], [x2, y2]: [number, number]) =>
  Math.hypot((x1 - x2) * 111.32 * Math.cos(((y1 + y2) / 2) * Math.PI / 180), (y1 - y2) * 110.57);

/** n item terdekat dari sebuah titik, beserta jaraknya. */
export function terdekat<T extends { koordinat: [number, number]; id: string }>(list: T[], dari: [number, number], n: number, kecuali?: string) {
  return list.filter((x) => x.id !== kecuali).map((x) => ({ x, km: jarakKm(x.koordinat, dari) })).sort((a, b) => a.km - b.km).slice(0, n);
}
