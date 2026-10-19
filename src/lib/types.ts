export type Peran = "admin" | "editor" | "viewer";

export type Sesi = { username: string; nama: string; peran: Peran };

/** [bujur, lintang] */
export type Koordinat = [number, number];

export type Sentimen = "positif" | "netral" | "negatif";
export type Sikap = "Mendukung" | "Netral" | "Kritis";
export type StatusKonflik = "Belum ditangani" | "Dalam proses" | "Selesai" | "Tidak diketahui";
export type Kerahasiaan = "Publik" | "Internal" | "Rahasia";
export type Presisi = "titik" | "desa" | "kecamatan" | "kabupaten" | "provinsi";
export type Rujukan = { nama: string; url?: string };

/** Mengikuti format data konflik TanahKita.id (nomor, waktu, sektor, status, luas, dampak, keterlibatan, narasi, sumber). */
export type Konflik = {
  id: string;
  nomor: string;
  judul: string;
  tanggal: string; // YYYY-MM-DD
  tahun: number;
  jenis: string;
  sektor: string;
  sektorLain: string;
  status: StatusKonflik;
  luasHa: number | null;
  dampakJiwa: number | null;
  kerahasiaan: Kerahasiaan;
  keterlibatan: { pemerintah: string[]; perusahaan: string[]; masyarakat: string[] };
  ringkasan: string;
  narasi: string;
  sumber: Rujukan[];
  lampiran: Rujukan[];
  wilayahId: string;
  presisi: Presisi;
  koordinat: Koordinat;
  asal: "TanahKita" | "Berita" | "Studi" | "Input";
};

export type Potensi = {
  id: string;
  nama: string;
  kategori: string;
  subkategori: string;
  komoditas: string[];
  status: "Beroperasi" | "Tidak aktif" | "Dalam pembangunan" | "Tidak diketahui";
  deskripsi: string;
  pengelola: string;
  keterlibatan: { pemerintah: string[]; swasta: string[]; masyarakat: string[] };
  atribut: Record<string, string>;
  sumber: Rujukan[];
  lampiran: Rujukan[];
  wilayahId: string;
  presisi: Presisi;
  koordinat: Koordinat;
  asal: "OSM" | "BPS" | "Studi" | "Input";
  kerahasiaan: Kerahasiaan;
  tanggal?: string;
};

export type Aktor = {
  id: string;
  wilayahId: string;
  nama: string;
  kategori: string;
  level: "desa" | "kecamatan" | "kabupaten" | "perusahaan";
  pengaruh: number; // 1–5
  kepentingan: number; // 1–5
  sikap: Sikap;
  catatan: string;
  koordinat?: Koordinat;
};

export type Relasi = {
  id: string;
  dari: string;
  ke: string;
  status: "baik" | "campuran" | "buruk";
  keterangan: string;
};

export type Media = {
  id: string;
  tanggal: string;
  tipe: "berita" | "sosmed";
  sumber: string;
  judul: string;
  ringkasan: string;
  /** Isi lengkap hanya untuk tulisan internal. Artikel media luar cukup ringkasan + tautan (hak cipta). */
  isi: string;
  url?: string;
  gambar?: string | null;
  sentimen: Sentimen;
  skor?: number;
  metodeSentimen?: "InSet" | "Manual";
  isu: string;
  wilayahId: string;
  presisi?: Presisi;
  kueri?: string;
  asal: "Google News" | "GDELT" | "Input" | "Contoh";
};

export type StatusDokumen = "Belum dicari" | "Sedang dicari" | "Tidak tersedia online" | "Sudah diunduh" | "Sudah diinput";

/** Dokumen sekunder untuk baseline wilayah studi (RPJMD, Dalam Angka, Renstra OPD). */
export type Dokumen = {
  id: string;
  judul: string;
  jenis: string;
  wilayahId: string;
  tahun: string; // "2024" atau periode "2021–2026"
  penerbit: string;
  status: StatusDokumen;
  url: string;
  /** Angka penting yang diambil dari dokumen, mis. { nama: "Jumlah penduduk 2024", nilai: "245.310 jiwa" }. */
  indikator: { nama: string; nilai: string }[];
  catatan: string;
  diperbarui: string;
};

export type Database = {
  konflik: Konflik[];
  potensi: Potensi[];
  aktor: Aktor[];
  relasi: Relasi[];
  media: Media[];
  dokumen: Dokumen[];
  log: { waktu: string; oleh: string; aksi: string }[];
  /** Kapan tiap sumber data terbuka terakhir dimuat. */
  meta?: { sumber: { nama: string; url?: string; lisensi?: string; catatan?: string }[]; dimuat: string };
};

export type Koleksi = "konflik" | "potensi" | "aktor" | "media" | "dokumen";
