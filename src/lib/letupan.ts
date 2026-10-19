import type { Media, Sentimen } from "./types";
import { geserHari } from "./format";

export type Letupan = {
  sentimen: Sentimen;
  dari: string;
  sampai: string;
  jumlah: number;
  isu: string;
  wilayahId: string;
  contoh: Media[];
};

/**
 * Deteksi "letupan" pemberitaan: hari ketika jumlah item bersentimen tertentu
 * ≥ 3× rata-rata 14 hari sebelumnya (minimal 4 item). Hari berurutan digabung jadi satu letupan.
 */
export function deteksiLetupan(media: Media[], sentimen: Sentimen, mulai: string, akhir: string): Letupan[] {
  const perHari = new Map<string, Media[]>();
  for (const m of media) if (m.sentimen === sentimen) perHari.set(m.tanggal, [...(perHari.get(m.tanggal) ?? []), m]);
  const hasil: Letupan[] = [];
  let aktif: Letupan | null = null;
  for (let t = mulai; t <= akhir; t = geserHari(t, 1)) {
    let dasar = 0;
    for (let i = 1; i <= 14; i++) dasar += perHari.get(geserHari(t, -i))?.length ?? 0;
    dasar /= 14;
    const hari = perHari.get(t) ?? [];
    const naik = hari.length >= Math.max(4, dasar * 3);
    if (naik) {
      // jeda ≤ 1 hari masih dianggap letupan yang sama (hari di tengah bisa tak lolos ambang karena rata-rata ikut naik)
      if (aktif && t <= geserHari(aktif.sampai, 2)) {
        for (let s = geserHari(aktif.sampai, 1); s < t; s = geserHari(s, 1)) aktif.contoh.push(...(perHari.get(s) ?? []));
        aktif.sampai = t; aktif.contoh.push(...hari);
      } else { aktif = { sentimen, dari: t, sampai: t, jumlah: 0, isu: "", wilayahId: "", contoh: [...hari] }; hasil.push(aktif); }
    }
  }
  for (const l of hasil) {
    l.jumlah = l.contoh.length;
    l.isu = modus(l.contoh.map((m) => m.isu));
    l.wilayahId = modus(l.contoh.map((m) => m.wilayahId));
    // contoh yang ditampilkan: dari isu & wilayah dominan, campur berita dan sosmed bila ada
    const inti = l.contoh.filter((m) => m.isu === l.isu && m.wilayahId === l.wilayahId);
    const unik = [...new Map(inti.map((m) => [m.judul, m])).values()];
    l.contoh = [...unik.filter((m) => m.tipe === "berita").slice(0, 2), ...unik.filter((m) => m.tipe === "sosmed")].slice(0, 4);
  }
  return hasil.sort((a, b) => (a.dari < b.dari ? 1 : -1));
}

function modus(xs: string[]) {
  const c = new Map<string, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}
