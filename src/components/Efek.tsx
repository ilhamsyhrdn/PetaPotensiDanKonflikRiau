"use client";

import { useEffect, useRef, useState } from "react";

const kurangiGerak = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Lapisan parallax: bergeser vertikal sebanding posisi gulir (kecepatan 0 = diam, 0.3 = lambat). */
export function Parallax({ kecepatan, className = "", children }: { kecepatan: number; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (kurangiGerak()) return;
    let bingkai = 0;
    const atur = () => {
      bingkai = 0;
      const y = Math.min(window.scrollY, 900);
      if (ref.current) ref.current.style.transform = `translate3d(0, ${(y * kecepatan).toFixed(1)}px, 0)`;
    };
    const gulir = () => { if (!bingkai) bingkai = requestAnimationFrame(atur); };
    window.addEventListener("scroll", gulir, { passive: true });
    atur();
    return () => { window.removeEventListener("scroll", gulir); cancelAnimationFrame(bingkai); };
  }, [kecepatan]);
  return <div ref={ref} className={`will-change-transform ${className}`}>{children}</div>;
}

/** Angka yang menghitung naik saat pertama terlihat. Nilai akhir selalu tampil bila animasi dimatikan. */
export function Angka({ nilai, desimal = 0, akhiran = "" }: { nilai: number; desimal?: number; akhiran?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [tampil, setTampil] = useState(nilai);
  useEffect(() => {
    if (kurangiGerak() || !ref.current) return;
    let mulai = 0, bingkai = 0;
    const jalan = (t: number) => {
      if (!mulai) mulai = t;
      const p = Math.min(1, (t - mulai) / 1100);
      setTampil(nilai * (1 - Math.pow(1 - p, 3)));
      if (p < 1) bingkai = requestAnimationFrame(jalan);
    };
    const amati = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setTampil(0); bingkai = requestAnimationFrame(jalan); amati.disconnect(); }
    }, { threshold: 0.4 });
    amati.observe(ref.current);
    return () => { amati.disconnect(); cancelAnimationFrame(bingkai); };
  }, [nilai]);
  return <span ref={ref} className="num">{tampil.toLocaleString("id-ID", { minimumFractionDigits: desimal, maximumFractionDigits: desimal })}{akhiran}</span>;
}
