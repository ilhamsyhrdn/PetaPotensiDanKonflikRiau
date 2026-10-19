import type { Database } from "./types";
import type { Ringkasan } from "./ringkasan";
import { KATEGORI_POTENSI, kategoriPotensi, konflikAktif } from "./kategori";
import { geserHari, hariIni, persen, ringkasSentimen, tanggal } from "./format";
import { DESA_STUDI, KABUPATEN, dalamWilayah, labelWilayah, namaLengkap, rantai } from "./wilayah";
import { deteksiLetupan } from "./letupan";

const urut = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]);
const hitung = <T,>(xs: T[], f: (x: T) => string) => xs.reduce<Record<string, number>>((n, x) => ((n[f(x)] = (n[f(x)] ?? 0) + 1), n), {});

export type Ikhtisar = {
  angka: { label: string; nilai: string; ket: string; warna: string }[];
  temuan: string[];
  konflik: { perSektor: [string, number][]; perJenis: [string, number][]; perStatus: [string, number][]; perKab: [string, number][]; terbaru: { judul: string; wilayah: string; tanggal: string; sektor: string; status: string }[] };
  potensi: { perKat: [string, number][]; perKab: [string, number][]; perJenis: [string, number][]; sorotan: { nama: string; jenis: string; wilayah: string; kategori: string }[] };
  media: { r30: { positif: number; netral: number; negatif: number; total: number }; selisihNegatif: number; isuNeg: [string, number][]; isuPos: [string, number][]; sumber: [string, number][]; letupan: { teks: string; sentimen: string }[]; negatifTerbaru: { judul: string; sumber: string; tanggal: string; wilayah: string }[] };
  studi: { desa: string; kec: string; kab: string; konflikKec: number; potensiKec: number; berita30: number }[];
};

/** Rangkuman otomatis untuk Mode Presentasi: angka kunci, temuan utama, dan rincian per tema. */
export function buatIkhtisar(db: Database, r: Ringkasan): Ikhtisar {
  const hari = hariIni(), b30 = geserHari(hari, -30), b60 = geserHari(hari, -60);
  const berita = db.media.filter((m) => m.tipe === "berita");
  const r30 = ringkasSentimen(berita.filter((m) => m.tanggal >= b30));
  const rLalu = ringkasSentimen(berita.filter((m) => m.tanggal >= b60 && m.tanggal < b30));
  const neg = r30.total ? r30.negatif / r30.total : 0;
  const selisih = Math.round((neg - (rLalu.total ? rLalu.negatif / rLalu.total : 0)) * 100);
  const aktif = db.konflik.filter((k) => konflikAktif(k.status));

  // "Lainnya" = belum terklasifikasi; ditaruh paling akhir dan tidak dipakai sebagai sektor dominan
  const perSektorAsli = urut(hitung(db.konflik, (k) => k.sektor));
  const perSektor: [string, number][] = [...perSektorAsli.filter(([s]) => s !== "Lainnya"), ...perSektorAsli.filter(([s]) => s === "Lainnya").map(([, n]) => ["Belum terklasifikasi", n] as [string, number])];
  const perJenisKonflik = urut(hitung(db.konflik, (k) => k.jenis)).slice(0, 5);
  const perStatus = urut(hitung(db.konflik, (k) => k.status));
  const perKabKonflik = KABUPATEN.map((k) => [namaLengkap(k), r[k.id]?.konflik ?? 0] as [string, number]).sort((a, b) => b[1] - a[1]);
  const perKat = urut(hitung(db.potensi, (p) => p.kategori));
  const perKabPotensi = KABUPATEN.map((k) => [namaLengkap(k), r[k.id]?.potensi ?? 0] as [string, number]).sort((a, b) => b[1] - a[1]);
  const perJenis = urut(hitung(db.potensi, (p) => p.subkategori)).slice(0, 8);
  const isuNeg = urut(hitung(berita.filter((m) => m.tanggal >= b30 && m.sentimen === "negatif"), (m) => m.isu)).slice(0, 4);
  const isuPos = urut(hitung(berita.filter((m) => m.tanggal >= b30 && m.sentimen === "positif"), (m) => m.isu)).slice(0, 4);
  const sumber = urut(hitung(berita.filter((m) => m.tanggal >= b30), (m) => m.sumber)).slice(0, 5);
  const letupanMentah = [...deteksiLetupan(berita, "negatif", geserHari(hari, -90), hari), ...deteksiLetupan(berita, "positif", geserHari(hari, -90), hari)]
    .sort((a, b) => (a.sampai < b.sampai ? 1 : -1)).slice(0, 3);
  const letupan = letupanMentah
    .map((l) => ({ sentimen: l.sentimen, teks: `${l.isu} · ${labelWilayah(l.wilayahId)} · ${tanggal(l.dari)}${l.dari !== l.sampai ? "–" + tanggal(l.sampai) : ""} (${l.jumlah} berita)` }));

  // kabupaten tempat kategori potensi terbesar paling banyak
  const katUtama = perKat[0]?.[0];
  const kabKatUtama = katUtama ? KABUPATEN.map((k) => [namaLengkap(k), r[k.id]?.potensiKat[katUtama] ?? 0] as [string, number]).sort((a, b) => b[1] - a[1])[0] : undefined;

  const temuan = [
    db.konflik.length ? `Ada ${db.konflik.length} kasus konflik di Riau. ${aktif.length} masih berjalan, dan ${db.konflik.filter((k) => k.status === "Belum ditangani").length} di antaranya belum ditangani sama sekali.` : "",
    perSektor[0] && perSektor[0][0] !== "Belum terklasifikasi" ? `Sektor ${perSektor[0][0].toLowerCase()} paling sering memicu konflik (${perSektor[0][1]} kasus)${perJenisKonflik[0] ? `. Bentuknya ${perJenisKonflik[0][1] > db.konflik.length / 2 ? "kebanyakan" : "paling sering"} ${perJenisKonflik[0][0].toLowerCase()}` : ""}.` : "",
    perKabKonflik[0]?.[1] ? `Kasus paling banyak ada di ${perKabKonflik[0][0]} (${perKabKonflik[0][1]}), disusul ${perKabKonflik[1][0]} (${perKabKonflik[1][1]}).` : "",
    db.potensi.length ? `Ada ${db.potensi.length.toLocaleString("id-ID")} titik potensi ekonomi. Yang paling banyak ${kategoriPotensi(perKat[0][0]).nama.toLowerCase()} (${perKat[0][1].toLocaleString("id-ID")})${kabKatUtama ? `, terutama di ${kabKatUtama[0]}` : ""}.` : "",
    r30.total ? `Bulan ini ada ${r30.total} berita online, ${persen(neg)} di antaranya bernada negatif${selisih ? ` (${selisih > 0 ? "naik" : "turun"} ${Math.abs(selisih)} poin dari bulan lalu)` : ""}.${isuNeg.find(([i]) => i !== "Lainnya") ? ` Keluhan paling banyak soal ${isuNeg.find(([i]) => i !== "Lainnya")![0].toLowerCase()}.` : ""}` : "",
    letupanMentah[0] ? `Lonjakan berita terakhir: ${letupanMentah[0].jumlah} berita ${letupanMentah[0].sentimen} soal ${letupanMentah[0].isu.toLowerCase()} pada ${tanggal(letupanMentah[0].dari)}${letupanMentah[0].dari !== letupanMentah[0].sampai ? `–${tanggal(letupanMentah[0].sampai)}` : ""}.` : "",
  ].filter(Boolean);

  const studi = DESA_STUDI.map((d) => {
    const [kab, kec] = rantai(d.id);
    return {
      desa: d.nama, kec: kec?.nama ?? "", kab: kab?.nama ?? "",
      konflikKec: kec ? db.konflik.filter((k) => dalamWilayah(k.wilayahId, kec.id)).length : 0,
      potensiKec: kec ? db.potensi.filter((p) => dalamWilayah(p.wilayahId, kec.id)).length : 0,
      berita30: kab ? berita.filter((m) => m.tanggal >= b30 && dalamWilayah(m.wilayahId, kab.id)).length : 0,
    };
  });
  const studiKonflik = studi.reduce((s, x) => s + x.konflikKec, 0);
  temuan.push(`Di kecamatan tempat enam desa studi berada, ada ${studiKonflik} kasus konflik dan ${studi.reduce((s, x) => s + x.potensiKec, 0).toLocaleString("id-ID")} titik potensi ekonomi.`);

  return {
    angka: [
      { label: "Titik konflik", nilai: String(db.konflik.length), ket: `${aktif.length} aktif`, warna: "#e8590c" },
      { label: "Belum ditangani", nilai: String(db.konflik.filter((k) => k.status === "Belum ditangani").length), ket: "status penanganan", warna: "#c92a2a" },
      { label: "Titik potensi", nilai: db.potensi.length.toLocaleString("id-ID"), ket: `${perKat.length} lapangan usaha`, warna: "#4dabf7" },
      { label: "Berita 30 hari", nilai: String(r30.total), ket: `${rLalu.total} periode sebelumnya`, warna: "#ffffff" },
      { label: "Berita negatif", nilai: persen(neg), ket: `${selisih > 0 ? "▲" : selisih < 0 ? "▼" : "■"} ${Math.abs(selisih)} poin`, warna: "#ff8787" },
    ],
    temuan,
    konflik: {
      perSektor, perJenis: perJenisKonflik, perStatus, perKab: perKabKonflik.slice(0, 6),
      terbaru: [...db.konflik].sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1)).slice(0, 4).map((k) => ({ judul: k.judul, wilayah: labelWilayah(k.wilayahId), tanggal: tanggal(k.tanggal), sektor: k.sektor, status: k.status })),
    },
    potensi: { perKat: perKat.map(([k, n]) => [k, n]), perKab: perKabPotensi.slice(0, 6), perJenis, sorotan: sorotanPotensi(db) },
    media: {
      r30, selisihNegatif: selisih, isuNeg, isuPos, sumber, letupan,
      negatifTerbaru: berita.filter((m) => m.sentimen === "negatif").slice(0, 3).map((m) => ({ judul: m.judul, sumber: m.sumber, tanggal: tanggal(m.tanggal), wilayah: labelWilayah(m.wilayahId) })),
    },
    studi,
  };
}

export const NAMA_KATEGORI = Object.fromEntries(KATEGORI_POTENSI.map((k) => [k.id, k.nama]));

// Sarana ekonomi berskala besar untuk disorot di presentasi, satu per jenis menurut urutan prioritas
const PRIORITAS_SARANA = ["Kilang minyak", "Industri pulp & kertas", "PLTA (tenaga air)", "PLTU batu bara", "Pembangkit listrik tenaga gas", "Bandar udara", "Kawasan industri", "Pelabuhan khusus (industri)", "Pabrik kelapa sawit", "Terminal/depot BBM & LPG"];
export function sorotanPotensi(db: Pick<Database, "potensi">, maks = 6) {
  return PRIORITAS_SARANA.map((j) => db.potensi.find((p) => p.subkategori === j && !/tanpa nama|^(pabrik|pelabuhan|pembangkit).* di /i.test(p.nama)))
    .filter((p): p is NonNullable<typeof p> => !!p).slice(0, maks)
    .map((p) => ({ id: p.id, nama: p.nama, jenis: p.subkategori, wilayah: labelWilayah(p.wilayahId), kategori: p.kategori }));
}
