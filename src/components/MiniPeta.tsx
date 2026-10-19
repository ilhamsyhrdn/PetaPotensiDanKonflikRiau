"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { buatStyle } from "@/lib/peta";

/** Peta kecil di halaman detail: citra satelit, batas kecamatan lokasi, dan penanda titik. */
export default function MiniPeta({ koordinat, warna, label, kecId, zoom = 12.5 }: { koordinat: [number, number]; warna: string; label: string; kecId?: string; zoom?: number }) {
  const wadah = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!wadah.current) return;
    const map = new maplibregl.Map({ container: wadah.current, style: buatStyle(), center: koordinat, zoom, attributionControl: { compact: true }, cooperativeGestures: true });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    map.on("load", async () => {
      if (kecId) {
        const kec = await fetch("/geo/kecamatan.geojson").then((r) => r.json());
        const f = kec.features.filter((x: GeoJSON.Feature) => x.properties?.id === kecId);
        map.addSource("kec", { type: "geojson", data: { type: "FeatureCollection", features: f } });
        map.addLayer({ id: "kec-isi", type: "fill", source: "kec", paint: { "fill-color": warna, "fill-opacity": 0.12 } });
        map.addLayer({ id: "kec-garis", type: "line", source: "kec", paint: { "line-color": "#ffffff", "line-width": 2, "line-dasharray": [2, 1.5] } });
      }
    });
    const el = document.createElement("div");
    el.style.cssText = `width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${warna};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.45)`;
    new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(koordinat).addTo(map);
    return () => map.remove();
  }, [koordinat, warna, kecId, zoom]);

  return (
    <div className="relative h-full min-h-[260px] overflow-hidden rounded-lg bg-navy">
      <div ref={wadah} style={{ position: "absolute", inset: 0 }} />
      <div className="absolute right-0 top-0 z-10 max-w-[75%] rounded-bl-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white shadow" style={{ background: warna + "e6" }}>{label}</div>
    </div>
  );
}
