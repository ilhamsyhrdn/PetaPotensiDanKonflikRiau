import type { Konflik, Potensi } from "./types";
import type { TitikPeta } from "./peta";
import type { OpsiFilter } from "@/components/PetaTematik";
import { KATEGORI_POTENSI, SEKTOR_KONFLIK, STATUS_KONFLIK, kategoriPotensi, warnaSektorKonflik, warnaStatus } from "./kategori";
import { labelAsal, potong } from "./format";

export const titikKonflik = (k: Konflik): TitikPeta => ({
  id: k.id, judul: k.judul, kat: k.sektor, warna: warnaSektorKonflik(k.sektor), sub: k.sektor, status: k.status, warnaStatus: warnaStatus(k.status),
  tanggal: k.tanggal, tahun: k.tahun, wilayahId: k.wilayahId, koordinat: k.koordinat, asal: labelAsal(k.asal), ket: potong(k.ringkasan || k.narasi, 170),
});

export const titikPotensi = (p: Potensi): TitikPeta => ({
  id: p.id, judul: p.nama, kat: p.kategori, warna: kategoriPotensi(p.kategori).warna, sub: p.subkategori || kategoriPotensi(p.kategori).nama,
  status: p.status, wilayahId: p.wilayahId, koordinat: p.koordinat, asal: p.asal === "OSM" ? "OpenStreetMap" : p.asal,
  ket: [p.komoditas.length ? "Komoditas: " + p.komoditas.join(", ") : "", p.pengelola ? "Pengelola: " + p.pengelola : ""].filter(Boolean).join(" · "),
});

export function opsiKonflik(list: Konflik[]): OpsiFilter {
  const tahun = list.map((k) => k.tahun).filter(Boolean);
  return {
    kategori: SEKTOR_KONFLIK.map((s) => ({ nama: s.nama, label: s.nama === "Lainnya" ? "Belum terklasifikasi" : s.nama, warna: s.warna })),
    status: STATUS_KONFLIK.map((s) => ({ nama: s.nama, warna: s.warna })),
    asal: [...new Set(list.map((k) => labelAsal(k.asal)))].sort(),
    tahun: tahun.length ? [Math.min(...tahun), Math.max(...tahun)] : undefined,
  };
}

export function opsiPotensi(list: Potensi[]): OpsiFilter {
  return {
    kategori: KATEGORI_POTENSI.map((k) => ({ nama: k.id, label: `${k.nama} (${k.kbli})`, warna: k.warna })),
    status: [],
    asal: [...new Set(list.map((p) => (p.asal === "OSM" ? "OpenStreetMap" : p.asal)))].sort(),
  };
}
