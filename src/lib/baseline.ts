import type { Dokumen, StatusDokumen } from "./types";
import { DESA_STUDI, KAB_STUDI, getWilayah, namaLengkap } from "./wilayah";

export const JENIS_DOKUMEN = ["RPJMD", "Kabupaten Dalam Angka", "Kecamatan Dalam Angka", "Renstra OPD", "Lainnya"] as const;

export const STATUS_DOKUMEN: { nama: StatusDokumen; warna: string }[] = [
  { nama: "Belum dicari", warna: "#868e96" },
  { nama: "Sedang dicari", warna: "#e8a100" },
  { nama: "Tidak tersedia online", warna: "#e03131" },
  { nama: "Sudah diunduh", warna: "#1971c2" },
  { nama: "Sudah diinput", warna: "#2f9e44" },
];
export const warnaStatusDokumen = (s: string) => STATUS_DOKUMEN.find((x) => x.nama === s)?.warna ?? "#868e96";
export const terkumpul = (d: Pick<Dokumen, "status">) => d.status === "Sudah diunduh" || d.status === "Sudah diinput";

export const TEMPAT_CARI: Record<string, string> = {
  RPJMD: "Situs Bappeda atau JDIH kabupaten. RPJMD ditetapkan lewat Perda, jadi biasanya ada di daftar Perda.",
  "Kabupaten Dalam Angka": "Situs BPS kabupaten, menu Publikasi. Terbit tiap tahun sekitar Februari–Maret.",
  "Kecamatan Dalam Angka": "Situs BPS kabupaten, menu Publikasi, cari dengan nama kecamatan.",
  "Renstra OPD": "Situs dinas terkait, PPID, atau JDIH kabupaten. Nama dinas bisa berbeda di tiap kabupaten.",
};

/** Dinas yang paling dekat dengan isu konflik lahan, potensi ekonomi, dan desa. */
const OPD_TERKAIT = [
  { kode: "dlh", nama: "Dinas Lingkungan Hidup" },
  { kode: "bun", nama: "Dinas Pertanian / Perkebunan" },
  { kode: "pmd", nama: "Dinas Pemberdayaan Masyarakat dan Desa" },
  { kode: "kop", nama: "Dinas Koperasi dan UKM" },
];

export const KEC_STUDI = [...new Set(DESA_STUDI.map((d) => d.induk!))].map((id) => getWilayah(id)!);

/** Daftar periksa awal: dokumen yang perlu dikumpulkan untuk tiap kabupaten dan kecamatan studi. */
export function dokumenAwal(): Dokumen[] {
  const d = (id: string, jenis: string, judul: string, wilayahId: string, penerbit: string): Dokumen =>
    ({ id, jenis, judul, wilayahId, penerbit, tahun: "", status: "Belum dicari", url: "", indikator: [], catatan: "", diperbarui: "" });
  return [
    ...KAB_STUDI.flatMap((k) => [
      d(`d-rpjmd-${k.id}`, "RPJMD", `RPJMD ${namaLengkap(k)}`, k.id, `Bappeda ${namaLengkap(k)}`),
      d(`d-kda-${k.id}`, "Kabupaten Dalam Angka", `Kabupaten ${k.nama} Dalam Angka`, k.id, `BPS ${namaLengkap(k)}`),
      ...OPD_TERKAIT.map((o) => d(`d-renstra-${o.kode}-${k.id}`, "Renstra OPD", `Renstra ${o.nama}`, k.id, `${o.nama} ${namaLengkap(k)}`)),
    ]),
    ...KEC_STUDI.map((c) => d(`d-kecda-${c.id}`, "Kecamatan Dalam Angka", `Kecamatan ${c.nama} Dalam Angka`, c.id, `BPS ${namaLengkap(getWilayah(c.induk)!)}`)),
  ];
}
