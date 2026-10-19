import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Database, Koleksi } from "./types";
import { buatSeed } from "./seed";
import { dokumenAwal } from "./baseline";

/**
 * Penyimpanan sementara berbasis file JSON (data/db.json).
 * Nanti diganti PostgreSQL + PostGIS; fungsi di sini jadi satu-satunya titik yang perlu diubah.
 *
 * Isi berkas disimpan di memori dan hanya dibaca ulang bila berkas berubah (mtime), karena berkasnya
 * beberapa MB. Pembacaan sinkron juga mencegah React (mode dev) menyalin isi berkas ke halaman sebagai info debug.
 */
const FILE = path.join(process.cwd(), "data", "db.json");

let cache: { mtime: number; db: Database } | null = null;
let antrean: Promise<unknown> = Promise.resolve();

export async function bacaDb(): Promise<Database> {
  try {
    const mtime = fs.statSync(FILE).mtimeMs;
    if (!cache || cache.mtime !== mtime) {
      const db = JSON.parse(fs.readFileSync(FILE, "utf8")) as Database;
      db.dokumen ??= dokumenAwal(); // berkas dari versi sebelum ada daftar dokumen baseline
      cache = { mtime, db };
    }
    return cache.db;
  } catch {
    if (cache) return cache.db;
    const seed = buatSeed();
    cache = { mtime: 0, db: seed };
    // hosting dengan disk read-only: halaman tetap tampil, hanya penyimpanan yang gagal
    try { tulisDb(seed); } catch {}
    return seed;
  }
}

function tulisDb(db: Database) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db), "utf8");
  fs.renameSync(tmp, FILE);
  cache = { mtime: fs.statSync(FILE).mtimeMs, db };
}

/** Ubah data secara berurutan supaya dua simpanan bersamaan tidak saling menimpa. */
export function ubahDb<T>(fn: (db: Database) => T): Promise<T> {
  const job = antrean.then(async () => {
    const db = structuredClone(await bacaDb());
    const hasil = fn(db);
    tulisDb(db);
    return hasil;
  });
  antrean = job.catch(() => undefined);
  return job;
}

export async function resetDb() {
  // dokumen baseline diisi manual, bukan dari sumber terbuka, jadi tidak ikut dikembalikan
  await ubahDb((db) => Object.assign(db, buatSeed(), { dokumen: db.dokumen, dihapus: [] }));
}

/**
 * Gabungkan hasil skrip data terbaru (data/sumber) ke database tanpa menimpa yang sudah ada:
 * data baru ditambahkan, data lama (termasuk yang sudah diedit) dibiarkan, data yang pernah dihapus tidak dimunculkan lagi.
 */
export async function gabungDariSumber(oleh: string) {
  const seed = buatSeed();
  return ubahDb((db) => {
    const dihapus = new Set(db.dihapus ?? []);
    const tambah = <T extends { id: string; tanggal?: string }>(lama: T[], baru: T[]) => {
      const ada = new Set(lama.map((x) => x.id));
      const masuk = baru.filter((x) => !ada.has(x.id) && !dihapus.has(x.id));
      lama.push(...masuk);
      lama.sort((a, b) => (b.tanggal ?? "").localeCompare(a.tanggal ?? ""));
      return masuk.length;
    };
    const n = {
      media: tambah(db.media, seed.media.filter((m) => m.asal !== "Contoh")),
      konflik: tambah(db.konflik, seed.konflik),
      potensi: tambah(db.potensi, seed.potensi),
    };
    db.meta = { sumber: seed.meta?.sumber ?? db.meta?.sumber ?? [], dimuat: new Date().toISOString() };
    db.log.unshift({ waktu: new Date().toISOString(), oleh, aksi: `Memperbarui data: +${n.media} berita, +${n.konflik} konflik, +${n.potensi} potensi` });
    return n;
  });
}

export const KOLEKSI: Koleksi[] = ["konflik", "potensi", "aktor", "media", "dokumen"];
