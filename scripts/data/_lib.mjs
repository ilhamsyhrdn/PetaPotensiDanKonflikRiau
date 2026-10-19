// Utilitas bersama untuk skrip pengambil data terbuka.
// Semua unduhan mentah disimpan di scripts/data/.cache supaya skrip bisa diulang tanpa membebani server sumber.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const CACHE = path.join(AKAR, "scripts/data/.cache");
export const SUMBER = path.join(AKAR, "data/sumber");
export const GEO = path.join(AKAR, "public/geo");
for (const d of [CACHE, SUMBER, GEO]) fs.mkdirSync(d, { recursive: true });

const UA = "ProjectDiva-prototype/0.1 (dashboard riset sosial)";
export const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

/** Unduh teks dengan cache berkas. `kunci` = nama berkas cache; `segar` = abaikan cache. */
export async function ambil(url, { kunci, segar = false, opsi = {}, coba = 3, jeda = 4000 } = {}) {
  const file = path.join(CACHE, kunci ?? crypto.createHash("md5").update(url + JSON.stringify(opsi.body ?? "")).digest("hex"));
  if (!segar && fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  let galat;
  for (let i = 0; i < coba; i++) {
    try {
      const res = await fetch(url, { ...opsi, headers: { "User-Agent": UA, ...(opsi.headers ?? {}) } });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url.slice(0, 120)}`);
      const teks = await res.text();
      fs.writeFileSync(file, teks);
      return teks;
    } catch (e) {
      galat = e;
      await tidur(jeda * (i + 1));
    }
  }
  throw galat;
}

export async function overpass(query, kunci) {
  const titik = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
  let galat;
  for (const ep of titik) {
    try {
      return JSON.parse(await ambil(ep, { kunci, opsi: { method: "POST", body: new URLSearchParams({ data: query }) }, coba: 2, jeda: 8000 }));
    } catch (e) { galat = e; }
  }
  throw galat;
}

export const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
export const bulat = (g) => JSON.parse(JSON.stringify(g, (k, v) => (typeof v === "number" ? Math.round(v * 1e5) / 1e5 : v)));
export const hash = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 10);

// ---------- teks judul (dipakai skrip konflik & berita) ----------
const ENTITAS = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', laquo: "«", raquo: "»" };
const dekodeEntitas = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITAS[e.toLowerCase()] ?? m));
/** Rapikan karakter: entitas HTML sisa, spasi khusus, kutip melengkung → lurus, "?"/"�" di tengah kata (apostrof rusak) → "'". */
export function rapikanTeks(s) {
  return dekodeEntitas(dekodeEntitas(String(s ?? "")))
    .replace(/[     ]/g, " ").replace(/[​-‍⁠﻿­]/g, "")
    .replace(/[‘’‚‛′`´]/g, "'").replace(/[“”„‟″]/g, '"')
    .replace(/(\p{L})[?�](\p{L})/gu, "$1'$2").replace(/�/g, "")
    .replace(/([,;])(?=\p{Lu})/gu, "$1 ").replace(/\s+/g, " ").trim();
}
// rubrik/kanal yang ditempelkan media di ujung judul ("… - Energi", "… - Penyaluran", "… | BERUT")
const RUBRIK = new Set(("energi penyaluran ekonomi bisnis ekbis nasional daerah regional hukum hukrim kriminal politik olahraga sport otomotif teknologi tekno lifestyle " +
  "news berita opini foto video peristiwa pendidikan kesehatan lingkungan sawit migas advertorial parlementaria galeri nusantara internasional dunia edukasi " +
  "hiburan entertainment pemerintahan kesra humaniora otonomi inforial pariwara viral trending headline utama terkini metropolis metro " +
  "tanah ulayat berita utama berita terkini berita daerah berita riau info riau breaking news").split(" "));
const RUBRIK_FRASA = new Set(["tanah ulayat", "berita utama", "berita terkini", "berita daerah", "berita riau", "info riau", "breaking news", "hukum kriminal", "gaya hidup"]);
const MIRIP_MEDIA = /\b(news|online|pos|post|times|today|tv|media|channel|portal|warta|kabar|info|detik|tribun|antara|kompas|okezone|liputan|sindo|jpnn|kumparan|republika|tempo|viva|suara|merdeka|idn|rri|haluan|cakaplah|goriau|riauonline|tipikor|nawacita|genpi|konteks)\b|\.(com|id|co|net|org|news|tv|my\.id)\b/i;
const sederhana = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\.(com|co\.id|co|id|net|org|news|tv)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Bersihkan judul berita: rapikan karakter, buang awalan format ("FOTO - ", "Foto Artikel :", "Video Viral") dan ekor
 * nama media/rubrik (" - Haluan Riau", " - Energi", " | #Tagar", " » Berita …", " Halaman 1") tanpa memotong " - " yang bermakna
 * (nama ruas "Sontang - Duri", tanggal "19 - 25 Agustus"). `tempat(s)` → true bila s nama wilayah (dari gazetir).
 */
export function bersihJudul(judul, { media = "", tempat = () => false } = {}) {
  let j = rapikanTeks(judul);
  for (let i = 0; i < 3; i++) {
    const awal = j;
    j = j.replace(/^(foto artikel|foto|video|infografis|galeri|breaking news|berita foto)\s*[:\-–—|!]+\s*/i, "").replace(/^video viral\b\s*[:\-–—]?\s*/i, "");
    if (j === awal) break;
  }
  const m = sederhana(media);
  for (let i = 0; i < 4; i++) {
    const awal = j;
    j = j.replace(/\s+Halaman \d+$/i, "").replace(/\s+Berita \w+(?: \w+)? Terkini(?: Online)?$/i, "");
    // " | apa pun" / " » apa pun" di ujung judul hampir selalu nama situs/kanal/tagar
    j = j.replace(/^(.{20,}?)\s+[|»]\s+[^|»]{1,60}$/, "$1");
    const ekor = j.match(/^(.{20,}?)\s+[-–—]\s+((?:(?!\s[-–—]\s).){1,60})$/);
    if (ekor) {
      const x = ekor[2].trim(), sx = sederhana(x);
      const kata = sx.split(" ").filter(Boolean);
      const rapat = (s) => s.replace(/ /g, ""); // "Sapa Nusa" = "Sapanusa"
      const samaMedia = m && sx && (rapat(sx) === rapat(m) || sx.startsWith(m) || m.startsWith(sx) || rapat(sx).startsWith(rapat(m)) || (kata.length <= 4 && kata.filter((k) => k.length > 3).some((k) => m.split(" ").includes(k)) && !tempat(x)));
      const rubrik = RUBRIK.has(sx) || RUBRIK_FRASA.has(sx);
      // "… - detikFinance - Berita Ekonomi Bisnis, dan Investasi Hari Ini"
      const situs = (MIRIP_MEDIA.test(x) && !tempat(x) && kata.length <= 5) || (/^berita /.test(sx) && kata.length <= 9);
      // satu kata tanpa angka yang bukan nama tempat ("… - Penyaluran") = tag kanal; nama tempat dibiarkan ("Bangko Pusako - Kubu")
      const tag = kata.length === 1 && !/\d/.test(x) && !tempat(x) && !tempat(ekor[1].split(/\s+/).pop());
      if (samaMedia || rubrik || situs || tag) j = ekor[1];
    }
    if (j === awal) break;
  }
  return j.replace(/\s*\.(?!\.)$/, "").replace(/\s+/g, " ").trim();
}

export function simpan(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof data === "string" ? data : JSON.stringify(data));
  console.log("  ditulis", path.relative(AKAR, file), Math.round(fs.statSync(file).size / 1024) + " KB");
}
export const baca = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
export const hariIni = () => new Date().toISOString().slice(0, 10);
