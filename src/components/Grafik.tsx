"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export type Irisan = { label: string; nilai: number; warna: string; href?: string };

/**
 * Grafik donat SVG (tanpa pustaka, aman untuk SSR). Menyorot irisan saat legenda/irisan disorot,
 * dan angka di tengah ikut berganti.
 */
export function Donut({ data, tengah, ukuran = 176, tebal = 26, legenda = "kanan" }: {
  data: Irisan[]; tengah: { nilai: string; label: string }; ukuran?: number; tebal?: number; legenda?: "kanan" | "bawah";
}) {
  const [aktif, setAktif] = useState<number | null>(null);
  const tampil = data.filter((d) => d.nilai > 0);
  const total = tampil.reduce((n, d) => n + d.nilai, 0);
  const r = (ukuran - tebal) / 2, keliling = 2 * Math.PI * r, celah = tampil.length > 1 ? 2.5 : 0;
  let jalan = 0;
  const pilih = aktif !== null ? tampil[aktif] : null;
  const persen = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <div className={`my-auto flex flex-col items-center gap-5 ${legenda === "kanan" ? "sm:flex-row sm:items-center sm:justify-center" : ""}`}>
      <div className="relative shrink-0" style={{ width: ukuran, height: ukuran }}>
        <svg viewBox={`0 0 ${ukuran} ${ukuran}`} className="-rotate-90" role="img" aria-label={tampil.map((d) => `${d.label} ${d.nilai}`).join(", ")}>
          <circle cx={ukuran / 2} cy={ukuran / 2} r={r} fill="none" stroke="#eef2f6" strokeWidth={tebal} />
          {tampil.map((d, i) => {
            const panjang = Math.max(0.5, (d.nilai / total) * keliling - celah);
            const el = (
              <circle key={d.label} cx={ukuran / 2} cy={ukuran / 2} r={r} fill="none" stroke={d.warna}
                strokeWidth={aktif === i ? tebal + 6 : tebal} strokeDasharray={`${panjang} ${keliling - panjang}`} strokeDashoffset={-jalan}
                opacity={aktif === null || aktif === i ? 1 : 0.3} className="cursor-pointer transition-[opacity,stroke-width] duration-200"
                onMouseEnter={() => setAktif(i)} onMouseLeave={() => setAktif(null)} />
            );
            jalan += (d.nilai / total) * keliling;
            return el;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div className="px-6">
            <p className="num text-[26px] font-bold leading-none tracking-tight">{pilih ? pilih.nilai.toLocaleString("id-ID") : tengah.nilai}</p>
            <p className="mx-auto mt-1 max-w-[96px] text-[11.5px] leading-tight text-muted">{pilih ? `${pilih.label} (${persen(pilih.nilai)}%)` : tengah.label}</p>
          </div>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-0.5 sm:max-w-[420px]">
        {tampil.map((d, i) => {
          const isi = (
            <>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.warna }} />
              <span className="truncate" title={d.label}>{d.label}</span>
              <span className="num text-right font-semibold">{d.nilai.toLocaleString("id-ID")}</span>
              <span className="num text-right text-muted">{persen(d.nilai)}%</span>
            </>
          );
          const kelas = `grid grid-cols-[10px_1fr_auto_38px] items-center gap-2.5 rounded-lg px-2 py-[5px] text-[13px] transition-colors ${aktif === i ? "bg-[#f1f5f9]" : ""}`;
          return (
            <li key={d.label} onMouseEnter={() => setAktif(i)} onMouseLeave={() => setAktif(null)}>
              {d.href ? <Link href={d.href} className={`${kelas} hover:text-accent`}>{isi}</Link> : <span className={kelas}>{isi}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export type Kolom = { kunci: string; judul: string; kanan?: boolean; lebar?: string };
export type Sel = { teks: React.ReactNode; urut: number | string };

/** Tabel dengan judul kolom yang bisa diklik untuk mengurutkan. Isi sel sudah dirender di server. */
export function TabelUrut({ kolom, baris, awal, minLebar = 760 }: {
  kolom: Kolom[]; baris: { id: string; sel: Record<string, Sel>; sorot?: boolean }[]; awal: { kunci: string; turun: boolean }; minLebar?: number;
}) {
  const [urut, setUrut] = useState(awal);
  const hasil = [...baris].sort((a, b) => {
    const x = a.sel[urut.kunci]?.urut ?? 0, y = b.sel[urut.kunci]?.urut ?? 0;
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "id");
    return urut.turun ? -c : c;
  });
  return (
    <div className="overflow-x-auto">
      <table className="tabel" style={{ minWidth: minLebar }}>
        <thead>
          <tr>
            {kolom.map((k) => {
              const on = urut.kunci === k.kunci;
              const Ikon = on ? (urut.turun ? ArrowDown : ArrowUp) : ArrowUpDown;
              return (
                <th key={k.kunci} style={{ width: k.lebar }} className={k.kanan ? "!text-right" : ""} aria-sort={on ? (urut.turun ? "descending" : "ascending") : "none"}>
                  <button onClick={() => setUrut({ kunci: k.kunci, turun: on ? !urut.turun : typeof baris[0]?.sel[k.kunci]?.urut === "number" })}
                    className={`inline-flex items-center gap-1 hover:text-ink ${on ? "text-ink" : ""}`}>
                    {k.judul} <Ikon size={12} className={on ? "" : "opacity-40"} />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {hasil.map((b) => (
            <tr key={b.id} className={b.sorot ? "bg-accent-soft/50" : ""}>
              {kolom.map((k) => <td key={k.kunci} className={k.kanan ? "num text-right" : ""}>{b.sel[k.kunci]?.teks}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Navigasi lengket antar bagian halaman; bagian yang sedang dibaca disorot. */
export function NavSeksi({ bagian }: { bagian: { id: string; label: string }[] }) {
  const [aktif, setAktif] = useState(bagian[0]?.id);
  useEffect(() => {
    // bagian aktif = bagian terakhir yang judulnya sudah melewati bawah navigasi
    let bingkai = 0;
    const cek = () => {
      bingkai = 0;
      const batas = 150;
      let id = bagian[0]?.id;
      for (const b of bagian) { const el = document.getElementById(b.id); if (el && el.getBoundingClientRect().top <= batas) id = b.id; }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) id = bagian[bagian.length - 1]?.id;
      setAktif(id);
    };
    const gulir = () => { if (!bingkai) bingkai = requestAnimationFrame(cek); };
    cek();
    window.addEventListener("scroll", gulir, { passive: true });
    return () => { window.removeEventListener("scroll", gulir); cancelAnimationFrame(bingkai); };
  }, [bagian]);
  return (
    <nav aria-label="Bagian halaman" className="sticky top-[var(--tinggi-nav)] z-30 -mx-4 border-b border-line/70 bg-bg/85 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 2xl:-mx-10 2xl:px-10">
      <ul className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none]">
        {bagian.map((b) => (
          <li key={b.id}>
            <a href={`#${b.id}`} className={`block whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${aktif === b.id ? "bg-navy text-white shadow-sm" : "text-muted hover:bg-white hover:text-ink"}`}>{b.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
