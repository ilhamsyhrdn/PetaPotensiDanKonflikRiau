import type { Koleksi } from "./types";
import { SKEMA } from "./skema";
import { getWilayah } from "./wilayah";

type Hasil = { ok: true; data: Record<string, unknown> } | { ok: false; pesan: string };

const nilaiOpsi = (o: string | { nilai: string }) => (typeof o === "string" ? o : o.nilai);
const urlSah = (s: string) => /^https?:\/\/\S+$/i.test(s) || /^\/api\/berkas\/[a-z0-9]+\.(jpg|png|webp|gif)$/.test(s);

/** Validasi & normalisasi isian form sesuai SKEMA, lalu susun ke bentuk data tersimpan. */
export function validasi(koleksi: Koleksi, masuk: Record<string, unknown>): Hasil {
  const out: Record<string, unknown> = {};
  for (const f of SKEMA[koleksi].field) {
    const v = masuk[f.kunci];
    const kosong = v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.filter((x) => x !== null && x !== undefined && x !== "").length === 0);
    if (kosong) {
      if (f.wajib) return { ok: false, pesan: `${f.label} wajib diisi.` };
      out[f.kunci] = f.tipe === "daftar" || f.tipe === "rujukan" || f.tipe === "indikator" ? [] : f.tipe === "angka" || f.tipe === "desimal" ? null : f.tipe === "koordinat" ? undefined : "";
      continue;
    }
    switch (f.tipe) {
      case "teks": out[f.kunci] = String(v).trim().slice(0, 400); break;
      case "panjang": out[f.kunci] = String(v).trim().slice(0, 20000); break;
      case "pilih":
        if (!f.opsi!.map(nilaiOpsi).includes(String(v))) return { ok: false, pesan: `${f.label} tidak valid.` };
        out[f.kunci] = String(v); break;
      case "tanggal":
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return { ok: false, pesan: `${f.label} harus berformat tanggal.` };
        out[f.kunci] = String(v); break;
      case "angka": case "desimal": {
        const n = Number(v);
        if (!Number.isFinite(n) || (f.tipe === "angka" && !Number.isInteger(n)) || n < (f.min ?? -Infinity) || n > (f.max ?? Infinity))
          return { ok: false, pesan: `${f.label} harus angka${f.max !== undefined ? ` ${f.min}–${f.max}` : f.min !== undefined ? ` ≥ ${f.min}` : ""}.` };
        out[f.kunci] = n; break;
      }
      case "daftar":
        out[f.kunci] = (Array.isArray(v) ? v : String(v).split(",")).map((x) => String(x).trim()).filter(Boolean).slice(0, 50); break;
      case "rujukan":
        out[f.kunci] = String(v).split("\n").map((b) => b.trim()).filter(Boolean).slice(0, 30).map((b) => {
          const [nama, url] = b.split("|").map((x) => x.trim());
          const tautan = url ?? (/^https?:\/\//.test(nama) ? nama : undefined);
          return { nama: url ? nama : tautan ? new URL(tautan).hostname : nama, ...(tautan && urlSah(tautan) ? { url: tautan } : {}) };
        }); break;
      case "indikator": {
        const baris = String(v).split("\n").map((b) => b.trim()).filter(Boolean).slice(0, 60);
        const salah = baris.find((b) => !b.includes("|"));
        if (salah) return { ok: false, pesan: `${f.label}: baris "${salah.slice(0, 40)}" belum ada nilainya. Tulis Nama | Nilai.` };
        out[f.kunci] = baris.map((b) => {
          const [nama, ...nilai] = b.split("|");
          return { nama: nama.trim().slice(0, 200), nilai: nilai.join("|").trim().slice(0, 200) };
        });
        break;
      }
      case "url": case "gambar":
        if (!urlSah(String(v).trim())) return { ok: false, pesan: `${f.label} harus berupa tautan http(s) yang valid.` };
        out[f.kunci] = String(v).trim(); break;
      case "wilayah": {
        const w = getWilayah(String(v));
        if (!w || (f.level && !f.level.includes(w.level))) return { ok: false, pesan: `${f.label}: pilih wilayah dari daftar.` };
        out[f.kunci] = w.id; break;
      }
      case "koordinat": {
        const [lon, lat] = (Array.isArray(v) ? v : []).map(Number);
        if (!(lon >= 99 && lon <= 104 && lat >= -2 && lat <= 3.2)) return { ok: false, pesan: "Koordinat harus berada di wilayah Riau (bujur 99–104, lintang −2–3)." };
        out[f.kunci] = [lon, lat]; break;
      }
    }
  }
  return { ok: true, data: susun(koleksi, out) };
}

/** Bentuk akhir per koleksi (struktur bertingkat, turunan seperti tahun & presisi). */
function susun(koleksi: Koleksi, d: Record<string, unknown>): Record<string, unknown> {
  if (koleksi === "dokumen") return { ...d, diperbarui: new Date().toISOString().slice(0, 10) };
  const w = getWilayah(d.wilayahId as string)!;
  const presisi = d.koordinat ? "titik" : w.level;
  const koordinat = d.koordinat ?? w.koordinat;
  if (koleksi === "konflik") {
    const { pemerintah, perusahaan, masyarakat, ...sisa } = d;
    return { ...sisa, tahun: Number(String(d.tanggal).slice(0, 4)), keterlibatan: { pemerintah, perusahaan, masyarakat }, presisi, koordinat };
  }
  if (koleksi === "potensi") {
    const { pemerintah, swasta, masyarakat, ...sisa } = d;
    return { ...sisa, keterlibatan: { pemerintah, swasta, masyarakat }, presisi, koordinat };
  }
  if (koleksi === "aktor") return { ...d, level: w.level === "provinsi" ? "kabupaten" : w.level, koordinat: w.koordinat };
  return { ...d, presisi: w.level, metodeSentimen: "Manual", gambar: d.gambar || null };
}
