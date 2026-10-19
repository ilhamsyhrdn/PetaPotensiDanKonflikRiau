// Siluet SVG Provinsi Riau (per kabupaten) untuk latar hero dashboard.
// Geometri disederhanakan kuat (bentuk saja, bukan untuk analisis). Sumber: public/geo/kabupaten.geojson (OSM).
// Jalankan: node scripts/data/siluet.mjs
import path from "node:path";
import mapshaper from "mapshaper";
import { AKAR, GEO, baca, simpan } from "./_lib.mjs";

const kab = baca(path.join(GEO, "kabupaten.geojson"));
const keluar = await mapshaper.applyCommands("-i in.json -simplify 3% keep-shapes -filter-slivers min-area=20km2 -o out.json precision=0.001", { "in.json": kab });
const fc = JSON.parse(keluar["out.json"].toString());

// Proyeksi equirectangular sederhana (Riau dekat khatulistiwa, distorsi kecil)
const LEBAR = 1000;
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
const tiap = (g, fn) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates).forEach((poly) => poly.forEach((ring) => ring.forEach(fn)));
for (const f of fc.features) tiap(f.geometry, ([x, y]) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); });
const k = LEBAR / (maxX - minX);
const tinggi = Math.round((maxY - minY) * k);
const px = ([x, y]) => [((x - minX) * k).toFixed(1), ((maxY - y) * k).toFixed(1)];

const jalur = fc.features.map((f) => {
  let d = "";
  (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates).forEach((poly) =>
    poly.forEach((ring) => { d += "M" + ring.map((c) => px(c).join(",")).join("L") + "Z"; }));
  return { id: f.properties.id, nama: f.properties.nama, studi: !!f.properties.studi, d };
});

simpan(path.join(AKAR, "src/data/riau-siluet.json"), { lebar: LEBAR, tinggi, batas: [minX, minY, maxX, maxY], kab: jalur });
