// Batas wilayah seluruh Provinsi Riau dari OpenStreetMap (© OpenStreetMap contributors, ODbL).
// Hasil: public/geo/*.geojson (peta) dan src/data/wilayah.json (hierarki Kab → Kec → Desa untuk aplikasi & skrip lain).
// Jalankan: node scripts/data/wilayah.mjs
import path from "node:path";
import osmtogeojson from "osmtogeojson";
import mapshaper from "mapshaper";
import polylabel from "polylabel";
import { area } from "@turf/area";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import { pointOnFeature } from "@turf/point-on-feature";
import { AKAR, GEO, ambil, overpass, slug, bulat, simpan, tidur } from "./_lib.mjs";

// relasi OSM admin_level 5 di Riau, warna dasar (hue) dipilih agar kabupaten bertetangga mudah dibedakan
const KAB = [
  { nama: "Rokan Hilir", rel: 7830591, jenis: "Kabupaten", hue: 38 },
  { nama: "Rokan Hulu", rel: 7830594, jenis: "Kabupaten", hue: 128 },
  { nama: "Dumai", rel: 7830590, jenis: "Kota", hue: 0 },
  { nama: "Bengkalis", rel: 7834374, jenis: "Kabupaten", hue: 188 },
  { nama: "Kepulauan Meranti", rel: 7833398, jenis: "Kabupaten", hue: 56 },
  { nama: "Siak", rel: 7833359, jenis: "Kabupaten", hue: 330 },
  { nama: "Kampar", rel: 7830592, jenis: "Kabupaten", hue: 262 },
  { nama: "Pekanbaru", rel: 16563796, jenis: "Kota", hue: 18 },
  { nama: "Pelalawan", rel: 7833465, jenis: "Kabupaten", hue: 160 },
  { nama: "Kuantan Singingi", rel: 7830593, jenis: "Kabupaten", hue: 300 },
  { nama: "Indragiri Hulu", rel: 7830589, jenis: "Kabupaten", hue: 88 },
  { nama: "Indragiri Hilir", rel: 7830704, jenis: "Kabupaten", hue: 214 },
];
// 6 desa studi SIM (nama persis seperti di OSM) dan kabupatennya
const DESA_STUDI = [["Rantau Bais", "Rokan Hilir"], ["Balai Makam", "Bengkalis"], ["Kijang Rejo", "Kampar"], ["Sebangar", "Bengkalis"], ["Kandis Kota", "Siak"], ["Perawang Barat", "Siak"]];
const KAB_STUDI = new Set(DESA_STUDI.map((d) => d[1]));

function hsl(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}
const titikLabel = (f) => {
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const besar = polys.map((p) => ({ p, a: area({ type: "Polygon", coordinates: p }) })).sort((x, y) => y.a - x.a)[0].p;
  return polylabel(besar, 0.0005).map((v) => Math.round(v * 1e5) / 1e5);
};

console.log("1/4 Kabupaten/kota (Nominatim)");
const kab = [];
for (const k of KAB) {
  const q = new URLSearchParams({ q: `${k.jenis} ${k.nama}, Riau`, format: "jsonv2", limit: "3", polygon_geojson: "1", polygon_threshold: "0.0006", countrycodes: "id" });
  const hasil = JSON.parse(await ambil(`https://nominatim.openstreetmap.org/search?${q}`, { kunci: `nominatim-kab-${slug(k.nama)}.json` }));
  const hit = hasil.find((d) => d.osm_id === k.rel) ?? hasil.find((d) => /Polygon/.test(d.geojson?.type));
  if (!hit) throw new Error("poligon kabupaten tidak ditemukan: " + k.nama);
  kab.push({ type: "Feature", properties: { id: "kab-" + slug(k.nama), nama: k.nama, jenis: k.jenis, studi: KAB_STUDI.has(k.nama), warna: hsl(k.hue, 82, 55) }, geometry: bulat(hit.geojson) });
  await tidur(1100);
}

console.log("2/4 Kecamatan per kabupaten (Overpass)");
// Query per kabupaten juga mengembalikan kecamatan tetangga (berbagi batas). Kumpulkan semua dulu,
// lalu tiap kecamatan dimasukkan ke kabupaten yang memuat titik tengahnya; bila tidak ada
// (poligon kabupaten disederhanakan sehingga tepinya terpotong), pilih kabupaten terdekat di antara yang mengembalikannya.
const calon = new Map();
for (const k of KAB) {
  const raw = await overpass(`[out:json][timeout:180];rel(${k.rel});map_to_area->.k;relation["boundary"="administrative"]["admin_level"="6"](area.k);out geom;`, `overpass-kec-${slug(k.nama)}.json`);
  for (const f of osmtogeojson(raw).features) {
    const t = f.properties.tags ?? f.properties;
    if (!/Polygon/.test(f.geometry.type) || t.admin_level !== "6" || !t.name) continue;
    const c = calon.get(f.id) ?? { f, nama: t.name.replace(/^Kecamatan\s+/i, "").trim(), dari: [] };
    c.dari.push(k.nama);
    calon.set(f.id, c);
  }
  await tidur(300);
}
const jarak2 = ([x1, y1], [x2, y2]) => (x1 - x2) ** 2 + (y1 - y2) ** 2;
const kecPerKab = new Map(KAB.map((k) => [k.nama, []]));
for (const { f, nama, dari } of calon.values()) {
  const p = pointOnFeature(f);
  // Poligon kabupaten pesisir (mis. Kepulauan Meranti) memuat wilayah laut yang tumpang-tindih dengan tetangganya,
  // jadi satu titik tengah tidak cukup. Sampel ±60 titik batas kecamatan: kabupaten yang memuat paling banyak sampel menang.
  const titik = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates).flat(1).flat(1);
  const sampel = titik.filter((_, i) => i % Math.max(1, Math.floor(titik.length / 60)) === 0);
  const kandidat = new Set([...dari, ...kab.filter((x) => booleanPointInPolygon(p, x)).map((x) => x.properties.nama)]);
  const pemilik = [...kandidat].map((n) => {
    const kf = kab.find((x) => x.properties.nama === n);
    return { n, skor: sampel.filter((c) => booleanPointInPolygon({ type: "Point", coordinates: c }, kf)).length, d: jarak2(p.geometry.coordinates, titikLabel(kf)) };
  }).sort((a, b) => b.skor - a.skor || a.d - b.d)[0].n;
  const daftar = kecPerKab.get(pemilik);
  if (daftar.some((x) => x.properties.nama === nama)) continue;
  daftar.push({ type: "Feature", properties: { id: `kec-${slug(pemilik)}-${slug(nama)}`, nama, kab: pemilik, kab_id: "kab-" + slug(pemilik), luas_km2: Math.round(area(f) / 1e6) }, geometry: f.geometry });
}
const kecMentah = [];
for (const k of KAB) {
  const daftar = kecPerKab.get(k.nama);
  daftar.sort((a, b) => a.properties.nama.localeCompare(b.properties.nama));
  daftar.forEach((f, i) => {
    const hue = (k.hue - 22 + (44 * ((i * 7) % daftar.length)) / Math.max(1, daftar.length - 1) + 360) % 360;
    f.properties.warna = hsl(hue, 78, 42 + (30 * ((i * 3) % 4)) / 3);
  });
  console.log(`  ${k.nama}: ${daftar.length} kecamatan`);
  kecMentah.push(...daftar);
}
// sederhanakan geometri supaya peta ringan (±18% titik, bentuk kecil tetap dipertahankan)
const keluaran = await mapshaper.applyCommands("-i in.json -simplify 18% keep-shapes -o out.json precision=0.00001", { "in.json": { type: "FeatureCollection", features: kecMentah } });
const kec = JSON.parse(keluaran["out.json"].toString()).features;

console.log("3/4 Titik desa/kelurahan (Overpass)");
const tempat = await overpass(`[out:json][timeout:180];area["name"="Riau"]["admin_level"="4"]->.r;node["place"~"^(village|town|suburb)$"](area.r);out;`, "overpass-desa-riau.json");
const desa = [];
for (const n of tempat.elements) {
  if (!n.tags?.name) continue;
  const pt = { type: "Point", coordinates: [n.lon, n.lat] };
  const kecF = kec.find((k) => booleanPointInPolygon(pt, k));
  if (!kecF) continue;
  const id = `desa-${slug(kecF.properties.nama)}-${slug(n.tags.name)}`;
  if (desa.some((d) => d.properties.id === id)) continue;
  const studi = DESA_STUDI.some(([nm, kb]) => nm.toLowerCase() === n.tags.name.toLowerCase() && kb === kecF.properties.kab);
  desa.push({ type: "Feature", properties: { id, nama: n.tags.name, kec: kecF.properties.nama, kec_id: kecF.properties.id, kab: kecF.properties.kab, kab_id: kecF.properties.kab_id, jenis: n.tags.place, studi }, geometry: { type: "Point", coordinates: [Math.round(n.lon * 1e5) / 1e5, Math.round(n.lat * 1e5) / 1e5] } });
}
console.log(`  ${desa.length} titik desa, ${desa.filter((d) => d.properties.studi).length} desa studi`);

console.log("4/4 Menulis berkas");
const fc = (features) => ({ type: "FeatureCollection", features });
const label = (list) => fc(list.map((f) => ({ type: "Feature", properties: { id: f.properties.id, nama: f.properties.nama, studi: !!f.properties.studi, jenis: f.properties.jenis ?? null }, geometry: { type: "Point", coordinates: titikLabel(f) } })));
simpan(path.join(GEO, "kabupaten.geojson"), fc(kab));
simpan(path.join(GEO, "kecamatan.geojson"), fc(kec));
simpan(path.join(GEO, "kabupaten-label.geojson"), label(kab));
simpan(path.join(GEO, "kecamatan-label.geojson"), label(kec));
simpan(path.join(GEO, "desa-titik.geojson"), fc(desa));

// Hierarki ringkas: [id, nama, level, induk, bujur, lintang, jenis/studi]
const hierarki = [
  ...kab.map((f) => [f.properties.id, f.properties.nama, "kabupaten", null, ...titikLabel(f), f.properties.jenis]),
  ...kec.map((f) => [f.properties.id, f.properties.nama, "kecamatan", f.properties.kab_id, ...titikLabel(f), f.properties.luas_km2]),
  ...desa.map((f) => [f.properties.id, f.properties.nama, "desa", f.properties.kec_id, ...f.geometry.coordinates, f.properties.studi ? 1 : 0]),
];
simpan(path.join(AKAR, "src/data/wilayah.json"), { sumber: "OpenStreetMap (ODbL), diunduh " + new Date().toISOString().slice(0, 10), kolom: ["id", "nama", "level", "induk", "bujur", "lintang", "info"], data: hierarki });
