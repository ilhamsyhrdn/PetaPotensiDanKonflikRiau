import type { StatusKonflik } from "./types";

/**
 * Kategori & warna peta. Warna antarmuka mengikuti palet dokumen project (biru tua #1C2B38,
 * biru baja #2F6690, ungu #7A58A3, karat #A23A1C); warna kategori dipilih agar tetap terbaca
 * di atas citra satelit (diberi tepi putih).
 */

// Sektor konflik mengikuti taksonomi TanahKita.id, ditambah Minyak dan Gas untuk konteks wilayah kerja migas.
export const SEKTOR_KONFLIK: { nama: string; warna: string }[] = [
  { nama: "Perkebunan", warna: "#F08C00" },
  { nama: "Hutan Produksi", warna: "#A23A1C" },
  { nama: "Hutan Lindung", warna: "#C2255C" },
  { nama: "Hutan Konservasi", warna: "#862E9C" },
  { nama: "Minyak dan Gas", warna: "#1C2B38" },
  { nama: "Pertambangan", warna: "#6741D9" },
  { nama: "Kawasan Industri", warna: "#2F6690" },
  { nama: "Infrastruktur", warna: "#1971C2" },
  { nama: "Infrastruktur Energi Listrik", warna: "#0C8599" },
  { nama: "Sarana Umum", warna: "#E03131" },
  { nama: "Pariwisata", warna: "#D6336C" },
  { nama: "Transmigrasi", warna: "#82C91E" },
  { nama: "Pesisir dan Laut", warna: "#15AABF" },
  { nama: "Perumahan dan Kota Baru", warna: "#FAB005" },
  { nama: "Lainnya", warna: "#868E96" },
];
const W_SEKTOR = new Map(SEKTOR_KONFLIK.map((s) => [s.nama, s.warna]));
export const warnaSektorKonflik = (s: string) => W_SEKTOR.get(s) ?? "#868E96";

export const JENIS_KONFLIK = ["Sengketa lahan", "Tanah ulayat/adat", "Ganti rugi", "Pencemaran lingkungan", "Kebakaran hutan & lahan", "Ketenagakerjaan", "Kriminalisasi", "Akses & infrastruktur", "CSR/TJSL", "Lainnya"];

export const STATUS_KONFLIK: { nama: StatusKonflik; warna: string }[] = [
  { nama: "Belum ditangani", warna: "#C92A2A" },
  { nama: "Dalam proses", warna: "#E8590C" },
  { nama: "Selesai", warna: "#2F9E44" },
  { nama: "Tidak diketahui", warna: "#868E96" },
];
export const warnaStatus = (s: string) => STATUS_KONFLIK.find((x) => x.nama === s)?.warna ?? "#868E96";
/** Konflik aktif = sudah diketahui statusnya dan belum selesai. "Tidak diketahui" dihitung terpisah. */
export const konflikAktif = (s: StatusKonflik) => s === "Belum ditangani" || s === "Dalam proses";

/**
 * Kategori potensi ekonomi mengikuti lapangan usaha BPS (KBLI 2020).
 * Warna mengikuti konvensi peta tematik: hijau pertanian, biru perikanan, coklat tambang, ungu industri, dst.
 */
export const KATEGORI_POTENSI: { id: string; nama: string; kbli: string; warna: string; ikon: string }[] = [
  { id: "pertanian", nama: "Pertanian & Perkebunan", kbli: "A", warna: "#2F9E44", ikon: "🌾" },
  { id: "perikanan", nama: "Perikanan", kbli: "A", warna: "#1C7ED6", ikon: "🐟" },
  { id: "kehutanan", nama: "Kehutanan", kbli: "A", warna: "#2B6A3A", ikon: "🌲" },
  { id: "pertambangan", nama: "Pertambangan & Penggalian", kbli: "B", warna: "#8D5524", ikon: "⛏" },
  { id: "industri", nama: "Industri Pengolahan", kbli: "C", warna: "#7A58A3", ikon: "🏭" },
  { id: "energi", nama: "Energi & Listrik", kbli: "D", warna: "#E8A100", ikon: "⚡" },
  { id: "perdagangan", nama: "Perdagangan", kbli: "G", warna: "#E8590C", ikon: "🛒" },
  { id: "transportasi", nama: "Transportasi & Logistik", kbli: "H", warna: "#3B5BDB", ikon: "⚓" },
  { id: "pariwisata", nama: "Pariwisata & Akomodasi", kbli: "I", warna: "#D6336C", ikon: "🏝" },
  { id: "keuangan", nama: "Jasa Keuangan & Koperasi", kbli: "K", warna: "#0B7285", ikon: "🏦" },
];
const K_POT = new Map(KATEGORI_POTENSI.map((k) => [k.id, k]));
export const kategoriPotensi = (id: string) => K_POT.get(id) ?? { id, nama: id, kbli: "-", warna: "#868E96", ikon: "•" };
export const warnaPotensi = (id: string) => kategoriPotensi(id).warna;

export const ISU_MEDIA = ["Program CSR/TJSL", "Lingkungan", "Tenaga kerja lokal", "Infrastruktur", "Lahan", "Ekonomi lokal", "Operasi & produksi migas", "Keselamatan & insiden", "Kebijakan & regulasi", "Lainnya"];
const WARNA_ISU = ["#2F9E44", "#A23A1C", "#E8590C", "#1971C2", "#C2255C", "#0B7285", "#1C2B38", "#E03131", "#7A58A3", "#868E96"];
export const warnaIsu = (isu: string) => WARNA_ISU[Math.max(0, ISU_MEDIA.indexOf(isu))] ?? "#868E96";
