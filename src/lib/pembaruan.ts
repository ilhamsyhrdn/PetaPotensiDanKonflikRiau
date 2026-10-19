import "server-only";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { gabungDariSumber } from "./db";

/**
 * Pembaruan data dari sumber terbuka: menjalankan skrip scripts/data/*.mjs di proses terpisah,
 * lalu menggabungkan hasilnya ke database. Bisa dipicu tombol atau jadwal harian (± 06.00 WIB).
 */
export type StatusPembaruan = {
  berjalan: boolean;
  tahap: string;
  langkah: number;
  total: number;
  mulai: string | null;
  selesai: string | null;
  oleh: string | null;
  hasil: { media: number; konflik: number; potensi: number } | null;
  galat: string[];
  terakhir: { berita: string | null; potensi: string | null };
};

const FILE = path.join(process.cwd(), "data", "pembaruan.json");
const MENIT = 60e3, JAM = 60 * MENIT, HARI = 24 * JAM;
const JEDA_MANUAL = 10 * MENIT;
const JEDA_POTENSI = 7 * HARI;
const JAM_JADWAL = 6; // WIB

const LANGKAH = {
  berita: { label: "Mengambil berita terbaru dari Google News & GDELT", args: ["scripts/data/berita.mjs", "--segar"] },
  konflik: { label: "Mencari kejadian konflik di berita", args: ["scripts/data/konflik.mjs", "--segar", "--tanpa-tanahkita"] },
  potensi: { label: "Memperbarui sarana usaha dari OpenStreetMap", args: ["scripts/data/potensi.mjs", "--segar"] },
};

// disimpan di globalThis karena instrumentation dan route handler dimuat sebagai bundel terpisah
const g = globalThis as typeof globalThis & { __pembaruan?: { status?: StatusPembaruan; jadwal?: NodeJS.Timeout } };
const wadah = (g.__pembaruan ??= {});

const kosong = (): StatusPembaruan => ({
  berjalan: false, tahap: "", langkah: 0, total: 0, mulai: null, selesai: null, oleh: null, hasil: null, galat: [], terakhir: { berita: null, potensi: null },
});

function status(): StatusPembaruan {
  if (!wadah.status) {
    try { wadah.status = { ...kosong(), ...JSON.parse(fs.readFileSync(FILE, "utf8")), berjalan: false }; }
    catch { wadah.status = kosong(); }
  }
  return wadah.status!;
}

function simpan() {
  try { fs.writeFileSync(FILE, JSON.stringify(status(), null, 1)); } catch {}
}

/** 06.00 WIB hari ini (dalam ms UTC). */
function jadwalHariIni(kini = Date.now()) {
  const wib = 7 * JAM;
  return Math.floor((kini + wib) / HARI) * HARI - wib + JAM_JADWAL * JAM;
}

function jatuhTempo(kini = Date.now()) {
  const terakhir = Date.parse(status().terakhir.berita ?? "") || 0;
  return kini >= jadwalHariIni(kini) && terakhir < jadwalHariIni(kini);
}

export function infoPembaruan() {
  const s = status();
  const kini = Date.now();
  const berikutnya = jatuhTempo(kini) || kini < jadwalHariIni(kini) ? jadwalHariIni(kini) : jadwalHariIni(kini) + HARI;
  return { ...s, otomatis: !!wadah.jadwal, berikutnya: wadah.jadwal ? new Date(berikutnya).toISOString() : null };
}

function jalankan(args: string[]): Promise<void> {
  return new Promise((selesai, gagal) => {
    const anak = spawn(process.execPath, args, { cwd: process.cwd(), stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    anak.stderr.on("data", (d) => { err = (err + d).slice(-4000); });
    const batas = setTimeout(() => anak.kill(), 30 * MENIT);
    anak.on("error", (e) => { clearTimeout(batas); gagal(e); });
    anak.on("close", (kode) => {
      clearTimeout(batas);
      if (kode === 0) return selesai();
      // laporan crash Node diakhiri jejak tumpukan dan versi Node; ambil baris "...Error: ..." yang sebenarnya
      const baris = err.split("\n").map((b) => b.trim()).filter(Boolean);
      const pesan = baris.find((b) => /^\w*Error\b/.test(b)) ?? baris.filter((b) => !/^(at |Node\.js v)/.test(b)).at(-1);
      gagal(new Error(pesan?.slice(0, 300) || `berhenti dengan kode ${kode}`));
    });
  });
}

export function mulaiPembaruan(oleh: string, { paksa = false } = {}): { ok: true } | { ok: false; pesan: string } {
  const s = status();
  if (s.berjalan) return { ok: false, pesan: "Pembaruan sedang berjalan." };
  const sejak = Date.now() - (Date.parse(s.selesai ?? "") || 0);
  if (!paksa && sejak < JEDA_MANUAL) return { ok: false, pesan: `Data baru saja diperbarui. Coba lagi ${Math.ceil((JEDA_MANUAL - sejak) / MENIT)} menit lagi.` };

  const potensi = Date.now() - (Date.parse(s.terakhir.potensi ?? "") || 0) >= JEDA_POTENSI;
  const urutan = [LANGKAH.berita, LANGKAH.konflik, ...(potensi ? [LANGKAH.potensi] : [])];
  Object.assign(s, { berjalan: true, langkah: 0, total: urutan.length + 1, tahap: urutan[0].label, mulai: new Date().toISOString(), selesai: null, oleh, hasil: null, galat: [] });
  simpan();

  void (async () => {
    let berhasil = 0;
    for (const [i, l] of urutan.entries()) {
      Object.assign(s, { langkah: i, tahap: l.label });
      simpan();
      try {
        await jalankan(l.args);
        berhasil++;
        if (l === LANGKAH.potensi) s.terakhir.potensi = new Date().toISOString();
      } catch (e) {
        s.galat.push(`${l.label}: ${(e as Error).message}`);
      }
    }
    Object.assign(s, { langkah: urutan.length, tahap: "Menggabungkan data baru" });
    simpan();
    try { if (berhasil) s.hasil = await gabungDariSumber(oleh); }
    catch (e) { s.galat.push(`Menggabungkan data: ${(e as Error).message}`); }
    // dicatat walau gagal, supaya jadwal tidak mencoba terus-menerus; tombol tetap bisa dipakai
    s.terakhir.berita = new Date().toISOString();
    Object.assign(s, { berjalan: false, langkah: s.total, tahap: "Selesai", selesai: new Date().toISOString() });
    simpan();
  })();
  return { ok: true };
}

/** Dipanggil sekali saat server produksi menyala (src/instrumentation.ts). */
export function jadwalkanPembaruan() {
  if (wadah.jadwal || process.env.NODE_ENV !== "production" || process.env.PEMBARUAN_OTOMATIS === "0") return;
  const cek = () => { if (!status().berjalan && jatuhTempo()) mulaiPembaruan("otomatis", { paksa: true }); };
  wadah.jadwal = setInterval(cek, 15 * MENIT);
  setTimeout(cek, 2 * MENIT);
}
