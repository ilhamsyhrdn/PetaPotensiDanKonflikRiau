"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import Link from "next/link";
import { BarChart3, ChevronRight, Layers, Maximize2, Search, SlidersHorizontal, X } from "lucide-react";
import {
  type Basemap, type ModeWarna, type Ringkasan, type Tema, type TitikPeta, BATAS_RIAU, PUSAT_AWAL, ZOOM_AWAL, WARNA_TEMA,
  bboxFitur, buatStyle, fcTitik, hitungPerWilayah, htmlDaftarTitik, htmlTitik, htmlWilayah, setBasemap, setModeWarna, skalaLegenda, tambahLapisan,
} from "@/lib/peta";
import { getWilayah, labelWilayah, namaLengkap, rantai } from "@/lib/wilayah";

export type OpsiFilter = {
  kategori: { nama: string; label: string; warna: string }[];
  status: { nama: string; warna: string }[];
  asal: string[];
  tahun?: [number, number];
};
type Props = { tema: Tema; titik: TitikPeta[]; ringkasan: Ringkasan; opsi: OpsiFilter; fokus?: string; ringkas?: boolean; tinggiPenuh?: boolean };
type Remah = { id: string; nama: string };

const JUDUL: Record<Tema, { kat: string; titik: string }> = {
  konflik: { kat: "Sektor konflik", titik: "titik konflik" },
  potensi: { kat: "Lapangan usaha (BPS)", titik: "titik potensi" },
};

export default function PetaTematik({ tema, titik, ringkasan, opsi, fokus, ringkas = false }: Props) {
  const wadah = useRef<HTMLDivElement>(null);
  const petaRef = useRef<maplibregl.Map | null>(null);
  const geoRef = useRef<{ kab: GeoJSON.FeatureCollection; kec: GeoJSON.FeatureCollection; pusat: Map<string, [number, number]> } | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const pilihRef = useRef<{ src: string; id: string } | null>(null);
  const [siap, setSiap] = useState(false);

  const [kat, setKat] = useState<Set<string>>(() => new Set(opsi.kategori.map((k) => k.nama)));
  const [status, setStatus] = useState<Set<string>>(() => new Set(opsi.status.map((s) => s.nama)));
  const [asal, setAsal] = useState<Set<string>>(() => new Set(opsi.asal));
  const [tahun, setTahun] = useState<[number, number] | undefined>(opsi.tahun);
  const [cari, setCari] = useState("");
  const [basemap, setBm] = useState<Basemap>("satelit");
  const [labelCitra, setLabelCitra] = useState(true);
  const [mode, setMode] = useState<ModeWarna>("kepadatan");
  const [batas, setBatas] = useState({ kec: true, desa: true, studi: true });
  const [panel, setPanel] = useState(!ringkas);
  const [panelKanan, setPanelKanan] = useState(!ringkas);
  const [remah, setRemah] = useState<Remah[]>([]);
  const [hp, setHp] = useState(false); // layar < 1024 px: panel jadi lembar bawah
  const panelRef = useRef(panel);
  const hpRef = useRef(false);
  useEffect(() => { panelRef.current = panel; }, [panel]);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const atur = () => { hpRef.current = mq.matches; setHp(mq.matches); };
    atur();
    if (mq.matches) { setPanel(false); setPanelKanan(false); }
    mq.addEventListener("change", atur);
    return () => mq.removeEventListener("change", atur);
  }, []);
  const jarak = useCallback(() => (hpRef.current || ringkas
    ? { top: 56, bottom: ringkas ? 20 : 80, left: 24, right: 24 }
    : { top: 64, bottom: 40, left: panelRef.current ? 320 : 50, right: 320 }), [ringkas]);

  const byId = useMemo(() => new Map(titik.map((t) => [t.id, t])), [titik]);
  const jumlahKat = useMemo(() => { const n: Record<string, number> = {}; for (const t of titik) n[t.kat] = (n[t.kat] ?? 0) + 1; return n; }, [titik]);
  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return titik.filter((t) => kat.has(t.kat) && (!opsi.status.length || status.has(t.status)) && asal.has(t.asal)
      && (!tahun || !t.tahun || (t.tahun >= tahun[0] && t.tahun <= tahun[1]))
      && (!q || t.judul.toLowerCase().includes(q) || t.sub.toLowerCase().includes(q) || labelWilayah(t.wilayahId).toLowerCase().includes(q)));
  }, [titik, kat, status, asal, tahun, cari, opsi.status.length]);
  const perWilayah = useMemo(() => hitungPerWilayah(tersaring, rantai), [tersaring]);

  // ---------- inisialisasi ----------
  useEffect(() => {
    if (!wadah.current) return;
    const map = new maplibregl.Map({
      container: wadah.current, style: buatStyle(), center: PUSAT_AWAL, zoom: ringkas ? ZOOM_AWAL - 0.5 : ZOOM_AWAL,
      minZoom: 5.5, maxZoom: 17.5, attributionControl: { compact: true }, cooperativeGestures: ringkas,
    });
    petaRef.current = map;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __peta?: maplibregl.Map }).__peta = map; // uji otomatis
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(wadah.current);
    if (!ringkas && window.innerWidth >= 1024) map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    let batal = false;
    map.on("load", async () => {
      const ambil = (f: string) => fetch(`/geo/${f}.geojson`).then((r) => r.json());
      const [kab, kec, kabLabel, kecLabel, desa] = await Promise.all(["kabupaten", "kecamatan", "kabupaten-label", "kecamatan-label", "desa-titik"].map(ambil));
      if (batal) return;
      const pusat = new Map<string, [number, number]>([...kabLabel.features, ...kecLabel.features].map((f: GeoJSON.Feature<GeoJSON.Point>) => [String(f.properties?.id), f.geometry.coordinates as [number, number]]));
      geoRef.current = { kab, kec, pusat };
      tambahLapisan(map, { tema, kab, kec, kabLabel, kecLabel, desa, titik: [] });
      if (!fokus) map.fitBounds(BATAS_RIAU, { padding: ringkas ? 10 : jarak(), duration: 0 });
      setSiap(true);
    });
    return () => { batal = true; ro.disconnect(); map.remove(); petaRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { const m = petaRef.current; if (m && siap) (m.getSource("titik") as maplibregl.GeoJSONSource).setData(fcTitik(tersaring)); }, [siap, tersaring]);
  useEffect(() => { const m = petaRef.current; if (m && siap) setModeWarna(m, mode, tema, perWilayah); }, [siap, mode, tema, perWilayah]);
  useEffect(() => { const m = petaRef.current; if (m && siap) setBasemap(m, basemap, labelCitra); }, [siap, basemap, labelCitra]);
  useEffect(() => {
    const m = petaRef.current;
    if (!m || !siap) return;
    const v = (on: boolean) => (on ? "visible" : "none");
    for (const id of ["kec-line", "kec-label", "kec-sorot"]) m.setLayoutProperty(id, "visibility", v(batas.kec));
    for (const id of ["desa-titik", "desa-label"]) m.setLayoutProperty(id, "visibility", v(batas.desa));
    m.setLayoutProperty("studi", "visibility", v(batas.studi));
  }, [siap, batas]);

  const sorot = useCallback((src: string | null, id: string | null) => {
    const m = petaRef.current;
    if (!m) return;
    if (pilihRef.current) m.setFeatureState({ source: pilihRef.current.src, id: pilihRef.current.id }, { pilih: false });
    pilihRef.current = src && id ? { src, id } : null;
    if (src && id) m.setFeatureState({ source: src, id }, { pilih: true });
  }, []);

  const keWilayah = useCallback((id: string, popup = true) => {
    const map = petaRef.current, geo = geoRef.current;
    if (!map || !geo) return;
    const w = getWilayah(id);
    if (!w) return;
    setRemah(rantai(id).map((x) => ({ id: x.id, nama: namaLengkap(x) })));
    popupRef.current?.remove();
    if (w.level === "desa") {
      sorot(null, null);
      map.flyTo({ center: w.koordinat, zoom: 13, speed: 1.4 });
    } else {
      const fitur = (w.level === "kabupaten" ? geo.kab : geo.kec).features.find((f) => f.properties?.id === id);
      sorot(w.level === "kabupaten" ? "kab" : "kec", id);
      if (fitur) map.fitBounds(bboxFitur(fitur), { padding: jarak(), maxZoom: 12, duration: 900 });
    }
    if (popup && !ringkas) {
      const sub = rantai(id).slice(0, -1).map(namaLengkap).join(" › ") || "Provinsi Riau";
      popupRef.current = new maplibregl.Popup({ offset: 12, maxWidth: "300px" }).setLngLat(geo.pusat.get(id) ?? w.koordinat)
        .setHTML(htmlWilayah(namaLengkap(w), sub + (w.luasKm2 ? ` · ${w.luasKm2.toLocaleString("id-ID")} km²` : ""), ringkasan[id], w.catatan)).addTo(map);
    }
  }, [jarak, ringkas, ringkasan, sorot]);

  // ---------- interaksi ----------
  useEffect(() => {
    const map = petaRef.current;
    if (!map || !siap) return;
    const tooltip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
    let hoverId: string | null = null;

    const klik = async (e: maplibregl.MapMouseEvent) => {
      const f = map.queryRenderedFeatures(e.point, { layers: ["klaster", "titik", "studi", "kec-fill", "kab-fill"].filter((l) => map.getLayoutProperty(l, "visibility") !== "none") })[0];
      if (!f) return;
      const id = String(f.properties?.id);
      if (f.layer.id === "klaster") {
        const zoom = await (map.getSource("titik") as maplibregl.GeoJSONSource).getClusterExpansionZoom(f.properties?.cluster_id);
        map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoom + 0.3 });
        return;
      }
      if (f.layer.id === "titik") {
        const t = byId.get(id);
        if (!t) return;
        // titik lain yang bertumpuk (radius 6 px) ikut ditampilkan supaya semuanya bisa dibuka
        const r = 6, { x, y } = e.point;
        const tumpuk = [...new Set(map.queryRenderedFeatures([[x - r, y - r], [x + r, y + r]], { layers: ["titik"] }).map((g) => String(g.properties?.id)))]
          .filter((i) => i !== id).map((i) => byId.get(i)).filter((v): v is TitikPeta => !!v);
        popupRef.current?.remove();
        sorot("titik", id);
        popupRef.current = new maplibregl.Popup({ offset: 12, maxWidth: "320px" }).setLngLat(t.koordinat)
          .setHTML(tumpuk.length ? htmlDaftarTitik([t, ...tumpuk], tema) : htmlTitik(t, tema)).addTo(map);
        return;
      }
      if (f.layer.id === "studi") return keWilayah(id);
      if (f.layer.id === "kec-fill" && map.getZoom() >= 8.2) return keWilayah(id);
      if (f.layer.id === "kab-fill") return keWilayah(id);
    };
    const gerak = (e: maplibregl.MapMouseEvent) => {
      const titikDi = map.queryRenderedFeatures(e.point, { layers: ["klaster", "titik", "studi"] });
      const poli = map.queryRenderedFeatures(e.point, { layers: ["kec-fill", "kab-fill"] });
      map.getCanvas().style.cursor = titikDi.length || poli.length ? "pointer" : "";
      const kec = poli.find((f) => f.layer.id === "kec-fill" && map.getZoom() >= 8.2);
      const baru = kec ? String(kec.properties?.id) : null;
      if (baru !== hoverId) {
        if (hoverId) map.setFeatureState({ source: "kec", id: hoverId }, { hover: false });
        if (baru) map.setFeatureState({ source: "kec", id: baru }, { hover: true });
        hoverId = baru;
      }
      const f = titikDi[0];
      const label = f ? (f.layer.id === "klaster" ? `${f.properties?.point_count} ${JUDUL[tema].titik} · klik untuk perbesar` : f.layer.id === "titik" ? String(f.properties?.nama) : `Desa studi ${f.properties?.nama}`)
        : kec ? `Kec. ${kec.properties?.nama} · ${perWilayah[String(kec.properties?.id)] ?? 0} ${JUDUL[tema].titik}`
        : poli[0] ? `${poli[0].properties?.jenis === "Kota" ? "Kota" : "Kab."} ${poli[0].properties?.nama} · ${perWilayah[String(poli[0].properties?.id)] ?? 0} ${JUDUL[tema].titik}` : null;
      if (label) tooltip.setLngLat(e.lngLat).setHTML(`<span style="font-size:12px;font-weight:600">${label.replace(/</g, "&lt;")}</span>`).addTo(map);
      else tooltip.remove();
    };
    const keluar = () => { tooltip.remove(); map.getCanvas().style.cursor = ""; };
    map.on("click", klik);
    map.on("mousemove", gerak);
    map.on("mouseout", keluar);
    return () => { map.off("click", klik); map.off("mousemove", gerak); map.off("mouseout", keluar); tooltip.remove(); };
  }, [siap, byId, tema, keWilayah, perWilayah, sorot]);

  useEffect(() => {
    if (!siap) return;
    if (fokus && fokus !== "riau") keWilayah(fokus, false);
    else { setRemah([]); }
  }, [siap, fokus, keWilayah]);

  function keAtas(i: number) {
    const map = petaRef.current;
    if (!map) return;
    popupRef.current?.remove();
    if (i < 0) { setRemah([]); sorot(null, null); map.fitBounds(BATAS_RIAU, { padding: jarak() }); return; }
    keWilayah(remah[i].id);
  }

  const togel = <T,>(set: Set<T>, v: T, setter: (s: Set<T>) => void) => { const s = new Set(set); if (s.has(v)) s.delete(v); else s.add(v); setter(s); };

  // ringkasan panel kanan
  const topKab = useMemo(() => Object.entries(perWilayah).filter(([id]) => id.startsWith("kab-")).sort((a, b) => b[1] - a[1]), [perWilayah]);
  const perKatTersaring = useMemo(() => { const n: Record<string, number> = {}; for (const t of tersaring) n[t.kat] = (n[t.kat] ?? 0) + 1; return n; }, [tersaring]);
  const perStatus = useMemo(() => { const n: Record<string, number> = {}; for (const t of tersaring) n[t.status] = (n[t.status] ?? 0) + 1; return n; }, [tersaring]);
  const maksKab = Math.max(1, ...topKab.map(([, v]) => v));

  return (
    <div className="relative h-full w-full overflow-hidden bg-navy">
      <div ref={wadah} style={{ position: "absolute", inset: 0 }} />

      <nav aria-label="Tingkat wilayah" className={`absolute top-3 z-10 flex max-w-[calc(100%-70px)] flex-wrap items-center gap-1 rounded-lg bg-navy/85 px-3 py-1.5 text-[13px] text-white shadow-lg backdrop-blur lg:max-w-[calc(100%-640px)] lg:text-sm ${ringkas || hp ? "left-3" : panel ? "left-[316px]" : "left-14"}`}>
        <button onClick={() => keAtas(-1)} className={remah.length ? "text-white/70 hover:text-white" : "font-semibold"}>Riau</button>
        {remah.map((r, i) => (
          <span key={r.id} className="flex items-center gap-1">
            <ChevronRight size={14} className="text-white/40" />
            <button onClick={() => keAtas(i)} className={i === remah.length - 1 ? "font-semibold" : "text-white/70 hover:text-white"}>{r.nama}</button>
          </span>
        ))}
      </nav>

      {ringkas ? (
        <>
          <div className="absolute bottom-3 left-3 z-10 rounded-md bg-surface/95 px-2.5 py-1.5 text-xs shadow-lg"><b className="num">{tersaring.length}</b> {JUDUL[tema].titik}</div>
          <Link href={`/peta/${tema}`} className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-md bg-surface px-3 py-1.5 text-sm font-semibold text-ink shadow-lg hover:bg-accent-soft">
            <Maximize2 size={14} /> Buka peta penuh
          </Link>
        </>
      ) : (
        <>
          {!panel && !hp && (
            <button onClick={() => setPanel(true)} aria-label="Buka filter" className="absolute left-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-lg bg-surface shadow-lg"><SlidersHorizontal size={17} /></button>
          )}
          {hp && (
            <div className="absolute inset-x-3 bottom-8 z-10 flex items-center gap-2">
              <button onClick={() => { setPanelKanan(false); setPanel(true); }} className="flex h-11 items-center gap-2 rounded-full bg-navy px-4 text-sm font-semibold text-white shadow-xl"><SlidersHorizontal size={16} /> Filter</button>
              <button onClick={() => { setPanel(false); setPanelKanan(true); }} className="flex h-11 items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold shadow-xl"><BarChart3 size={16} /> Ringkasan</button>
              <span className="ml-auto rounded-full bg-surface/95 px-3 py-1.5 text-xs shadow-lg"><b className="num" style={{ color: WARNA_TEMA[tema] }}>{tersaring.length.toLocaleString("id-ID")}</b> titik</span>
            </div>
          )}
          {hp && (panel || panelKanan) && <button aria-label="Tutup panel" onClick={() => { setPanel(false); setPanelKanan(false); }} className="absolute inset-0 z-20 bg-navy/40" />}
          {panel && (
            <aside className={hp ? "anim-muncul absolute inset-x-0 bottom-0 z-30 flex max-h-[82%] flex-col overflow-hidden rounded-t-2xl bg-surface text-sm shadow-2xl" : "absolute bottom-3 left-3 top-3 z-10 flex w-[300px] flex-col overflow-hidden rounded-lg bg-surface text-sm shadow-xl"}>
              {hp && <span aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-line" />}
              <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
                <p className="flex items-center gap-2 font-semibold"><SlidersHorizontal size={15} /> Filter {tema === "konflik" ? "konflik" : "potensi ekonomi"}</p>
                <button onClick={() => setPanel(false)} aria-label="Tutup filter" className="text-muted hover:text-ink"><X size={16} /></button>
              </div>
              <div className="gulir-tipis min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
                <label className="flex items-center gap-2 rounded-md border border-line px-2.5 py-1.5" htmlFor="cari-titik">
                  <Search size={14} className="text-muted" />
                  <input id="cari-titik" value={cari} onChange={(e) => setCari(e.target.value)} placeholder={tema === "konflik" ? "Cari judul, pihak, wilayah…" : "Cari nama, jenis, wilayah…"} className="w-full bg-transparent outline-none" />
                </label>

                <section>
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="eyebrow">{JUDUL[tema].kat}</p>
                    <span className="flex gap-2 text-xs">
                      <button className="text-accent hover:underline" onClick={() => setKat(new Set(opsi.kategori.map((k) => k.nama)))}>Semua</button>
                      <button className="text-accent hover:underline" onClick={() => setKat(new Set())}>Kosongkan</button>
                    </span>
                  </div>
                  <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-md border border-line">
                    {opsi.kategori.map((k) => (
                      <li key={k.nama}>
                        <label htmlFor={`kat-${k.nama}`} className={`flex cursor-pointer items-center gap-2.5 px-2.5 py-1.5 hover:bg-bg ${jumlahKat[k.nama] ? "" : "opacity-45"}`}>
                          <input id={`kat-${k.nama}`} type="checkbox" checked={kat.has(k.nama)} onChange={() => togel(kat, k.nama, setKat)} />
                          <span className="h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-white" style={{ background: k.warna, boxShadow: `0 0 0 1px ${k.warna}55` }} />
                          <span className="min-w-0 flex-1 truncate">{k.label}</span>
                          <span className="num text-xs text-muted">{jumlahKat[k.nama] ?? 0}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>

                {opsi.status.length > 0 && (
                  <section>
                    <p className="eyebrow mb-1.5">Status penanganan</p>
                    <div className="flex flex-wrap gap-1.5">
                      {opsi.status.map((s) => (
                        <button key={s.nama} onClick={() => togel(status, s.nama, setStatus)} aria-pressed={status.has(s.nama)}
                          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${status.has(s.nama) ? "border-transparent font-semibold" : "border-line text-muted line-through"}`}
                          style={status.has(s.nama) ? { background: s.warna + "1c", color: s.warna } : undefined}>
                          <span className="h-2 w-2 rounded-full" style={{ background: s.warna }} />{s.nama}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {opsi.tahun && tahun && (
                  <section>
                    <p className="eyebrow mb-1.5">Tahun kejadian</p>
                    <div className="flex items-center gap-2">
                      <select aria-label="Dari tahun" value={tahun[0]} onChange={(e) => setTahun([+e.target.value, tahun[1]])} className="flex-1 rounded-md border border-line bg-surface px-2 py-1.5">
                        {rentang(opsi.tahun).map((y) => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <span className="text-muted">–</span>
                      <select aria-label="Sampai tahun" value={tahun[1]} onChange={(e) => setTahun([tahun[0], +e.target.value])} className="flex-1 rounded-md border border-line bg-surface px-2 py-1.5">
                        {rentang(opsi.tahun).map((y) => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </section>
                )}

                {opsi.asal.length > 1 && (
                  <section>
                    <p className="eyebrow mb-1.5">Asal data</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {opsi.asal.map((a) => (
                        <label key={a} htmlFor={`asal-${a}`} className="flex items-center gap-1.5"><input id={`asal-${a}`} type="checkbox" checked={asal.has(a)} onChange={() => togel(asal, a, setAsal)} />{a}</label>
                      ))}
                    </div>
                  </section>
                )}

                <section className="border-t border-line pt-3">
                  <p className="eyebrow mb-1.5 flex items-center gap-1.5"><Layers size={13} /> Tampilan peta</p>
                  <div className="mb-2 grid grid-cols-2 gap-1 rounded-md bg-bg p-1">
                    {(["satelit", "jalan"] as const).map((b) => (
                      <button key={b} onClick={() => setBm(b)} className={`rounded px-2 py-1 ${basemap === b ? "bg-surface font-semibold shadow-sm" : "text-muted"}`}>{b === "satelit" ? "Citra satelit" : "Peta jalan"}</button>
                    ))}
                  </div>
                  <p className="mb-1 text-xs text-muted">Warna wilayah</p>
                  <div className="mb-2 grid grid-cols-3 gap-1 rounded-md bg-bg p-1 text-[13px]">
                    {([["kepadatan", "Kepadatan"], ["wilayah", "Per wilayah"], ["tanpa", "Tanpa"]] as const).map(([m, l]) => (
                      <button key={m} onClick={() => setMode(m)} className={`rounded px-1 py-1 ${mode === m ? "bg-surface font-semibold shadow-sm" : "text-muted"}`}>{l}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {basemap === "satelit" && <label htmlFor="lbl-citra" className="flex items-center gap-1.5"><input id="lbl-citra" type="checkbox" checked={labelCitra} onChange={(e) => setLabelCitra(e.target.checked)} />Nama tempat</label>}
                    <label htmlFor="bts-kec" className="flex items-center gap-1.5"><input id="bts-kec" type="checkbox" checked={batas.kec} onChange={(e) => setBatas({ ...batas, kec: e.target.checked })} />Batas kecamatan</label>
                    <label htmlFor="bts-desa" className="flex items-center gap-1.5"><input id="bts-desa" type="checkbox" checked={batas.desa} onChange={(e) => setBatas({ ...batas, desa: e.target.checked })} />Titik desa</label>
                    <label htmlFor="bts-studi" className="flex items-center gap-1.5"><input id="bts-studi" type="checkbox" checked={batas.studi} onChange={(e) => setBatas({ ...batas, studi: e.target.checked })} />Desa studi</label>
                  </div>
                </section>
              </div>
              <div className="flex items-center gap-3 border-t border-line bg-bg px-3 py-2">
                <p className="flex-1 text-[11px] leading-snug text-muted">Batas wilayah: OpenStreetMap. {tema === "konflik" ? "Konflik: data sekunder & berita online." : "Potensi: OpenStreetMap, kategori lapangan usaha BPS."}</p>
                {hp && <button onClick={() => setPanel(false)} className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">Lihat {tersaring.length.toLocaleString("id-ID")} titik</button>}
              </div>
            </aside>
          )}

          {!panelKanan && !hp && (
            <button onClick={() => setPanelKanan(true)} aria-label="Buka ringkasan" className="absolute right-14 top-3 z-10 flex h-9 items-center gap-1.5 rounded-lg bg-surface px-3 text-sm font-semibold shadow-lg"><BarChart3 size={16} /> Ringkasan</button>
          )}
          {panelKanan && (
            <aside className={hp ? "anim-muncul absolute inset-x-0 bottom-0 z-30 flex max-h-[75%] flex-col overflow-hidden rounded-t-2xl bg-surface text-sm shadow-2xl" : "absolute right-14 top-3 z-10 flex max-h-[calc(100%-24px)] w-[260px] flex-col overflow-hidden rounded-lg bg-surface text-sm shadow-xl"}>
              {hp && <span aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-line" />}
              <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
                <p className="font-semibold">Ringkasan</p>
                <button onClick={() => setPanelKanan(false)} aria-label="Tutup ringkasan" className="text-muted hover:text-ink"><X size={16} /></button>
              </div>
              <div className="gulir-tipis min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
                <div>
                  <p className="num text-3xl font-bold" style={{ color: WARNA_TEMA[tema] }}>{tersaring.length.toLocaleString("id-ID")}</p>
                  <p className="text-xs text-muted">{JUDUL[tema].titik} dari {titik.length.toLocaleString("id-ID")} sesuai filter</p>
                </div>
                {opsi.status.length > 0 && (
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-bg">
                    {opsi.status.map((s) => <span key={s.nama} title={`${s.nama}: ${perStatus[s.nama] ?? 0}`} style={{ width: `${((perStatus[s.nama] ?? 0) / Math.max(1, tersaring.length)) * 100}%`, background: s.warna }} />)}
                  </div>
                )}
                <div>
                  <p className="eyebrow mb-1.5">Per kabupaten/kota</p>
                  <ul className="space-y-1">
                    {topKab.slice(0, 12).map(([id, v]) => (
                      <li key={id}>
                        <button onClick={() => { if (hp) setPanelKanan(false); keWilayah(id); }} className="grid w-full grid-cols-[110px_1fr_32px] items-center gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-bg">
                          <span className="truncate">{getWilayah(id)?.nama}</span>
                          <span className="h-2 overflow-hidden rounded-full bg-bg"><span className="block h-full rounded-full" style={{ width: `${(v / maksKab) * 100}%`, background: WARNA_TEMA[tema] }} /></span>
                          <span className="num text-right font-semibold">{v}</span>
                        </button>
                      </li>
                    ))}
                    {!topKab.length && <li className="text-xs text-muted">Tidak ada titik yang cocok dengan filter ini.</li>}
                  </ul>
                </div>
                <div>
                  <p className="eyebrow mb-1.5">{tema === "konflik" ? "Sektor terbanyak" : "Kategori terbanyak"}</p>
                  <ul className="space-y-1 text-xs">
                    {opsi.kategori.filter((k) => perKatTersaring[k.nama]).sort((a, b) => (perKatTersaring[b.nama] ?? 0) - (perKatTersaring[a.nama] ?? 0)).slice(0, 6).map((k) => (
                      <li key={k.nama} className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: k.warna }} /><span className="flex-1 truncate">{k.label}</span><b className="num">{perKatTersaring[k.nama]}</b></li>
                    ))}
                  </ul>
                </div>
                {mode === "kepadatan" && (
                  <div>
                    <p className="eyebrow mb-1.5">Makin gelap warnanya, makin banyak titiknya</p>
                    <div className="flex h-2.5 overflow-hidden rounded">{skalaLegenda(tema).map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}</div>
                    <div className="mt-0.5 flex justify-between text-[11px] text-muted"><span>sedikit</span><span>banyak</span></div>
                  </div>
                )}
              </div>
            </aside>
          )}
        </>
      )}
    </div>
  );
}

const rentang = ([a, b]: [number, number]) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
