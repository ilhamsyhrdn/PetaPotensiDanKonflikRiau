"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Expand, Pause, Play, X } from "lucide-react";
import type { Media } from "@/lib/types";
import type { Letupan } from "@/lib/letupan";
import type { Ikhtisar } from "@/lib/narasi";
import { type Tema, type TitikPeta, BATAS_RIAU, PUSAT_AWAL, WARNA_TEMA, ZOOM_AWAL, buatStyle, esc, fcTitik, htmlTitik, setModeWarna, tambahLapisan, hitungPerWilayah } from "@/lib/peta";
import { WARNA_SENTIMEN, tanggal, tanggalPendek } from "@/lib/format";
import { kategoriPotensi, warnaSektorKonflik, warnaStatus } from "@/lib/kategori";
import { getWilayah, labelWilayah, rantai } from "@/lib/wilayah";

const DURASI_PANEL = 16000;
const DURASI_TITIK = 9000;

type Langkah =
  | { jenis: "panel"; panel: "umum" | "konflik" | "potensi" | "media"; judul: string; warna: string; tema: Tema }
  | { jenis: "titik"; judul: string; warna: string; tema: Tema; koordinat: [number, number]; zoom: number; html: string };

function htmlLetupan(l: Letupan) {
  return `
    <div style="font-size:11px;color:#5a6b7a;margin-bottom:4px">${esc(labelWilayah(l.wilayahId))}</div>
    <div style="font-weight:700;font-size:15px;line-height:1.3;margin-bottom:4px">${esc(l.isu)}: ${l.jumlah} berita · ${l.dari === l.sampai ? esc(tanggal(l.dari)) : esc(tanggalPendek(l.dari) + " – " + tanggal(l.sampai))}</div>
    <div style="height:3px;background:${WARNA_SENTIMEN[l.sentimen]};border-radius:2px;margin:6px 0 8px"></div>
    ${l.contoh.slice(0, 3).map((m) => `<div style="font-size:13px;line-height:1.4;margin-bottom:6px">“${esc(m.judul)}”<div style="font-size:11px;color:#5a6b7a">${esc(m.sumber)} · ${esc(tanggal(m.tanggal))}</div></div>`).join("")}`;
}
function htmlBerita(m: Media) {
  return `
    <div style="font-size:11px;color:#5a6b7a;margin-bottom:4px">${esc(labelWilayah(m.wilayahId))} · ${esc(m.isu)}</div>
    ${m.gambar ? `<img src="${esc(m.gambar)}" referrerpolicy="no-referrer" style="width:100%;height:120px;object-fit:cover;border-radius:6px;margin-bottom:6px" alt="">` : ""}
    <div style="font-weight:700;font-size:14px;line-height:1.35;margin-bottom:6px">${esc(m.judul)}</div>
    <div style="font-size:11px;color:#5a6b7a">${esc(m.sumber)} · ${esc(tanggal(m.tanggal))} · <b style="color:${WARNA_SENTIMEN[m.sentimen]}">${m.sentimen}</b></div>
    <a href="/berita/${encodeURIComponent(m.id)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:700;color:#fff;background:#2f6690;padding:5px 10px;border-radius:6px;text-decoration:none">Buka berita →</a>`;
}

export default function Presentasi({ ikhtisar, konflik, potensi, letupanNeg, letupanPos, sorotan }: {
  ikhtisar: Ikhtisar; konflik: TitikPeta[]; potensi: TitikPeta[]; letupanNeg: Letupan[]; letupanPos: Letupan[]; sorotan: Media[];
}) {
  const wadah = useRef<HTMLDivElement>(null);
  const petaRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const temaRef = useRef<Tema | null>(null);
  const [siap, setSiap] = useState(false);
  const [i, setI] = useState(0);
  const [jalan, setJalan] = useState(true);

  const langkah = useMemo<Langkah[]>(() => {
    const titik = (t: TitikPeta, tema: Tema, judul: string): Langkah => ({ jenis: "titik", judul, warna: t.warna, tema, koordinat: t.koordinat, zoom: 12.6, html: htmlTitik(t, tema, true) });
    const urutKonflik = [...konflik].sort((a, b) => Number(b.status === "Belum ditangani") - Number(a.status === "Belum ditangani") || Number(b.asal === "TanahKita") - Number(a.asal === "TanahKita") || ((b.tanggal ?? "") > (a.tanggal ?? "") ? 1 : -1));
    const pilihKonflik = urutKonflik.filter((t, idx, xs) => xs.findIndex((x) => rantai(x.wilayahId)[0]?.id === rantai(t.wilayahId)[0]?.id) === idx).slice(0, 6);
    const prioritas = ["industri", "energi", "transportasi", "perikanan", "pariwisata", "pertanian", "perdagangan", "pertambangan"];
    const pilihPotensi = prioritas.map((k) => potensi.find((p) => p.kat === k && p.judul && !/tanpa nama/i.test(p.judul))).filter((x): x is TitikPeta => !!x).slice(0, 6);
    const titikWil = (id: string) => getWilayah(id)?.koordinat;
    return [
      { jenis: "panel", panel: "umum", judul: "Ringkasan umum", warna: "#2f6690", tema: "konflik" },
      { jenis: "panel", panel: "konflik", judul: "Ringkasan konflik", warna: WARNA_TEMA.konflik, tema: "konflik" },
      ...pilihKonflik.map((t) => titik(t, "konflik", "Titik konflik")),
      { jenis: "panel", panel: "potensi", judul: "Ringkasan potensi ekonomi", warna: WARNA_TEMA.potensi, tema: "potensi" },
      ...pilihPotensi.map((t) => titik(t, "potensi", `Potensi · ${kategoriPotensi(t.kat).nama}`)),
      { jenis: "panel", panel: "media", judul: "Ringkasan pemberitaan", warna: "#1c2b38", tema: "konflik" },
      ...[...letupanNeg.slice(0, 2), ...letupanPos.slice(0, 2)].filter((l) => titikWil(l.wilayahId) && l.wilayahId !== "riau").map((l): Langkah => ({
        jenis: "titik", judul: l.sentimen === "negatif" ? "Letupan pemberitaan negatif" : "Letupan pemberitaan positif", warna: WARNA_SENTIMEN[l.sentimen], tema: "konflik", koordinat: titikWil(l.wilayahId)!, zoom: 9.5, html: htmlLetupan(l),
      })),
      ...sorotan.filter((m) => titikWil(m.wilayahId) && m.wilayahId !== "riau").slice(0, 4).map((m): Langkah => ({
        jenis: "titik", judul: m.sentimen === "negatif" ? "Sorotan berita negatif" : "Sorotan berita positif", warna: WARNA_SENTIMEN[m.sentimen], tema: "konflik", koordinat: titikWil(m.wilayahId)!, zoom: 9.8, html: htmlBerita(m),
      })),
    ];
  }, [konflik, potensi, letupanNeg, letupanPos, sorotan]);

  useEffect(() => {
    if (!wadah.current) return;
    const map = new maplibregl.Map({ container: wadah.current, style: buatStyle(), center: PUSAT_AWAL, zoom: ZOOM_AWAL, attributionControl: { compact: true } });
    petaRef.current = map;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __peta?: maplibregl.Map }).__peta = map;
    map.on("load", async () => {
      const ambil = (f: string) => fetch(`/geo/${f}.geojson`).then((r) => r.json());
      const [kab, kec, kabLabel, kecLabel, desa] = await Promise.all(["kabupaten", "kecamatan", "kabupaten-label", "kecamatan-label", "desa-titik"].map(ambil));
      tambahLapisan(map, { tema: "konflik", kab, kec, kabLabel, kecLabel, desa, titik: [] });
      setSiap(true);
    });
    return () => map.remove();
  }, []);

  const pasangTema = useCallback((tema: Tema) => {
    const map = petaRef.current;
    if (!map || temaRef.current === tema) return;
    temaRef.current = tema;
    const data = tema === "konflik" ? konflik : potensi;
    (map.getSource("titik") as maplibregl.GeoJSONSource).setData(fcTitik(data));
    map.setPaintProperty("klaster", "circle-color", WARNA_TEMA[tema]);
    setModeWarna(map, "kepadatan", tema, hitungPerWilayah(data, rantai));
  }, [konflik, potensi]);

  useEffect(() => {
    const map = petaRef.current;
    if (!map || !siap) return;
    popupRef.current?.remove();
    const l = langkah[i];
    pasangTema(l.tema);
    if (l.jenis === "panel") {
      const lebar = window.innerWidth >= 1024;
      map.fitBounds(BATAS_RIAU, { padding: lebar ? { top: 90, bottom: 70, left: 660, right: 40 } : { top: 100, bottom: Math.round(window.innerHeight * 0.6), left: 16, right: 16 }, duration: 1800 });
      return;
    }
    map.flyTo({ center: l.koordinat, zoom: l.zoom, speed: 0.9, curve: 1.5, padding: { top: 220, bottom: 40, left: 0, right: 0 } });
    const buka = () => {
      popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 16, maxWidth: "340px" })
        .setLngLat(l.koordinat).setHTML(`<div class="anim-muncul"><div style="border-top:4px solid ${l.warna};margin:-12px -14px 10px;border-radius:10px 10px 0 0"></div>${l.html}</div>`).addTo(map);
    };
    map.once("moveend", buka);
    return () => { map.off("moveend", buka); };
  }, [i, siap, langkah, pasangTema]);

  const maju = useCallback((d: number) => setI((x) => (x + d + langkah.length) % langkah.length), [langkah.length]);
  const l = langkah[i];
  const durasi = l.jenis === "panel" ? DURASI_PANEL : DURASI_TITIK;
  useEffect(() => {
    if (!jalan || !siap) return;
    const t = setTimeout(() => maju(1), durasi);
    return () => clearTimeout(t);
  }, [i, jalan, siap, maju, durasi]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") maju(1);
      else if (e.key === "ArrowLeft") maju(-1);
      else if (e.key === " ") { e.preventDefault(); setJalan((j) => !j); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [maju]);

  const layarPenuh = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined);
  const nomorPanel = langkah.slice(0, i + 1).filter((x) => x.jenis === "panel").length - 1;

  return (
    <div className="fixed inset-0 bg-navy text-white">
      <div ref={wadah} style={{ position: "absolute", inset: 0 }} />

      <header className="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-navy via-navy/85 to-navy/0 px-4 pb-8 pt-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow hidden !text-white/60 sm:block">Mode presentasi · Provinsi Riau · {tanggal(new Date().toISOString())}</p>
            <p className="flex items-center gap-2 text-base font-bold sm:text-lg">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: l.warna === "#1c2b38" ? "#ffffff" : l.warna }} />{l.judul}
              <span className="num text-sm font-normal text-white/60">{i + 1} dari {langkah.length}</span>
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => maju(-1)} aria-label="Sebelumnya" className="grid h-9 w-9 place-items-center rounded-md bg-white/10 hover:bg-white/20"><ChevronLeft size={18} /></button>
            <button onClick={() => setJalan(!jalan)} aria-label={jalan ? "Jeda" : "Putar"} className="grid h-9 w-9 place-items-center rounded-md bg-white/10 hover:bg-white/20">{jalan ? <Pause size={18} /> : <Play size={18} />}</button>
            <button onClick={() => maju(1)} aria-label="Berikutnya" className="grid h-9 w-9 place-items-center rounded-md bg-white/10 hover:bg-white/20"><ChevronRight size={18} /></button>
            <button onClick={layarPenuh} aria-label="Layar penuh" className="grid h-9 w-9 place-items-center rounded-md bg-white/10 hover:bg-white/20"><Expand size={16} /></button>
            <Link href="/" className="ml-1 flex h-9 items-center gap-1.5 rounded-md bg-white px-3 text-sm font-semibold text-navy"><X size={16} /> Keluar</Link>
          </div>
        </div>
        <div className="mt-2.5 flex gap-1">
          {langkah.map((x, k) => (
            <button key={k} onClick={() => setI(k)} aria-label={`Ke langkah ${k + 1}: ${x.judul}`} className={`h-1 overflow-hidden rounded-full bg-white/15 ${x.jenis === "panel" ? "flex-[2]" : "flex-1"}`}>
              {k < i && <span className="block h-full bg-white/60" />}
              {k === i && <span key={`${i}-${jalan}`} className="block h-full origin-left bg-amber-300" style={{ animation: jalan ? `progres ${durasi}ms linear both` : "none" }} />}
            </button>
          ))}
        </div>
      </header>

      {l.jenis === "panel" && siap && (
        <section key={i} className="anim-muncul absolute inset-x-3 bottom-12 z-10 flex max-h-[58dvh] flex-col overflow-hidden rounded-2xl bg-[#0f1c27]/92 shadow-2xl ring-1 ring-white/10 backdrop-blur lg:inset-x-auto lg:bottom-16 lg:left-6 lg:top-[92px] lg:max-h-none lg:w-[620px]">
          <div className="border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4">
            <p className="eyebrow !text-white/50">Bagian {nomorPanel + 1} dari 4</p>
            <h2 className="text-xl font-bold sm:text-2xl">{l.judul}</h2>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {l.panel === "umum" && <PanelUmum x={ikhtisar} />}
            {l.panel === "konflik" && <PanelKonflik x={ikhtisar} />}
            {l.panel === "potensi" && <PanelPotensi x={ikhtisar} />}
            {l.panel === "media" && <PanelMedia x={ikhtisar} />}
          </div>
        </section>
      )}

      <footer className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-x-6 gap-y-1 overflow-hidden whitespace-nowrap bg-gradient-to-t from-navy via-navy/80 to-navy/0 px-4 pb-3 pt-8 text-xs sm:flex-wrap sm:pb-4 sm:text-sm sm:px-6">
        {ikhtisar.angka.map((k) => <span key={k.label}><span className="text-white/60">{k.label}</span> <b className="num" style={{ color: k.warna }}>{k.nilai}</b></span>)}
        <span className="ml-auto mr-[300px] hidden text-xs text-white/40 xl:inline">Tombol ← → untuk pindah, spasi untuk jeda</span>
      </footer>
    </div>
  );
}

function Bar({ data, warna, label, maks }: { data: [string, number][]; warna: (k: string) => string; label?: (k: string) => string; maks?: number }) {
  const m = maks ?? Math.max(1, ...data.map((d) => d[1]));
  return (
    <ul className="space-y-1.5">
      {data.map(([k, v]) => (
        <li key={k} className="grid grid-cols-[112px_1fr_40px] items-center gap-2 text-[12.5px] sm:grid-cols-[150px_1fr_44px] sm:text-[13px]">
          <span className="truncate text-white/80">{label ? label(k) : k}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full" style={{ width: `${(v / m) * 100}%`, background: warna(k) }} /></span>
          <b className="num text-right">{v.toLocaleString("id-ID")}</b>
        </li>
      ))}
    </ul>
  );
}
const Sub = ({ children }: { children: React.ReactNode }) => <h3 className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wider text-white/50 first:mt-0">{children}</h3>;

function PanelUmum({ x }: { x: Ikhtisar }) {
  return (
    <>
      <dl className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {x.angka.map((a) => (
          <div key={a.label}><dt className="text-[11px] leading-tight text-white/55">{a.label}</dt><dd className="num text-2xl font-bold" style={{ color: a.warna }}>{a.nilai}</dd><dd className="text-[10.5px] text-white/45">{a.ket}</dd></div>
        ))}
      </dl>
      <Sub>Temuan utama</Sub>
      <ol className="space-y-2 text-[14px] leading-relaxed">
        {x.temuan.map((t, k) => <li key={k} className="flex gap-3"><span className="num mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-bold">{k + 1}</span><span className="text-white/90">{t}</span></li>)}
      </ol>
      <Sub>Kecamatan desa studi SIM</Sub>
      <table className="w-full text-[12.5px]">
        <thead><tr className="text-left text-white/50"><th className="py-1 font-medium">Desa</th><th className="font-medium">Kecamatan · Kab.</th><th className="text-right font-medium">Konflik</th><th className="text-right font-medium">Potensi</th><th className="text-right font-medium">Berita kab. 30 hr</th></tr></thead>
        <tbody>{x.studi.map((s) => (
          <tr key={s.desa} className="border-t border-white/10"><td className="py-1 font-semibold text-amber-200">{s.desa}</td><td className="text-white/70">{s.kec} · {s.kab}</td><td className="num text-right">{s.konflikKec}</td><td className="num text-right">{s.potensiKec}</td><td className="num text-right">{s.berita30}</td></tr>
        ))}</tbody>
      </table>
    </>
  );
}

function PanelKonflik({ x }: { x: Ikhtisar }) {
  const total = x.konflik.perStatus.reduce((s, [, n]) => s + n, 0);
  return (
    <>
      <Sub>Status penanganan</Sub>
      <div className="flex h-3.5 overflow-hidden rounded-full">{x.konflik.perStatus.map(([s, n]) => <span key={s} style={{ width: `${(n / Math.max(1, total)) * 100}%`, background: warnaStatus(s) }} />)}</div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">{x.konflik.perStatus.map(([s, n]) => <span key={s} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: warnaStatus(s) }} />{s} <b className="num">{n}</b></span>)}</div>
      <div className="mt-5 grid grid-cols-2 gap-x-6">
        <div><Sub>Per sektor</Sub><Bar data={[...x.konflik.perSektor.slice(0, 6), ...x.konflik.perSektor.filter(([k]) => k === "Belum terklasifikasi")].filter((v, i, xs) => xs.indexOf(v) === i)} warna={warnaSektorKonflik} /></div>
        <div><Sub>Per kabupaten/kota</Sub><Bar data={x.konflik.perKab} warna={() => "#e8590c"} /></div>
      </div>
      <Sub>Jenis konflik terbanyak</Sub>
      <Bar data={x.konflik.perJenis} warna={() => "#ff8787"} />
      <Sub>Kejadian terbaru</Sub>
      <ul className="space-y-2">
        {x.konflik.terbaru.map((k) => (
          <li key={k.judul} className="flex gap-2.5 text-[13px]">
            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: warnaSektorKonflik(k.sektor) }} />
            <span><b className="font-semibold">{k.judul}</b><span className="block text-[11.5px] text-white/55">{k.wilayah} · {k.tanggal} · {k.status}</span></span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] text-white/45">Sumber: TanahKita.id dan berita online. Konflik dari berita perlu diverifikasi tim lapangan.</p>
    </>
  );
}

function PanelPotensi({ x }: { x: Ikhtisar }) {
  return (
    <>
      <Sub>Per lapangan usaha (BPS/KBLI)</Sub>
      <Bar data={x.potensi.perKat} warna={(k) => kategoriPotensi(k).warna} label={(k) => kategoriPotensi(k).nama} />
      <div className="mt-5 grid grid-cols-2 gap-x-6">
        <div><Sub>Kabupaten/kota terbanyak</Sub><Bar data={x.potensi.perKab} warna={() => "#4dabf7"} /></div>
        <div><Sub>Jenis sarana terbanyak</Sub><Bar data={x.potensi.perJenis.slice(0, 6)} warna={() => "#74c0fc"} /></div>
      </div>
      <Sub>Sarana ekonomi utama</Sub>
      <ul className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
        {x.potensi.sorotan.map((p) => (
          <li key={p.nama} className="flex gap-2 text-[12.5px]">
            <span className="mt-1.5 h-2 w-2 shrink-0 rotate-45" style={{ background: kategoriPotensi(p.kategori).warna }} />
            <span className="min-w-0"><b className="font-semibold">{p.nama}</b><span className="block truncate text-[11px] text-white/55">{p.jenis} · {p.wilayah}</span></span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] text-white/45">Sumber: OpenStreetMap (© kontributor OSM, ODbL). Jumlah titik menggambarkan sarana yang sudah terpetakan, bukan nilai ekonomi.</p>
    </>
  );
}

function PanelMedia({ x }: { x: Ikhtisar }) {
  const r = x.media.r30;
  return (
    <>
      <Sub>Sentimen berita 30 hari ({r.total} berita)</Sub>
      <div className="flex h-3.5 overflow-hidden rounded-full">
        {(["negatif", "netral", "positif"] as const).map((s) => <span key={s} style={{ width: `${(r[s] / Math.max(1, r.total)) * 100}%`, background: s === "netral" ? "#adb5bd" : WARNA_SENTIMEN[s] }} />)}
      </div>
      <div className="mt-1.5 flex gap-4 text-xs">{(["negatif", "netral", "positif"] as const).map((s) => <span key={s} className="capitalize">{s} <b className="num">{r[s]}</b></span>)}
        <span className="text-white/55">· negatif {x.media.selisihNegatif > 0 ? "naik" : x.media.selisihNegatif < 0 ? "turun" : "tetap"} {Math.abs(x.media.selisihNegatif)} poin</span></div>
      <div className="mt-5 grid grid-cols-2 gap-x-6">
        <div><Sub>Topik di berita negatif</Sub><Bar data={x.media.isuNeg} warna={() => WARNA_SENTIMEN.negatif} /></div>
        <div><Sub>Topik di berita positif</Sub><Bar data={x.media.isuPos} warna={() => WARNA_SENTIMEN.positif} /></div>
      </div>
      <Sub>Lonjakan berita terakhir</Sub>
      <ul className="space-y-1.5 text-[13px]">{x.media.letupan.map((l) => <li key={l.teks} className="border-l-[3px] pl-2.5" style={{ borderColor: WARNA_SENTIMEN[l.sentimen as "negatif"] }}>{l.teks}</li>)}</ul>
      <Sub>Berita negatif terbaru</Sub>
      <ul className="space-y-1.5 text-[13px]">{x.media.negatifTerbaru.map((m) => <li key={m.judul} className="flex gap-2"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#ff6b6b]" /><span><b className="font-semibold">{m.judul}</b><span className="block text-[11px] text-white/55">{m.sumber} · {m.tanggal} · {m.wilayah}</span></span></li>)}</ul>
      <Sub>Media paling aktif</Sub>
      <Bar data={x.media.sumber} warna={() => "#adb5bd"} />
      <p className="mt-4 text-[11px] text-white/45">Sumber: Google News. Nada berita dibaca otomatis, jadi bisa meleset untuk berita bernada sindiran.</p>
    </>
  );
}
