/**
 * Bagian peta yang dipakai bersama oleh Peta Konflik, Peta Potensi, Dashboard, detail, dan Mode Presentasi.
 * Hanya untuk komponen klien (butuh maplibre-gl & canvas).
 */
import type * as maplibregl from "maplibre-gl";
import { setWorkerUrl, type ExpressionSpecification, type StyleSpecification } from "maplibre-gl";
import type { AngkaWilayah, Ringkasan } from "./ringkasan";
import { tanggal } from "./format";
import { DESA_STUDI, labelWilayah } from "./wilayah";

// maplibre-gl 6 memuat worker dari berkas terpisah; pola new URL(..., import.meta.url) membuat Next.js menyalinnya sebagai aset
setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());

export type Tema = "konflik" | "potensi";
export type Basemap = "satelit" | "jalan";
export type ModeWarna = "kepadatan" | "wilayah" | "tanpa";

/** Titik ringan yang dikirim ke peta (detail lengkap ada di halaman detail). */
export type TitikPeta = {
  id: string; judul: string; kat: string; warna: string; sub: string; status: string; warnaStatus?: string;
  tanggal?: string; tahun?: number; wilayahId: string; koordinat: [number, number]; asal: string; ket?: string;
};

export const PUSAT_AWAL: [number, number] = [101.7, 0.55];
export const ZOOM_AWAL = 7.15;
export const BATAS_RIAU: [[number, number], [number, number]] = [[100.0, -1.15], [103.85, 2.95]];
const FONT_TEBAL = ["Noto Sans Bold"];
const FONT_BIASA = ["Noto Sans Regular"];

export const WARNA_TEMA: Record<Tema, string> = { konflik: "#A23A1C", potensi: "#2F6690" };
// skala kepadatan: dari warna lembut dokumen ke warna tegas tema
const SKALA: Record<Tema, string[]> = {
  konflik: ["#FBE9E3", "#F6C2AE", "#EB8F6E", "#CF5A33", "#A23A1C"],
  potensi: ["#E2ECF4", "#B5CDE2", "#7FA8CB", "#4B7FAC", "#1F4E79"],
};

export function buatStyle(): StyleSpecification {
  const esri = (layanan: string) => `https://server.arcgisonline.com/ArcGIS/rest/services/${layanan}/MapServer/tile/{z}/{y}/{x}`;
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      satelit: { type: "raster", tiles: [esri("World_Imagery")], tileSize: 256, maxzoom: 19, attribution: "Citra © Esri, Maxar, Earthstar Geographics" },
      jalanEsri: { type: "raster", tiles: [esri("Reference/World_Transportation")], tileSize: 256, maxzoom: 19 },
      labelEsri: { type: "raster", tiles: [esri("Reference/World_Boundaries_and_Places")], tileSize: 256, maxzoom: 19 },
      osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19, attribution: "© OpenStreetMap contributors" },
    },
    layers: [
      { id: "latar", type: "background", paint: { "background-color": "#0e1a24" } },
      { id: "bm-satelit", type: "raster", source: "satelit" },
      { id: "bm-osm", type: "raster", source: "osm", layout: { visibility: "none" } },
      { id: "bm-jalan", type: "raster", source: "jalanEsri", paint: { "raster-opacity": 0.7 } },
      { id: "bm-label", type: "raster", source: "labelEsri", paint: { "raster-opacity": 0.85 } },
    ],
  };
}

export function setBasemap(map: maplibregl.Map, b: Basemap, labelCitra: boolean) {
  const v = (on: boolean) => (on ? "visible" : "none");
  map.setLayoutProperty("bm-satelit", "visibility", v(b === "satelit"));
  map.setLayoutProperty("bm-osm", "visibility", v(b === "jalan"));
  map.setLayoutProperty("bm-jalan", "visibility", v(b === "satelit" && labelCitra));
  map.setLayoutProperty("bm-label", "visibility", v(b === "satelit" && labelCitra));
}

function ikonDesaStudi(map: maplibregl.Map) {
  if (map.hasImage("desa-studi")) return;
  const s = 28, r = 2, el = document.createElement("canvas");
  el.width = el.height = s * r;
  const c = el.getContext("2d")!;
  c.scale(r, r);
  c.beginPath(); c.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2); c.fillStyle = "rgba(255,255,255,0.35)"; c.fill();
  c.beginPath(); c.arc(s / 2, s / 2, s / 2 - 7, 0, Math.PI * 2); c.fillStyle = "#ffd43b"; c.strokeStyle = "#142230"; c.lineWidth = 2.4; c.fill(); c.stroke();
  map.addImage("desa-studi", { width: s * r, height: s * r, data: new Uint8Array(c.getImageData(0, 0, s * r, s * r).data.buffer) }, { pixelRatio: 2 });
}

type FC = GeoJSON.FeatureCollection;
export const fcTitik = (list: TitikPeta[]): FC => ({
  type: "FeatureCollection",
  features: list.map((t) => ({ type: "Feature", id: t.id, properties: { id: t.id, warna: t.warna, nama: t.judul, belum: t.status === "Belum ditangani" }, geometry: { type: "Point", coordinates: t.koordinat } })),
});
const fcDesaStudi = (): FC => ({
  type: "FeatureCollection",
  features: DESA_STUDI.map((d) => ({ type: "Feature", id: d.id, properties: { id: d.id, nama: d.nama }, geometry: { type: "Point", coordinates: d.koordinat } })),
});

/** Hitung jumlah titik per kabupaten & kecamatan (untuk warna kepadatan sesuai filter). */
export function hitungPerWilayah(titik: TitikPeta[], rantaiFn: (id: string) => { id: string }[]) {
  const n: Record<string, number> = {};
  for (const t of titik) for (const w of rantaiFn(t.wilayahId)) if (!w.id.startsWith("desa-")) n[w.id] = (n[w.id] ?? 0) + 1;
  return n;
}

export function warnaKepadatan(tema: Tema, n: number, maks: number) {
  if (!n) return "#f1f3f5";
  const i = Math.min(4, Math.floor((Math.sqrt(n) / Math.sqrt(Math.max(1, maks))) * 4.999));
  return SKALA[tema][i];
}
export const skalaLegenda = (tema: Tema) => SKALA[tema];

export function ekspresiWarna(mode: ModeWarna, tema: Tema, jumlah: Record<string, number>, level: "kab" | "kec"): ExpressionSpecification {
  if (mode !== "kepadatan") return ["get", "warna"];
  const awalan = level === "kab" ? "kab-" : "kec-";
  const entri = Object.entries(jumlah).filter(([id]) => id.startsWith(awalan));
  const maks = Math.max(1, ...entri.map(([, v]) => v));
  const pasangan = entri.flatMap(([id, v]) => [id, warnaKepadatan(tema, v, maks)]);
  return pasangan.length ? (["match", ["get", "id"], ...pasangan, "#f1f3f5"] as unknown as ExpressionSpecification) : ["literal", "#f1f3f5"];
}

export function setModeWarna(map: maplibregl.Map, mode: ModeWarna, tema: Tema, jumlah: Record<string, number>) {
  map.setPaintProperty("kab-fill", "fill-color", ekspresiWarna(mode, tema, jumlah, "kab"));
  map.setPaintProperty("kec-fill", "fill-color", ekspresiWarna(mode, tema, jumlah, "kec"));
  const op = mode === "tanpa" ? 0 : mode === "kepadatan" ? 0.5 : 0.4;
  map.setPaintProperty("kab-fill", "fill-opacity", ["interpolate", ["linear"], ["zoom"], 6, op, 8.2, op * 0.8, 9, 0]);
  map.setPaintProperty("kec-fill", "fill-opacity", ["interpolate", ["linear"], ["zoom"], 7.9, 0, 8.6, ["case", ["boolean", ["feature-state", "hover"], false], Math.min(0.85, op + 0.18), op], 11, op * 0.75, 13.5, op * 0.3]);
}

/** Lapisan wilayah (kab, kec, desa) + titik tematik ber-klaster. Panggil setelah event `load`. */
export function tambahLapisan(map: maplibregl.Map, o: { tema: Tema; kab: FC; kec: FC; kabLabel: FC; kecLabel: FC; desa: FC; titik: TitikPeta[] }) {
  ikonDesaStudi(map);
  map.addSource("kab", { type: "geojson", data: o.kab, promoteId: "id" });
  map.addSource("kec", { type: "geojson", data: o.kec, promoteId: "id" });
  map.addSource("kab-label", { type: "geojson", data: o.kabLabel });
  map.addSource("kec-label", { type: "geojson", data: o.kecLabel });
  map.addSource("desa", { type: "geojson", data: o.desa, promoteId: "id" });
  map.addSource("studi", { type: "geojson", data: fcDesaStudi(), promoteId: "id" });
  map.addSource("titik", { type: "geojson", data: fcTitik(o.titik), promoteId: "id", cluster: true, clusterMaxZoom: 10, clusterRadius: 38 });

  map.addLayer({ id: "kab-fill", type: "fill", source: "kab", paint: { "fill-color": "#f1f3f5", "fill-opacity": 0.5 } });
  map.addLayer({ id: "kec-fill", type: "fill", source: "kec", paint: { "fill-color": "#f1f3f5", "fill-opacity": 0 } });
  map.addLayer({ id: "kec-line", type: "line", source: "kec", paint: {
    "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 12, 1.6],
    "line-opacity": ["interpolate", ["linear"], ["zoom"], 7.4, 0.15, 8.4, 0.8],
  } });
  map.addLayer({ id: "kec-sorot", type: "line", source: "kec", paint: { "line-color": "#ffd43b", "line-width": 3, "line-opacity": ["case", ["boolean", ["feature-state", "pilih"], false], 1, 0] } });
  map.addLayer({ id: "kab-line-bayang", type: "line", source: "kab", paint: { "line-color": "#0b141c", "line-opacity": 0.5, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 2.4, 11, 4.6] } });
  map.addLayer({ id: "kab-line", type: "line", source: "kab", paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1.1, 11, 2.4] } });
  map.addLayer({ id: "kab-sorot", type: "line", source: "kab", paint: { "line-color": "#ffd43b", "line-width": 3.2, "line-opacity": ["case", ["boolean", ["feature-state", "pilih"], false], 1, 0] } });

  const halo = { "text-color": "#ffffff", "text-halo-color": "rgba(10,20,28,0.85)", "text-halo-width": 1.6 } as const;
  map.addLayer({ id: "kab-label", type: "symbol", source: "kab-label", maxzoom: 8.6, layout: {
    "text-field": ["upcase", ["get", "nama"]], "text-font": FONT_TEBAL, "text-size": ["interpolate", ["linear"], ["zoom"], 6.5, 10.5, 8.5, 13], "text-letter-spacing": 0.06, "text-max-width": 8,
  }, paint: halo });
  map.addLayer({ id: "kec-label", type: "symbol", source: "kec-label", minzoom: 8.4, layout: {
    "text-field": ["get", "nama"], "text-font": FONT_TEBAL, "text-size": ["interpolate", ["linear"], ["zoom"], 8.4, 10, 12, 14],
  }, paint: halo });
  map.addLayer({ id: "desa-titik", type: "circle", source: "desa", minzoom: 9.6, paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 9.6, 1.8, 13, 3.6], "circle-color": "#ffffff", "circle-stroke-color": "#142230", "circle-stroke-width": 1,
  } });
  map.addLayer({ id: "desa-label", type: "symbol", source: "desa", minzoom: 10.6, layout: {
    "text-field": ["get", "nama"], "text-font": FONT_BIASA, "text-size": 11, "text-offset": [0, 0.85], "text-anchor": "top", "text-optional": true,
  }, paint: { "text-color": "#ffffff", "text-halo-color": "rgba(10,20,28,0.85)", "text-halo-width": 1.3 } });

  const w = WARNA_TEMA[o.tema];
  map.addLayer({ id: "klaster", type: "circle", source: "titik", filter: ["has", "point_count"], paint: {
    "circle-color": w, "circle-opacity": 0.92, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2,
    "circle-radius": ["step", ["get", "point_count"], 13, 10, 17, 50, 22, 200, 28],
  } });
  map.addLayer({ id: "klaster-angka", type: "symbol", source: "titik", filter: ["has", "point_count"], layout: {
    "text-field": ["get", "point_count_abbreviated"], "text-font": FONT_TEBAL, "text-size": 12, "text-allow-overlap": true, "text-ignore-placement": true,
  }, paint: { "text-color": "#ffffff" } });
  map.addLayer({ id: "titik-halo", type: "circle", source: "titik", filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "belum"], true]], paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 9, 13, 15], "circle-color": "#ff6b6b", "circle-opacity": 0.3, "circle-blur": 0.3,
  } });
  map.addLayer({ id: "titik", type: "circle", source: "titik", filter: ["!", ["has", "point_count"]], paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 5.5, 12, 8, 15, 10],
    "circle-color": ["get", "warna"], "circle-stroke-color": ["case", ["boolean", ["feature-state", "pilih"], false], "#ffd43b", "#ffffff"],
    "circle-stroke-width": ["case", ["boolean", ["feature-state", "pilih"], false], 3.5, 2],
  } });
  map.addLayer({ id: "titik-label", type: "symbol", source: "titik", minzoom: 12.5, filter: ["!", ["has", "point_count"]], layout: {
    "text-field": ["get", "nama"], "text-font": FONT_BIASA, "text-size": 11, "text-offset": [0, 1.1], "text-anchor": "top", "text-max-width": 12, "text-optional": true,
  }, paint: { "text-color": "#ffffff", "text-halo-color": "rgba(10,20,28,0.9)", "text-halo-width": 1.4 } });

  map.addLayer({ id: "studi", type: "symbol", source: "studi", layout: {
    "icon-image": "desa-studi", "icon-allow-overlap": true, "icon-size": ["interpolate", ["linear"], ["zoom"], 7, 0.6, 12, 1.05],
    "text-field": ["get", "nama"], "text-font": FONT_TEBAL, "text-size": ["interpolate", ["linear"], ["zoom"], 7, 10, 12, 13.5],
    "text-offset": [0, 1.2], "text-anchor": "top", "text-allow-overlap": false, "text-optional": true,
  }, paint: { "text-color": "#ffe066", "text-halo-color": "rgba(10,20,28,0.9)", "text-halo-width": 1.6 } });
}

// ---------- utilitas ----------
export function bboxFitur(f: GeoJSON.Feature): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const jalan = (c: unknown): void => {
    if (typeof (c as number[])[0] === "number") {
      const [x, y] = c as number[];
      if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    } else (c as unknown[]).forEach(jalan);
  };
  jalan((f.geometry as GeoJSON.Polygon).coordinates);
  return [minX, minY, maxX, maxY];
}

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const chip = (teks: string, warna: string) =>
  `<span style="display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:600;background:${warna}1f;color:${warna};margin:0 4px 4px 0">${esc(teks)}</span>`;

/** Kartu popup untuk satu titik konflik/potensi, dengan tombol ke halaman detail. */
export function htmlTitik(t: TitikPeta, tema: Tema, tabBaru = false) {
  const href = `/${tema}/${encodeURIComponent(t.id)}`;
  return `
    <div style="font-size:11px;color:#5a6b7a;margin-bottom:4px">${esc(labelWilayah(t.wilayahId))}</div>
    <div style="font-weight:700;font-size:14px;line-height:1.3;margin-bottom:6px">${esc(t.judul)}</div>
    <div>${chip(t.sub, t.warna)}${t.status ? chip(t.status, t.warnaStatus ?? "#495057") : ""}</div>
    ${t.ket ? `<div style="font-size:12.5px;line-height:1.45;margin:2px 0 6px;color:#1c2b38">${esc(t.ket)}</div>` : ""}
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:6px">
      <span style="font-size:11px;color:#5a6b7a">${t.tanggal ? esc(tanggal(t.tanggal)) + " · " : ""}${esc(t.asal)}</span>
      <a href="${href}"${tabBaru ? ' target="_blank" rel="noopener"' : ""} style="font-size:12px;font-weight:700;color:#fff;background:#2f6690;padding:5px 10px;border-radius:6px;text-decoration:none;white-space:nowrap">Lihat detail →</a>
    </div>`;
}

/** Popup untuk beberapa titik yang bertumpuk di satu lokasi (mis. lokasi setingkat kecamatan). */
export function htmlDaftarTitik(ts: TitikPeta[], tema: Tema, maks = 8) {
  const baris = ts.slice(0, maks).map((t) => `
    <a href="/${tema}/${encodeURIComponent(t.id)}" style="display:flex;gap:8px;align-items:flex-start;padding:7px 2px;border-top:1px solid #e9edf1;text-decoration:none;color:#1c2b38">
      <span style="flex:none;width:9px;height:9px;border-radius:50%;margin-top:4px;background:${t.warna}"></span>
      <span style="min-width:0;flex:1"><span style="display:block;font-size:12.5px;font-weight:600;line-height:1.3">${esc(t.judul)}</span>
      <span style="display:block;font-size:11px;color:#5a6b7a">${esc(t.sub)}${t.status ? " · " + esc(t.status) : ""}${t.tanggal ? " · " + esc(tanggal(t.tanggal)) : ""}</span></span>
      <span style="flex:none;font-size:12px;font-weight:700;color:#2f6690">→</span>
    </a>`).join("");
  const sisa = ts.length > maks ? `<div style="font-size:11px;color:#5a6b7a;padding-top:6px">+${ts.length - maks} titik lain, perbesar peta untuk melihatnya</div>` : "";
  return `
    <div style="font-size:11px;color:#5a6b7a;margin-bottom:2px">${esc(labelWilayah(ts[0].wilayahId))}</div>
    <div style="font-weight:700;font-size:14px;margin-bottom:4px">${ts.length} titik di lokasi ini</div>
    <div style="max-height:280px;overflow-y:auto">${baris}</div>${sisa}`;
}

export function htmlWilayah(nama: string, sub: string, r: AngkaWilayah | undefined, catatan?: string) {
  const baris = (l: string, v: string | number, w = "#1c2b38") => `<div style="display:flex;justify-content:space-between;gap:16px;font-size:12.5px;padding:2px 0"><span style="color:#5a6b7a">${l}</span><b style="color:${w};font-variant-numeric:tabular-nums">${v}</b></div>`;
  return `
    <div style="font-size:11px;color:#5a6b7a;margin-bottom:4px">${esc(sub)}</div>
    <div style="font-weight:700;font-size:15px;margin-bottom:6px">${esc(nama)}</div>
    ${r ? baris("Titik konflik", r.konflik, r.konflik ? "#a23a1c" : "#1c2b38") + baris("Konflik belum selesai", r.konflikAktif) + baris("Titik potensi ekonomi", r.potensi) + baris("Berita 30 hari", r.media30) + baris("Indeks sentimen", r.media30 ? (r.indeks > 0 ? "+" : "") + r.indeks : "–", r.indeks < -15 ? "#c92a2a" : r.indeks > 15 ? "#2f9e44" : "#1c2b38") : ""}
    ${catatan ? `<div style="font-size:11px;color:#a23a1c;margin-top:6px">${esc(catatan)}</div>` : ""}`;
}

export type { Ringkasan };
