import type { Koleksi } from "./types";
import { ISU_MEDIA, JENIS_KONFLIK, KATEGORI_POTENSI, SEKTOR_KONFLIK, STATUS_KONFLIK } from "./kategori";
import { JENIS_DOKUMEN, STATUS_DOKUMEN } from "./baseline";

export type Field = {
  kunci: string;
  label: string;
  tipe: "teks" | "panjang" | "pilih" | "tanggal" | "angka" | "desimal" | "daftar" | "wilayah" | "koordinat" | "url" | "gambar" | "rujukan" | "indikator";
  opsi?: (string | { nilai: string; label: string })[];
  wajib?: boolean;
  min?: number;
  max?: number;
  level?: ("provinsi" | "kabupaten" | "kecamatan" | "desa")[];
  bantuan?: string;
  lebar?: "penuh" | "setengah";
  baris?: number;
};

export const KATEGORI_AKTOR = ["Pemerintah desa", "Pemerintah kecamatan", "Pemerintah kabupaten", "Lembaga adat", "Tokoh masyarakat", "Kelompok ekonomi", "Ormas / LSM", "Pemuda"];
const RUJUKAN = "Satu baris per sumber: Nama | https://tautan";

/** Satu skema dipakai bersama oleh form (klien) dan validasi (server). */
export const SKEMA: Record<Koleksi, { label: string; tunggal: string; kolom: { kunci: string; label: string }[]; field: Field[] }> = {
  konflik: {
    label: "Titik konflik", tunggal: "titik konflik",
    kolom: [{ kunci: "judul", label: "Judul" }, { kunci: "wilayahId", label: "Lokasi" }, { kunci: "sektor", label: "Sektor" }, { kunci: "status", label: "Status" }, { kunci: "tanggal", label: "Tanggal" }, { kunci: "asal", label: "Asal" }],
    field: [
      { kunci: "judul", label: "Judul konflik", tipe: "teks", wajib: true, lebar: "penuh" },
      { kunci: "nomor", label: "Nomor kejadian", tipe: "teks", lebar: "setengah" },
      { kunci: "tanggal", label: "Waktu kejadian", tipe: "tanggal", wajib: true, lebar: "setengah" },
      { kunci: "wilayahId", label: "Lokasi (kab/kec/desa)", tipe: "wilayah", level: ["kabupaten", "kecamatan", "desa"], wajib: true, lebar: "penuh" },
      { kunci: "sektor", label: "Sektor", tipe: "pilih", opsi: SEKTOR_KONFLIK.map((s) => s.nama), wajib: true, lebar: "setengah" },
      { kunci: "sektorLain", label: "Sektor lain", tipe: "teks", lebar: "setengah" },
      { kunci: "jenis", label: "Jenis konflik", tipe: "pilih", opsi: JENIS_KONFLIK, wajib: true, lebar: "setengah" },
      { kunci: "status", label: "Status konflik", tipe: "pilih", opsi: STATUS_KONFLIK.map((s) => s.nama), wajib: true, lebar: "setengah" },
      { kunci: "luasHa", label: "Luas (Ha)", tipe: "desimal", min: 0, lebar: "setengah" },
      { kunci: "dampakJiwa", label: "Dampak masyarakat (jiwa)", tipe: "angka", min: 0, lebar: "setengah" },
      { kunci: "kerahasiaan", label: "Kerahasiaan", tipe: "pilih", opsi: ["Publik", "Internal", "Rahasia"], wajib: true, lebar: "setengah" },
      { kunci: "pemerintah", label: "Keterlibatan: pemerintah", tipe: "daftar", bantuan: "Pisahkan dengan koma", lebar: "penuh" },
      { kunci: "perusahaan", label: "Keterlibatan: perusahaan", tipe: "daftar", lebar: "penuh" },
      { kunci: "masyarakat", label: "Keterlibatan: masyarakat", tipe: "daftar", bantuan: "Tulis lembaga/kelompok, bukan nama pribadi (UU PDP)", lebar: "penuh" },
      { kunci: "ringkasan", label: "Ringkasan (tampil di popup peta)", tipe: "panjang", baris: 2, lebar: "penuh" },
      { kunci: "narasi", label: "Narasi", tipe: "panjang", baris: 6, lebar: "penuh" },
      { kunci: "sumber", label: "Sumber", tipe: "rujukan", bantuan: RUJUKAN, lebar: "penuh" },
      { kunci: "lampiran", label: "Lampiran", tipe: "rujukan", bantuan: RUJUKAN, lebar: "penuh" },
      { kunci: "koordinat", label: "Titik lokasi", tipe: "koordinat", lebar: "penuh" },
    ],
  },
  potensi: {
    label: "Potensi ekonomi", tunggal: "titik potensi",
    kolom: [{ kunci: "nama", label: "Nama" }, { kunci: "wilayahId", label: "Lokasi" }, { kunci: "kategori", label: "Lapangan usaha" }, { kunci: "subkategori", label: "Jenis" }, { kunci: "status", label: "Status" }, { kunci: "asal", label: "Asal" }],
    field: [
      { kunci: "nama", label: "Nama potensi", tipe: "teks", wajib: true, lebar: "penuh" },
      { kunci: "kategori", label: "Lapangan usaha (BPS)", tipe: "pilih", opsi: KATEGORI_POTENSI.map((k) => ({ nilai: k.id, label: `${k.nama} (KBLI ${k.kbli})` })), wajib: true, lebar: "setengah" },
      { kunci: "subkategori", label: "Jenis (mis. Pasar tradisional)", tipe: "teks", wajib: true, lebar: "setengah" },
      { kunci: "komoditas", label: "Komoditas", tipe: "daftar", bantuan: "Pisahkan dengan koma", lebar: "setengah" },
      { kunci: "status", label: "Status", tipe: "pilih", opsi: ["Beroperasi", "Tidak aktif", "Dalam pembangunan", "Tidak diketahui"], wajib: true, lebar: "setengah" },
      { kunci: "pengelola", label: "Pengelola", tipe: "teks", lebar: "setengah" },
      { kunci: "kerahasiaan", label: "Kerahasiaan", tipe: "pilih", opsi: ["Publik", "Internal", "Rahasia"], wajib: true, lebar: "setengah" },
      { kunci: "wilayahId", label: "Lokasi (kab/kec/desa)", tipe: "wilayah", level: ["kabupaten", "kecamatan", "desa"], wajib: true, lebar: "penuh" },
      { kunci: "pemerintah", label: "Keterlibatan: pemerintah", tipe: "daftar", lebar: "penuh" },
      { kunci: "swasta", label: "Keterlibatan: swasta", tipe: "daftar", lebar: "penuh" },
      { kunci: "masyarakat", label: "Keterlibatan: masyarakat", tipe: "daftar", lebar: "penuh" },
      { kunci: "deskripsi", label: "Deskripsi", tipe: "panjang", baris: 4, lebar: "penuh" },
      { kunci: "sumber", label: "Sumber", tipe: "rujukan", bantuan: RUJUKAN, lebar: "penuh" },
      { kunci: "lampiran", label: "Lampiran", tipe: "rujukan", bantuan: RUJUKAN, lebar: "penuh" },
      { kunci: "koordinat", label: "Titik lokasi", tipe: "koordinat", lebar: "penuh" },
    ],
  },
  aktor: {
    label: "Aktor", tunggal: "aktor",
    kolom: [{ kunci: "nama", label: "Nama / jabatan" }, { kunci: "wilayahId", label: "Wilayah" }, { kunci: "kategori", label: "Kategori" }, { kunci: "pengaruh", label: "Pengaruh" }, { kunci: "kepentingan", label: "Kepentingan" }, { kunci: "sikap", label: "Sikap" }],
    field: [
      { kunci: "nama", label: "Nama atau jabatan", tipe: "teks", wajib: true, lebar: "penuh", bantuan: "Untuk data sungguhan, pertimbangkan jabatan saja (UU PDP)." },
      { kunci: "wilayahId", label: "Wilayah", tipe: "wilayah", level: ["kabupaten", "kecamatan", "desa"], wajib: true, lebar: "penuh" },
      { kunci: "kategori", label: "Kategori", tipe: "pilih", opsi: KATEGORI_AKTOR, wajib: true, lebar: "setengah" },
      { kunci: "sikap", label: "Sikap terhadap perusahaan", tipe: "pilih", opsi: ["Mendukung", "Netral", "Kritis"], wajib: true, lebar: "setengah" },
      { kunci: "pengaruh", label: "Pengaruh (1–5)", tipe: "angka", min: 1, max: 5, wajib: true, lebar: "setengah" },
      { kunci: "kepentingan", label: "Kepentingan (1–5)", tipe: "angka", min: 1, max: 5, wajib: true, lebar: "setengah" },
      { kunci: "catatan", label: "Catatan", tipe: "panjang", lebar: "penuh" },
    ],
  },
  media: {
    label: "Berita & sosmed", tunggal: "berita",
    kolom: [{ kunci: "tanggal", label: "Tanggal" }, { kunci: "judul", label: "Judul" }, { kunci: "sumber", label: "Sumber" }, { kunci: "sentimen", label: "Sentimen" }, { kunci: "isu", label: "Isu" }, { kunci: "asal", label: "Asal" }],
    field: [
      { kunci: "judul", label: "Judul", tipe: "teks", wajib: true, lebar: "penuh" },
      { kunci: "tanggal", label: "Tanggal terbit", tipe: "tanggal", wajib: true, lebar: "setengah" },
      { kunci: "tipe", label: "Tipe", tipe: "pilih", opsi: [{ nilai: "berita", label: "Berita online" }, { nilai: "sosmed", label: "Media sosial" }], wajib: true, lebar: "setengah" },
      { kunci: "sumber", label: "Nama media / platform / penulis", tipe: "teks", wajib: true, lebar: "setengah" },
      { kunci: "url", label: "Tautan sumber luar", tipe: "url", lebar: "setengah", bantuan: "Opsional. Pembaca diarahkan ke artikel asli." },
      { kunci: "gambar", label: "Gambar", tipe: "gambar", lebar: "penuh", bantuan: "Unggah JPG/PNG/WebP (maks 5 MB) atau tempel URL gambar." },
      { kunci: "ringkasan", label: "Ringkasan / cuplikan", tipe: "panjang", baris: 3, lebar: "penuh" },
      { kunci: "isi", label: "Isi tulisan (bisa dibaca langsung di dashboard)", tipe: "panjang", baris: 9, lebar: "penuh", bantuan: "Untuk tulisan atau catatan tim sendiri. Jangan menyalin utuh artikel media lain; cukup ringkasan + tautan." },
      { kunci: "sentimen", label: "Sentimen", tipe: "pilih", opsi: ["positif", "netral", "negatif"], wajib: true, lebar: "setengah" },
      { kunci: "isu", label: "Isu", tipe: "pilih", opsi: ISU_MEDIA, wajib: true, lebar: "setengah" },
      { kunci: "wilayahId", label: "Wilayah yang dibicarakan", tipe: "wilayah", level: ["provinsi", "kabupaten", "kecamatan", "desa"], wajib: true, lebar: "penuh" },
    ],
  },
  dokumen: {
    label: "Dokumen baseline", tunggal: "dokumen",
    kolom: [{ kunci: "judul", label: "Judul" }, { kunci: "wilayahId", label: "Wilayah" }, { kunci: "jenis", label: "Jenis" }, { kunci: "tahun", label: "Tahun" }, { kunci: "status", label: "Status" }],
    field: [
      { kunci: "judul", label: "Judul dokumen", tipe: "teks", wajib: true, lebar: "penuh" },
      { kunci: "jenis", label: "Jenis", tipe: "pilih", opsi: [...JENIS_DOKUMEN], wajib: true, lebar: "setengah" },
      { kunci: "status", label: "Status", tipe: "pilih", opsi: STATUS_DOKUMEN.map((s) => s.nama), wajib: true, lebar: "setengah" },
      { kunci: "wilayahId", label: "Wilayah", tipe: "wilayah", level: ["kabupaten", "kecamatan", "desa"], wajib: true, lebar: "penuh" },
      { kunci: "tahun", label: "Tahun / periode", tipe: "teks", lebar: "setengah", bantuan: "Mis. 2024, atau 2021–2026 untuk RPJMD dan Renstra." },
      { kunci: "penerbit", label: "Penerbit / instansi", tipe: "teks", lebar: "setengah" },
      { kunci: "url", label: "Tautan unduh", tipe: "url", lebar: "penuh", bantuan: "Tautan ke halaman dokumen atau berkas PDF-nya." },
      { kunci: "indikator", label: "Angka baseline dari dokumen ini", tipe: "indikator", baris: 6, lebar: "penuh", bantuan: "Satu baris per angka: Nama | Nilai. Mis. Jumlah penduduk 2024 | 245.310 jiwa" },
      { kunci: "catatan", label: "Catatan", tipe: "panjang", lebar: "penuh" },
    ],
  },
};

/** Ubah data tersimpan (bertingkat) menjadi nilai form datar. */
export function ratakan(koleksi: Koleksi, item: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...item };
  const ket = item.keterlibatan as Record<string, string[]> | undefined;
  if (ket) Object.assign(out, ket);
  if (Array.isArray(item.indikator)) out.indikator = (item.indikator as { nama: string; nilai: string }[]).map((i) => `${i.nama} | ${i.nilai}`).join("\n");
  for (const k of ["sumber", "lampiran"]) {
    if (koleksi !== "media" && Array.isArray(item[k])) out[k] = (item[k] as { nama: string; url?: string }[]).map((r) => (r.url ? `${r.nama} | ${r.url}` : r.nama)).join("\n");
  }
  return out;
}

/** Urutan tab di halaman Kelola Data. */
export const TAB_KELOLA: Koleksi[] = ["konflik", "potensi", "media", "aktor", "dokumen"];
