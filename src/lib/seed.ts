import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Aktor, Database, Koordinat, Konflik, Media, Potensi, Relasi, Sentimen } from "./types";
import { getWilayah, rantai } from "./wilayah";
import { dokumenAwal } from "./baseline";

/**
 * Data awal aplikasi:
 * - konflik, potensi, berita: data terbuka di data/sumber/*.json (dibuat oleh scripts/data/*.mjs)
 * - aktor & unggahan sosmed: DATA CONTOH sampai data studi lapangan tersedia.
 */
type Berkas<T> = { dibuat: string; sumber: { nama: string; url?: string; lisensi?: string; catatan?: string }[]; data: T[] };

function bacaSumber<T>(nama: string): Berkas<T> | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "sumber", `${nama}.json`), "utf8")) as Berkas<T>;
  } catch {
    return null;
  }
}

const RB = "desa-tanah-putih-rantau-bais";
const BM = "desa-bathin-solapan-balai-makam";
const KR = "desa-tapung-kijang-rejo";
const SB = "desa-bathin-solapan-sebangar";
const KK = "desa-kandis-kandis-kota";
const PB = "desa-tualang-perawang-barat";

const pos = (id: string, dx = 0, dy = 0): Koordinat => {
  const [x, y] = getWilayah(id)!.koordinat;
  return [Math.round((x + dx) * 1e5) / 1e5, Math.round((y + dy) * 1e5) / 1e5];
};

const PERUSAHAAN = "a-perusahaan";
export const ID_PERUSAHAAN = PERUSAHAAN;

function aktor(): Aktor[] {
  const a = (id: string, wilayahId: string, nama: string, kategori: string, level: Aktor["level"], pengaruh: number, kepentingan: number, sikap: Aktor["sikap"], catatan = "", dx = 0, dy = 0): Aktor =>
    ({ id, wilayahId, nama, kategori, level, pengaruh, kepentingan, sikap, catatan, koordinat: level === "perusahaan" ? undefined : pos(wilayahId, dx, dy) });
  return [
    a(PERUSAHAAN, "perusahaan", "Perusahaan (Tim CID & Relasi)", "Perusahaan", "perusahaan", 5, 5, "Mendukung", "Simpul pusat jejaring."),
    a("a-rb-1", RB, "Penghulu Rantau Bais", "Pemerintah desa", "desa", 4, 5, "Mendukung", "", 0.002, 0.002),
    a("a-rb-2", RB, "Ketua Bapekam", "Pemerintah desa", "desa", 3, 3, "Netral", "", -0.003, 0.003),
    a("a-rb-3", RB, "Batin persukuan", "Lembaga adat", "desa", 5, 5, "Kritis", "Kunci isu tanah ulayat.", 0.004, -0.003),
    a("a-rb-4", RB, "Kelompok nelayan Sungai Rokan", "Kelompok ekonomi", "desa", 2, 4, "Netral", "", -0.006, 0.008),
    a("a-bm-1", BM, "Kepala Desa Balai Makam", "Pemerintah desa", "desa", 4, 4, "Mendukung", "", 0.002, 0.002),
    a("a-bm-2", BM, "Ketua BPD", "Pemerintah desa", "desa", 3, 3, "Netral", "", -0.003, 0.003),
    a("a-bm-3", BM, "Kelompok tani sawit", "Kelompok ekonomi", "desa", 2, 5, "Kritis", "Terlibat sengketa batas lahan.", 0.012, 0.008),
    a("a-bm-4", BM, "Ketua BUMDes", "Kelompok ekonomi", "desa", 3, 4, "Mendukung", "", -0.004, -0.004),
    a("a-kr-1", KR, "Kepala Desa Kijang Rejo", "Pemerintah desa", "desa", 4, 4, "Netral", "", 0.002, 0.002),
    a("a-kr-2", KR, "Ketua Gapoktan", "Kelompok ekonomi", "desa", 3, 5, "Mendukung", "", 0.006, 0.006),
    a("a-kr-3", KR, "Tokoh agama", "Tokoh masyarakat", "desa", 3, 2, "Netral", "", -0.004, 0.003),
    a("a-kr-4", KR, "Karang Taruna", "Pemuda", "desa", 2, 3, "Kritis", "", -0.006, -0.004),
    a("a-sb-1", SB, "Kepala Desa Sebangar", "Pemerintah desa", "desa", 4, 5, "Netral", "", 0.002, 0.002),
    a("a-sb-2", SB, "Ketua RT 03", "Tokoh masyarakat", "desa", 2, 5, "Kritis", "Koordinator keluhan debu.", 0.01, -0.004),
    a("a-sb-3", SB, "LSM lingkungan lokal", "Ormas / LSM", "desa", 3, 4, "Kritis", "", -0.006, 0.006),
    a("a-sb-4", SB, "Kelompok Wanita Tani", "Kelompok ekonomi", "desa", 1, 3, "Mendukung", "", 0.006, 0.01),
    a("a-kk-1", KK, "Lurah Kandis Kota", "Pemerintah desa", "desa", 4, 3, "Netral", "", 0.002, 0.002),
    a("a-kk-2", KK, "Ketua LPM", "Tokoh masyarakat", "desa", 3, 3, "Mendukung", "", -0.003, 0.004),
    a("a-kk-3", KK, "Paguyuban pedagang pasar", "Kelompok ekonomi", "desa", 2, 4, "Netral", "", 0.003, -0.002),
    a("a-kk-4", KK, "Serikat pekerja lokal", "Ormas / LSM", "desa", 3, 5, "Kritis", "", -0.006, -0.006),
    a("a-pb-1", PB, "Penghulu Perawang Barat", "Pemerintah desa", "desa", 4, 4, "Netral", "", 0.002, 0.002),
    a("a-pb-2", PB, "Ketua Bapekam", "Pemerintah desa", "desa", 3, 3, "Netral", "", -0.003, 0.003),
    a("a-pb-3", PB, "Forum pemuda", "Pemuda", "desa", 2, 4, "Kritis", "Menolak rencana jalur pipa.", -0.01, -0.008),
    a("a-pb-4", PB, "Koperasi UMKM", "Kelompok ekonomi", "desa", 2, 4, "Mendukung", "", 0.004, 0.004),
    a("a-kec-tp", "kec-rokan-hilir-tanah-putih", "Camat Tanah Putih", "Pemerintah kecamatan", "kecamatan", 4, 3, "Netral"),
    a("a-kec-bs", "kec-bengkalis-bathin-solapan", "Camat Bathin Solapan", "Pemerintah kecamatan", "kecamatan", 4, 4, "Mendukung"),
    a("a-kec-tg", "kec-kampar-tapung", "Camat Tapung", "Pemerintah kecamatan", "kecamatan", 4, 3, "Netral"),
    a("a-kec-kd", "kec-siak-kandis", "Camat Kandis", "Pemerintah kecamatan", "kecamatan", 4, 3, "Mendukung"),
    a("a-kec-tl", "kec-siak-tualang", "Camat Tualang", "Pemerintah kecamatan", "kecamatan", 4, 3, "Netral"),
    a("a-kab-rh", "kab-rokan-hilir", "Pemkab Rokan Hilir (Bappeda)", "Pemerintah kabupaten", "kabupaten", 5, 3, "Netral"),
    a("a-kab-bk", "kab-bengkalis", "Pemkab Bengkalis (Bappeda)", "Pemerintah kabupaten", "kabupaten", 5, 4, "Mendukung"),
    a("a-kab-kp", "kab-kampar", "Pemkab Kampar (Bappeda)", "Pemerintah kabupaten", "kabupaten", 5, 3, "Netral"),
    a("a-kab-sk", "kab-siak", "Pemkab Siak (Bappeda)", "Pemerintah kabupaten", "kabupaten", 5, 3, "Mendukung"),
  ];
}

function relasi(): Relasi[] {
  const r: [string, string, Relasi["status"], string][] = [
    [PERUSAHAAN, "a-rb-1", "baik", "Koordinasi program rutin"], [PERUSAHAAN, "a-bm-1", "baik", "Koordinasi program rutin"],
    [PERUSAHAAN, "a-kr-1", "campuran", "Komunikasi tersendat soal ganti rugi"], [PERUSAHAAN, "a-sb-1", "campuran", "Kades menengahi keluhan debu"],
    [PERUSAHAAN, "a-kk-1", "baik", "Kemitraan pasar dan UMKM"], [PERUSAHAAN, "a-pb-1", "campuran", "Sosialisasi jalur pipa belum tuntas"],
    [PERUSAHAAN, "a-rb-3", "buruk", "Isu tanah ulayat"], [PERUSAHAAN, "a-bm-3", "buruk", "Sengketa batas lahan"],
    [PERUSAHAAN, "a-sb-2", "buruk", "Keluhan debu dan kebisingan"], [PERUSAHAAN, "a-sb-3", "buruk", "Kritik isu lingkungan"],
    [PERUSAHAAN, "a-kk-4", "campuran", "Isu rekrutmen tenaga kerja"], [PERUSAHAAN, "a-pb-3", "buruk", "Penolakan jalur pipa"],
    [PERUSAHAAN, "a-kr-2", "baik", "Mitra program pertanian"], [PERUSAHAAN, "a-bm-4", "baik", "Mitra program perikanan"],
    [PERUSAHAAN, "a-pb-4", "baik", "Mitra program UMKM"], [PERUSAHAAN, "a-kec-bs", "baik", "Koordinasi wilayah"],
    [PERUSAHAAN, "a-kec-tp", "baik", "Koordinasi wilayah"], [PERUSAHAAN, "a-kab-bk", "baik", "Forum CSR kabupaten"],
    [PERUSAHAAN, "a-kab-sk", "baik", "Forum CSR kabupaten"], [PERUSAHAAN, "a-kab-rh", "campuran", "Menunggu kejelasan isu ulayat"],
    [PERUSAHAAN, "a-kab-kp", "baik", "Forum CSR kabupaten"],
    ["a-rb-1", "a-rb-2", "baik", "Struktural"], ["a-rb-1", "a-rb-3", "campuran", "Beda sikap soal lahan"], ["a-rb-1", "a-rb-4", "baik", "Pembinaan kelompok"],
    ["a-bm-1", "a-bm-2", "baik", "Struktural"], ["a-bm-1", "a-bm-3", "campuran", "Desakan mediasi lahan"], ["a-bm-1", "a-bm-4", "baik", "Struktural"],
    ["a-kr-1", "a-kr-2", "baik", "Koordinasi pertanian"], ["a-kr-1", "a-kr-3", "baik", "Kegiatan keagamaan"], ["a-kr-1", "a-kr-4", "campuran", "Tuntutan kegiatan pemuda"],
    ["a-sb-1", "a-sb-2", "campuran", "RT mendesak tindakan cepat"], ["a-sb-2", "a-sb-3", "baik", "Advokasi bersama"], ["a-sb-1", "a-sb-4", "baik", "Pembinaan kelompok"],
    ["a-kk-1", "a-kk-2", "baik", "Struktural"], ["a-kk-1", "a-kk-3", "baik", "Pengelolaan pasar"], ["a-kk-2", "a-kk-4", "campuran", "Beda pandangan rekrutmen"],
    ["a-pb-1", "a-pb-2", "baik", "Struktural"], ["a-pb-1", "a-pb-3", "campuran", "Pemuda mendesak penolakan"], ["a-pb-1", "a-pb-4", "baik", "Pembinaan UMKM"],
    ["a-kec-tp", "a-rb-1", "baik", "Struktural"], ["a-kec-bs", "a-bm-1", "baik", "Struktural"], ["a-kec-bs", "a-sb-1", "baik", "Struktural"],
    ["a-kec-tg", "a-kr-1", "baik", "Struktural"], ["a-kec-kd", "a-kk-1", "baik", "Struktural"], ["a-kec-tl", "a-pb-1", "baik", "Struktural"],
    ["a-kab-rh", "a-kec-tp", "baik", "Struktural"], ["a-kab-bk", "a-kec-bs", "baik", "Struktural"], ["a-kab-kp", "a-kec-tg", "baik", "Struktural"],
    ["a-kab-sk", "a-kec-kd", "baik", "Struktural"], ["a-kab-sk", "a-kec-tl", "baik", "Struktural"],
  ];
  return r.map(([dari, ke, status, keterangan], i) => ({ id: `r-${String(i + 1).padStart(2, "0")}`, dari, ke, status, keterangan }));
}

// ---------- unggahan media sosial CONTOH (belum ada sumber terbuka tanpa API berbayar) ----------
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const POSTING: Record<Sentimen, [string, string][]> = {
  positif: [["Program CSR/TJSL", "Alhamdulillah anak kami dapat beasiswa, terima kasih programnya #{tag}"], ["Ekonomi lokal", "Jualan laris di bazar UMKM {desa}, terima kasih semua"], ["Tenaga kerja lokal", "Bangga, sertifikat pelatihan kerja sudah di tangan #{tag}"], ["Infrastruktur", "Akhirnya jalan ke {desa} diperbaiki juga"]],
  netral: [["Program CSR/TJSL", "Ada yang ikut sosialisasi program di kantor desa {desa} tadi?"], ["Tenaga kerja lokal", "Info lowongan kontraktor untuk warga {kec}, cek di kantor desa."], ["Lahan", "Besok ada pertemuan soal lahan di kantor camat {kec}."]],
  negatif: [["Lingkungan", "Debu tiap malam, anak-anak batuk terus. Tolong diperhatikan! #{tag}"], ["Lahan", "Tanah kami dipatok tanpa musyawarah. #{tag}"], ["Tenaga kerja lokal", "Kerja di kampung sendiri saja susah, yang diterima orang luar semua."], ["Infrastruktur", "Jalan berlubang lagi, sudah dua motor jatuh minggu ini. #{tag}"], ["Program CSR/TJSL", "Bantuan cuma untuk orang itu-itu saja, dusun kami tak pernah dapat."]],
};
function sosmedContoh(): Media[] {
  const rnd = mulberry32(20261017);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const out: Media[] = [];
  const start = Date.UTC(2026, 6, 18);
  for (let d = 0; d < 90; d++) {
    const tanggal = new Date(start + d * 86400000).toISOString().slice(0, 10);
    const n = Math.floor(rnd() * 2.4);
    for (let i = 0; i < n; i++) {
      const r = rnd();
      const sentimen: Sentimen = r < 0.35 ? "positif" : r < 0.6 ? "netral" : "negatif";
      const [isu, templat] = pick(POSTING[sentimen]);
      const desaId = pick([RB, BM, KR, SB, KK, PB]);
      const w = rantai(desaId);
      const desa = w[w.length - 1].nama, kec = w[1].nama;
      out.push({ id: "", tanggal, tipe: "sosmed", sumber: pick(["Facebook · grup warga", "Instagram", "X", "TikTok"]), judul: templat.replace("{desa}", desa).replace("{kec}", kec).replace("{tag}", desa.replace(/\s+/g, "")), ringkasan: "", isi: "", sentimen, isu, wilayahId: desaId, presisi: "desa", asal: "Contoh", metodeSentimen: "Manual" });
    }
  }
  return out.sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1)).map((m, i) => ({ ...m, id: `s-${String(i + 1).padStart(3, "0")}` }));
}

export function buatSeed(): Database {
  const k = bacaSumber<Konflik>("konflik");
  const p = bacaSumber<Potensi>("potensi");
  const b = bacaSumber<Media>("berita");
  const media = [...(b?.data ?? []), ...sosmedContoh()].sort((x, y) => (x.tanggal < y.tanggal ? 1 : -1));
  return {
    konflik: k?.data ?? [],
    potensi: p?.data ?? [],
    aktor: aktor(),
    relasi: relasi(),
    media,
    dokumen: dokumenAwal(),
    log: [],
    meta: {
      dimuat: new Date().toISOString(),
      sumber: [...(k?.sumber ?? []), ...(p?.sumber ?? []), ...(b?.sumber ?? [])].filter((s, i, xs) => xs.findIndex((x) => x.nama === s.nama) === i),
    },
  };
}
