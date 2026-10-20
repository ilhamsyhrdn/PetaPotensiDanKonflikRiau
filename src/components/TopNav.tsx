"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle, BarChart3, ChevronDown, ClipboardList, Database, Gem, LayoutDashboard, LogOut, Map as IkonPeta, MonitorPlay, Network, Newspaper,
} from "lucide-react";
import type { Sesi } from "@/lib/types";
import LogoRiau from "./Logo";
import TombolPerbarui from "./TombolPerbarui";

type Item = { href: string; label: string; ket?: string; ikon: typeof LayoutDashboard; cocok?: string[] };
type Grup = { label: string; ikon: typeof LayoutDashboard; anak: Item[] } | Item;

const MENU: Grup[] = [
  { href: "/", label: "Dashboard", ikon: LayoutDashboard },
  { label: "Peta", ikon: IkonPeta, anak: [
    { href: "/peta/konflik", label: "Peta Konflik", ket: "Di mana saja konflik terjadi", ikon: AlertTriangle, cocok: ["/peta/konflik", "/konflik"] },
    { href: "/peta/potensi", label: "Peta Potensi Ekonomi", ket: "Sebaran sarana usaha", ikon: Gem, cocok: ["/peta/potensi", "/potensi"] },
  ] },
  { label: "Persepsi Publik", ikon: Newspaper, anak: [
    { href: "/berita", label: "Berita", ket: "Berita online dan catatan tim", ikon: Newspaper },
    { href: "/media", label: "Analitik Media", ket: "Nada berita dan topik yang ramai", ikon: BarChart3 },
  ] },
  { label: "Studi", ikon: ClipboardList, anak: [
    { href: "/baseline", label: "Data Baseline", ket: "RPJMD, data statistik, renstra dinas", ikon: ClipboardList },
    { href: "/aktor", label: "Aktor", ket: "Peta aktor hasil social mapping", ikon: Network },
  ] },
  { href: "/presentasi", label: "Presentasi", ikon: MonitorPlay },
  { href: "/kelola", label: "Kelola Data", ikon: Database },
];
const LABEL_PERAN = { admin: "Admin", editor: "Editor", viewer: "Viewer" } as const;

export default function TopNav({ sesi }: { sesi: Sesi }) {
  const path = usePathname();
  const [buka, setBuka] = useState<string | null>(null); // dropdown desktop yang terbuka
  const [menuHp, setMenuHp] = useState(false);
  const [tergulir, setTergulir] = useState(false);
  const [terpasang, setTerpasang] = useState(false);
  const wadah = useRef<HTMLElement>(null);
  const jedaTutup = useRef<ReturnType<typeof setTimeout>>(undefined);

  const aktif = (i: Item) => (i.href === "/" ? path === "/" : (i.cocok ?? [i.href]).some((c) => path.startsWith(c)));
  const grupAktif = (g: Grup) => ("anak" in g ? g.anak.some(aktif) : aktif(g));

  useEffect(() => { setBuka(null); setMenuHp(false); }, [path]);
  useEffect(() => setTerpasang(true), []);
  useEffect(() => {
    const gulir = () => setTergulir(window.scrollY > 8);
    gulir();
    window.addEventListener("scroll", gulir, { passive: true });
    const luar = (e: MouseEvent) => { if (wadah.current && !wadah.current.contains(e.target as Node)) setBuka(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setBuka(null); setMenuHp(false); } };
    document.addEventListener("mousedown", luar);
    document.addEventListener("keydown", esc);
    return () => { window.removeEventListener("scroll", gulir); document.removeEventListener("mousedown", luar); document.removeEventListener("keydown", esc); };
  }, []);
  // kunci gulir di <html>, bukan <body>: html ber-overflow-x clip, jadi overflow body tak lagi diteruskan ke viewport
  // dan body akan menjadi kontainer gulir sendiri (header sticky ikut tergulir hilang)
  useEffect(() => {
    if (!menuHp) return;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = ""; };
  }, [menuHp]);

  const inisial = sesi.nama.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  let urutan = 0; // urutan muncul tiap baris menu HP (efek bertahap)
  const baris = () => ({ className: "menu-item", style: { "--i": urutan++ } as React.CSSProperties });
  const tutup = () => setMenuHp(false);

  return (
    <header ref={wadah} className={`sticky top-0 z-50 text-white transition-[background-color,box-shadow] duration-300 ${menuHp ? "bg-navy" : tergulir ? "bg-navy/95 shadow-[0_6px_24px_rgb(10_20_30/0.35)] backdrop-blur-md" : "bg-navy"}`}>
      <div className="mx-auto flex h-[var(--tinggi-nav)] max-w-[2400px] items-center gap-3 px-4 sm:px-6 2xl:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <LogoRiau />
          <span className="leading-tight">
            <span className="block text-[15px] font-bold">Potensi &amp; Konflik</span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-white/50">SIM · Provinsi Riau</span>
          </span>
        </Link>

        {/* Navigasi desktop */}
        <nav aria-label="Menu utama" className="ml-3 hidden flex-1 items-center gap-0.5 lg:flex xl:ml-6">
          {MENU.map((g) => "anak" in g ? (
            <div key={g.label} className="relative" onMouseEnter={() => setBuka(g.label)} onMouseLeave={() => setBuka(null)}>
              <button aria-expanded={buka === g.label} aria-haspopup="true" onClick={() => setBuka(buka === g.label ? null : g.label)}
                className={`my-2.5 flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-[14px] xl:px-3.5 transition-colors ${grupAktif(g) ? "bg-white/12 font-semibold text-white" : "text-white/70 hover:bg-white/[0.06] hover:text-white"}`}>
                <g.ikon size={16} className="hidden xl:block" /> {g.label} <ChevronDown size={14} className={`transition-transform ${buka === g.label ? "rotate-180" : ""}`} />
              </button>
              {buka === g.label && (
                <div className="anim-turun absolute left-0 top-full w-72 rounded-2xl border border-line bg-surface p-1.5 text-ink shadow-2xl">
                  {g.anak.map((i) => (
                    <Link key={i.href} href={i.href} className={`flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-bg ${aktif(i) ? "bg-accent-soft" : ""}`}>
                      <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${aktif(i) ? "bg-accent text-white" : "bg-bg text-accent"}`}><i.ikon size={16} /></span>
                      <span><span className="block text-sm font-semibold">{i.label}</span><span className="block text-xs text-muted">{i.ket}</span></span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Link key={g.href} href={g.href} aria-current={aktif(g) ? "page" : undefined}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-[14px] xl:px-3.5 transition-colors ${aktif(g) ? "bg-white/12 font-semibold text-white" : "text-white/70 hover:bg-white/[0.06] hover:text-white"}`}>
              <g.ikon size={16} className="hidden xl:block" /> {g.label}
            </Link>
          ))}
          <TombolPerbarui />
        </nav>

        {/* Pengguna (desktop). Panel menempel ke tombol lewat padding (bukan margin) supaya tidak ada celah
            yang membuat menu tertutup saat kursor bergerak ke "Keluar"; penutupan juga diberi jeda singkat. */}
        <div className="relative ml-auto hidden lg:block" onMouseEnter={() => clearTimeout(jedaTutup.current)}
          onMouseLeave={() => { if (buka === "pengguna") jedaTutup.current = setTimeout(() => setBuka((b) => (b === "pengguna" ? null : b)), 250); }}>
          <button onClick={() => setBuka(buka === "pengguna" ? null : "pengguna")} aria-expanded={buka === "pengguna"} aria-haspopup="true"
            className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-white/10 ${buka === "pengguna" ? "bg-white/10" : ""}`}>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#4dabf7] text-xs font-bold text-navy">{inisial}</span>
            <span className="hidden text-left leading-tight xl:block"><span className="block text-[13px] font-semibold">{sesi.nama}</span><span className="block text-[10.5px] text-white/55">{LABEL_PERAN[sesi.peran]}</span></span>
            <ChevronDown size={14} className={`text-white/60 transition-transform ${buka === "pengguna" ? "rotate-180" : ""}`} />
          </button>
          {buka === "pengguna" && (
            <div className="absolute right-0 top-full pt-2">
              <div className="anim-turun w-64 overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-[0_18px_40px_-12px_rgb(10_20_30/0.35)]">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#4dabf7] text-sm font-bold text-navy">{inisial}</span>
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-sm font-semibold">{sesi.nama}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted">@{sesi.username} · {LABEL_PERAN[sesi.peran]}</span>
                  </span>
                </div>
                <div className="border-t border-line p-1.5">
                  <form action="/api/auth/logout" method="post">
                    <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-neg transition-colors hover:bg-neg/10">
                      <LogOut size={16} /> Keluar
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tombol menu HP: tiga garis berubah jadi tanda silang */}
        <button onClick={() => setMenuHp(!menuHp)} aria-expanded={menuHp} aria-controls="menu-hp" aria-label={menuHp ? "Tutup menu" : "Buka menu"}
          className="ml-auto grid h-10 w-10 place-items-center rounded-lg transition-colors hover:bg-white/10 active:bg-white/15 lg:hidden">
          <span aria-hidden className="relative block h-4 w-5">
            <span className={`absolute left-0 top-0 h-0.5 w-5 rounded-full bg-current transition-transform duration-300 ease-out ${menuHp ? "translate-y-[7px] rotate-45" : ""}`} />
            <span className={`absolute left-0 top-[7px] h-0.5 rounded-full bg-current transition-all duration-200 ${menuHp ? "w-0 opacity-0" : "w-3.5"}`} />
            <span className={`absolute left-0 top-[14px] h-0.5 w-5 rounded-full bg-current transition-transform duration-300 ease-out ${menuHp ? "-translate-y-[7px] -rotate-45" : ""}`} />
          </span>
        </button>
      </div>

      {/* Menu HP lewat portal ke body: backdrop-filter header akan menjadi containing block bagi elemen fixed */}
      {terpasang && createPortal(
        <div id="menu-hp" data-buka={menuHp} inert={!menuHp}
          className="menu-hp fixed inset-x-0 bottom-0 top-[var(--tinggi-nav)] z-40 touch-pan-y overflow-y-auto overflow-x-hidden overscroll-contain bg-navy px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-3 text-white lg:hidden">
          {/* dekorasi dibungkus overflow-hidden supaya tidak membuat panel lebih lebar dari layar */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="pola-grid absolute inset-0" />
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgb(77_171_247/0.22),transparent_65%)]" />
          </div>
          <nav aria-label="Menu utama" className="relative space-y-4">
            {MENU.map((g) => "anak" in g ? (
              <div key={g.label}>
                <p {...baris()}><span className="block px-2 pb-1 font-mono text-[10.5px] uppercase tracking-wider text-white/45">{g.label}</span></p>
                {g.anak.map((i) => <div key={i.href} {...baris()}><LinkHp i={i} on={aktif(i)} tutup={tutup} /></div>)}
              </div>
            ) : <div key={g.href} {...baris()}><LinkHp i={g} on={aktif(g)} tutup={tutup} /></div>)}
            <div {...baris()}><TombolPerbarui hp /></div>
          </nav>
          <div {...baris()}>
            <div className="relative mt-6 flex items-center justify-between rounded-xl bg-white/5 px-3 py-3 ring-1 ring-white/10">
              <span className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#4dabf7] text-xs font-bold text-navy">{inisial}</span>
                <span className="leading-tight"><span className="block text-sm font-semibold">{sesi.nama}</span><span className="block text-xs text-white/55">{LABEL_PERAN[sesi.peran]} · {sesi.username}</span></span>
              </span>
              <form action="/api/auth/logout" method="post"><button className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm transition active:scale-95"><LogOut size={15} /> Keluar</button></form>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </header>
  );
}

function LinkHp({ i, on, tutup }: { i: Item; on: boolean; tutup: () => void }) {
  return (
    <Link href={i.href} onClick={tutup} aria-current={on ? "page" : undefined}
      className={`relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-3 text-[15px] transition-[background-color,transform] duration-150 active:scale-[0.98] ${on ? "bg-white/12 font-semibold" : "text-white/80 active:bg-white/10"}`}>
      {on && <span aria-hidden className="absolute inset-y-2.5 left-0 w-1 rounded-r-full bg-[#4dabf7]" />}
      <span className={`grid h-9 w-9 place-items-center rounded-lg transition-colors ${on ? "bg-[#4dabf7] text-navy" : "bg-white/8"}`}><i.ikon size={18} /></span>
      <span><span className="block">{i.label}</span>{i.ket && <span className="block text-xs font-normal text-white/50">{i.ket}</span>}</span>
    </Link>
  );
}
