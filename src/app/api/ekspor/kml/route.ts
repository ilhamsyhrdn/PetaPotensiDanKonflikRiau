import fs from "node:fs";
import path from "node:path";
import { bacaDb } from "@/lib/db";
import { KAB_STUDI, DESA_STUDI, getWilayah, labelWilayah, namaLengkap } from "@/lib/wilayah";
import { KEC_STUDI, terkumpul } from "@/lib/baseline";
import { KATEGORI_POTENSI, kategoriPotensi, warnaSektorKonflik } from "@/lib/kategori";
import { labelAsal, tanggal, tanpaTanahKita } from "@/lib/format";
import type { Dokumen, Koordinat, Rujukan } from "@/lib/types";

/**
 * Ekspor KML untuk Google Earth dan Google My Maps.
 * ?lapisan=baseline,konflik,potensi (bawaan: semua). Data berlabel Rahasia tidak ikut.
 */
const LAPISAN = ["baseline", "konflik", "potensi"] as const;

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const cdata = (html: string) => `<![CDATA[${html.replaceAll("]]>", "]]&gt;")}]]>`;
// KML memakai urutan aabbggrr
const warnaKml = (hex: string, alfa = "ff") => alfa + hex.slice(5, 7) + hex.slice(3, 5) + hex.slice(1, 3);
const titik = ([x, y]: Koordinat) => `<Point><coordinates>${x},${y},0</coordinates></Point>`;
const IKON = "https://maps.google.com/mapfiles/kml/shapes/placemark_circle.png";

const gayaTitik = (id: string, hex: string) =>
  `<Style id="${id}"><IconStyle><color>${warnaKml(hex)}</color><scale>1.1</scale><Icon><href>${IKON}</href></Icon></IconStyle><LabelStyle><scale>0</scale></LabelStyle></Style>`;
const gayaArea = (id: string, hex: string) =>
  `<Style id="${id}"><LineStyle><color>${warnaKml(hex)}</color><width>2.5</width></LineStyle><PolyStyle><color>${warnaKml(hex, "33")}</color></PolyStyle></Style>`;

const tabel = (baris: [string, string][]) =>
  `<table style="font-size:13px;border-collapse:collapse">${baris.filter(([, v]) => v).map(([k, v]) => `<tr><td style="color:#5b6b7c;padding:2px 10px 2px 0;vertical-align:top">${esc(k)}</td><td>${v}</td></tr>`).join("")}</table>`;
const tautan = (url: string, teks: string) => `<a href="${esc(url)}">${esc(teks)}</a>`;
const daftarSumber = (list: Rujukan[]) => tanpaTanahKita(list).filter((r) => r.url).slice(0, 5).map((r) => tautan(r.url!, r.nama)).join("<br>");

type Fitur = { properties: { id: string }; geometry: { type: "Polygon"; coordinates: number[][][] } };
const bacaGeo = (nama: string) => (JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "geo", nama), "utf8")) as { features: Fitur[] }).features;
const poligon = (f: Fitur) =>
  `<Polygon><tessellate>1</tessellate>${f.geometry.coordinates.map((ring, i) =>
    `<${i ? "inner" : "outer"}BoundaryIs><LinearRing><coordinates>${ring.map(([x, y]) => `${x},${y},0`).join(" ")}</coordinates></LinearRing></${i ? "inner" : "outer"}BoundaryIs>`).join("")}</Polygon>`;

function ringkasBaseline(dok: Dokumen[]) {
  if (!dok.length) return "<p>Belum ada dokumen baseline untuk wilayah ini.</p>";
  const daftar = dok.map((d) => `<li>${d.url ? tautan(d.url, d.judul) : esc(d.judul)}${d.tahun ? ` (${esc(d.tahun)})` : ""}: <i>${esc(d.status)}</i></li>`).join("");
  const angka = dok.flatMap((d) => d.indikator.map((i) => [i.nama, `${esc(i.nilai)} <span style="color:#868e96">· ${esc(d.jenis)}</span>`] as [string, string]));
  return `<p><b>Dokumen baseline</b> (${dok.filter(terkumpul).length}/${dok.length} terkumpul)</p><ul style="padding-left:18px;margin:4px 0">${daftar}</ul>${angka.length ? `<p><b>Angka baseline</b></p>${tabel(angka.map(([k, v]) => [k, v]))}` : ""}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const minta = (url.searchParams.get("lapisan") ?? LAPISAN.join(",")).split(",");
  const lapisan = LAPISAN.filter((l) => minta.includes(l));
  if (!lapisan.length) return Response.json({ pesan: "Pilih minimal satu lapisan." }, { status: 400 });

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const asal = `${proto}://${host}`;
  const keDashboard = (p: string) => `<p>${tautan(asal + p, "Buka di dashboard")}</p>`;

  const db = await bacaDb();
  const gaya: string[] = [];
  const folder: string[] = [];

  if (lapisan.includes("baseline")) {
    gaya.push(gayaArea("kab-studi", "#1f4e79"), gayaArea("kec-studi", "#e8590c"), gayaTitik("desa-studi", "#ffd43b"));
    const kabGeo = new Map(bacaGeo("kabupaten.geojson").map((f) => [f.properties.id, f]));
    const kecGeo = new Map(bacaGeo("kecamatan.geojson").map((f) => [f.properties.id, f]));
    const dokDi = (id: string) => db.dokumen.filter((d) => d.wilayahId === id);
    const area = (id: string, nama: string, gayaId: string, geo?: Fitur) => geo
      ? `<Placemark><name>${esc(nama)}</name><styleUrl>#${gayaId}</styleUrl><description>${cdata(ringkasBaseline(dokDi(id)))}</description>${poligon(geo)}</Placemark>`
      : "";
    folder.push(`<Folder><name>Wilayah studi &amp; baseline</name>
<Folder><name>Kabupaten studi</name>${KAB_STUDI.map((k) => area(k.id, namaLengkap(k), "kab-studi", kabGeo.get(k.id))).join("")}</Folder>
<Folder><name>Kecamatan studi</name>${KEC_STUDI.map((k) => area(k.id, `${namaLengkap(k)}, ${namaLengkap(getWilayah(k.induk))}`, "kec-studi", kecGeo.get(k.id))).join("")}</Folder>
<Folder><name>Desa studi</name>${DESA_STUDI.map((d) => `<Placemark><name>${esc(d.nama)}</name><styleUrl>#desa-studi</styleUrl><description>${cdata(tabel([["Lokasi", esc(labelWilayah(d.id))]]) + ringkasBaseline(dokDi(d.id)))}</description>${titik(d.koordinat)}</Placemark>`).join("")}</Folder>
</Folder>`);
  }

  if (lapisan.includes("konflik")) {
    const list = db.konflik.filter((k) => k.kerahasiaan !== "Rahasia");
    const sektor = [...new Set(list.map((k) => k.sektor))].sort();
    sektor.forEach((s, i) => gaya.push(gayaTitik(`konflik-${i}`, warnaSektorKonflik(s))));
    folder.push(`<Folder><name>Konflik (${list.length})</name>${sektor.map((s, i) => {
      const isi = list.filter((k) => k.sektor === s);
      return `<Folder><name>${esc(s)} (${isi.length})</name>${isi.map((k) => `<Placemark><name>${esc(k.judul)}</name><styleUrl>#konflik-${i}</styleUrl><description>${cdata(
        tabel([["Status", esc(k.status)], ["Waktu", k.tanggal ? esc(tanggal(k.tanggal)) : ""], ["Jenis", esc(k.jenis)], ["Lokasi", esc(labelWilayah(k.wilayahId))], ["Asal data", esc(labelAsal(k.asal))], ["Sumber", daftarSumber(k.sumber)]])
        + (k.ringkasan ? `<p>${esc(k.ringkasan)}</p>` : "") + keDashboard(`/konflik/${encodeURIComponent(k.id)}`))}</description>${titik(k.koordinat)}</Placemark>`).join("")}</Folder>`;
    }).join("")}</Folder>`);
  }

  if (lapisan.includes("potensi")) {
    const list = db.potensi.filter((p) => p.kerahasiaan !== "Rahasia");
    const urutan = KATEGORI_POTENSI.map((k) => k.id);
    const kategori = [...new Set(list.map((p) => p.kategori))].sort((a, b) => (urutan.indexOf(a) + 1 || 99) - (urutan.indexOf(b) + 1 || 99));
    kategori.forEach((id, i) => gaya.push(gayaTitik(`potensi-${i}`, kategoriPotensi(id).warna)));
    folder.push(`<Folder><name>Potensi ekonomi (${list.length})</name>${kategori.map((id, i) => {
      const isi = list.filter((p) => p.kategori === id);
      return `<Folder><name>${esc(kategoriPotensi(id).nama)} (${isi.length})</name>${isi.map((p) => `<Placemark><name>${esc(p.nama)}</name><styleUrl>#potensi-${i}</styleUrl><description>${cdata(
        tabel([["Jenis", esc(p.subkategori)], ["Status", esc(p.status)], ["Komoditas", esc(p.komoditas.join(", "))], ["Pengelola", esc(p.pengelola)], ["Lokasi", esc(labelWilayah(p.wilayahId))]])
        + keDashboard(`/potensi/${encodeURIComponent(p.id)}`))}</description>${titik(p.koordinat)}</Placemark>`).join("")}</Folder>`;
    }).join("")}</Folder>`);
  }

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<name>Peta Potensi Ekonomi &amp; Konflik Riau</name>
<description>${esc(`Diekspor dari dashboard pada ${tanggal(new Date().toISOString())}. Data berlabel Rahasia tidak ikut diekspor.`)}</description>
${gaya.join("\n")}
${folder.join("\n")}
</Document></kml>`;

  return new Response(kml, {
    headers: {
      "Content-Type": "application/vnd.google-earth.kml+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="peta-riau-${lapisan.join("-")}.kml"`,
      "Cache-Control": "private, no-store",
    },
  });
}
