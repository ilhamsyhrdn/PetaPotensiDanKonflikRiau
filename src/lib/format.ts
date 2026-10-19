import type { Media, Sentimen, Sikap } from "./types";

const fmtTanggal = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtTanggalPanjang = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const fmtTanggalPendek = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });

export const tanggal = (iso: string) => fmtTanggal.format(new Date(iso.slice(0, 10) + "T00:00:00Z"));
export const tanggalPanjang = (iso: string) => fmtTanggalPanjang.format(new Date(iso.slice(0, 10) + "T00:00:00Z"));
export const tanggalPendek = (iso: string) => fmtTanggalPendek.format(new Date(iso.slice(0, 10) + "T00:00:00Z"));
export const angka = (n: number) => n.toLocaleString("id-ID");
export const persen = (n: number) => `${Math.round(n * 100)}%`;

/** Tanggal hari ini (UTC, YYYY-MM-DD). Dihitung di server lalu dikirim ke komponen klien bila perlu. */
export const hariIni = () => new Date().toISOString().slice(0, 10);
export const geserHari = (iso: string, hari: number) =>
  new Date(Date.parse(iso + "T00:00:00Z") + hari * 86400000).toISOString().slice(0, 10);

export const WARNA_SENTIMEN: Record<Sentimen, string> = { positif: "#2f9e44", netral: "#868e96", negatif: "#e03131" };
export const WARNA_SIKAP: Record<Sikap, string> = { Mendukung: "#2f9e44", Netral: "#868e96", Kritis: "#e03131" };
export const WARNA_RELASI = { baik: "#2f9e44", campuran: "#f08c00", buruk: "#e03131" } as const;

export const WARNA_KATEGORI_AKTOR: Record<string, string> = {
  Perusahaan: "#142230", "Pemerintah desa": "#2f6690", "Pemerintah kecamatan": "#1971c2", "Pemerintah kabupaten": "#0b4f8a",
  "Lembaga adat": "#a0522d", "Tokoh masyarakat": "#5f3dc4", "Kelompok ekonomi": "#2b8a3e", "Ormas / LSM": "#d9480f", Pemuda: "#e8590c",
};
export const warnaKategori = (k: string) => WARNA_KATEGORI_AKTOR[k] ?? "#495057";

export function ringkasSentimen(items: Media[]) {
  const r = { positif: 0, netral: 0, negatif: 0, total: items.length };
  for (const m of items) r[m.sentimen]++;
  return r;
}

/** Indeks -100..100: (positif − negatif) / total. */
export const indeksSentimen = (r: { positif: number; negatif: number; total: number }) =>
  r.total ? Math.round(((r.positif - r.negatif) / r.total) * 100) : 0;

export const domain = (url?: string) => {
  try { return url ? new URL(url).hostname.replace(/^www\./, "") : ""; } catch { return ""; }
};

// Nama TanahKita tidak ditampilkan di web; data mentahnya tetap menyimpan asal aslinya.
export const labelAsal = (asal: string) => (asal === "TanahKita" ? "Data sekunder" : asal);
export const dariTanahKita = (r: { nama?: string; url?: string }) => /tanah\s*kita/i.test(`${r.nama ?? ""} ${r.url ?? ""}`);
export const tanpaTanahKita = <T extends { nama?: string; url?: string }>(list: T[]) => list.filter((r) => !dariTanahKita(r));

export const potong = (s: string, n: number) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s);
