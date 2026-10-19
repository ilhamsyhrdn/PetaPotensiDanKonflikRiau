"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, BarChart3, ChevronDown, Database, Gem, LayoutDashboard, LogOut, Map as IkonPeta, Menu, MonitorPlay, Network, Newspaper, X,
} from "lucide-react";
import type { Sesi } from "@/lib/types";
import LogoRiau from "./Logo";

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
  { href: "/aktor", label: "Aktor", ikon: Network },
  { href: "/presentasi", label: "Presentasi", ikon: MonitorPlay },
  { href: "/kelola", label: "Kelola Data", ikon: Database },
];
const LABEL_PERAN = { admin: "Admin", editor: "Editor", viewer: "Viewer" } as const;

export default function TopNav({ sesi }: { sesi: Sesi }) {
  const path = usePathname();
  const [buka, setBuka] = useState<string | null>(null); // dropdown desktop yang terbuka
  const [menuHp, setMenuHp] = useState(false);
  const [tergulir, setTergulir] = useState(false);
  const wadah = useRef<HTMLElement>(null);

  const aktif = (i: Item) => (i.href === "/" ? path === "/" : (i.cocok ?? [i.href]).some((c) => path.startsWith(c)));
  const grupAktif = (g: Grup) => ("anak" in g ? g.anak.some(aktif) : aktif(g));

  useEffect(() => { setBuka(null); setMenuHp(false); }, [path]);
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
  useEffect(() => { document.body.style.overflow = menuHp ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [menuHp]);

  const inisial = sesi.nama.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    // backdrop-filter membuat header jadi containing block bagi elemen `fixed`, jadi dimatikan saat menu HP terbuka
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
        <nav aria-label="Menu utama" className="ml-6 hidden flex-1 items-center gap-0.5 lg:flex">
          {MENU.map((g) => "anak" in g ? (
            <div key={g.label} className="relative" onMouseEnter={() => setBuka(g.label)} onMouseLeave={() => setBuka(null)}>
              <button aria-expanded={buka === g.label} aria-haspopup="true" onClick={() => setBuka(buka === g.label ? null : g.label)}
                className={`my-2.5 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] transition-colors ${grupAktif(g) ? "bg-white/12 font-semibold text-white" : "text-white/70 hover:bg-white/[0.06] hover:text-white"}`}>
                <g.ikon size={16} /> {g.label} <ChevronDown size={14} className={`transition-transform ${buka === g.label ? "rotate-180" : ""}`} />
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
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] transition-colors ${aktif(g) ? "bg-white/12 font-semibold text-white" : "text-white/70 hover:bg-white/[0.06] hover:text-white"}`}>
              <g.ikon size={16} /> {g.label}
            </Link>
          ))}
        </nav>

        {/* Pengguna (desktop) */}
        <div className="relative ml-auto hidden lg:block" onMouseLeave={() => buka === "pengguna" && setBuka(null)}>
          <button onClick={() => setBuka(buka === "pengguna" ? null : "pengguna")} aria-expanded={buka === "pengguna"} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 hover:bg-white/10">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#4dabf7] text-xs font-bold text-navy">{inisial}</span>
            <span className="text-left leading-tight"><span className="block text-[13px] font-semibold">{sesi.nama}</span><span className="block text-[10.5px] text-white/55">{LABEL_PERAN[sesi.peran]}</span></span>
            <ChevronDown size={14} className="text-white/60" />
          </button>
          {buka === "pengguna" && (
            <div className="anim-turun absolute right-0 top-full mt-1 w-56 rounded-xl border border-line bg-surface p-1.5 text-ink shadow-2xl">
              <p className="px-3 py-2 text-xs text-muted">Masuk sebagai <b className="text-ink">{sesi.username}</b> ({LABEL_PERAN[sesi.peran]})</p>
              <form action="/api/auth/logout" method="post"><button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-bg"><LogOut size={15} /> Keluar</button></form>
            </div>
          )}
        </div>

        {/* Tombol menu HP */}
        <button onClick={() => setMenuHp(!menuHp)} aria-expanded={menuHp} aria-label={menuHp ? "Tutup menu" : "Buka menu"} className="ml-auto grid h-10 w-10 place-items-center rounded-lg hover:bg-white/10 lg:hidden">
          {menuHp ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Menu HP */}
      {menuHp && (
        <div className="anim-turun fixed inset-x-0 bottom-0 top-[var(--tinggi-nav)] overflow-y-auto bg-navy px-4 pb-8 pt-2 lg:hidden">
          <nav aria-label="Menu utama" className="space-y-4">
            {MENU.map((g) => "anak" in g ? (
              <div key={g.label}>
                <p className="px-2 pb-1 font-mono text-[10.5px] uppercase tracking-wider text-white/45">{g.label}</p>
                {g.anak.map((i) => <LinkHp key={i.href} i={i} on={aktif(i)} />)}
              </div>
            ) : <LinkHp key={g.href} i={g} on={aktif(g)} />)}
          </nav>
          <div className="mt-6 flex items-center justify-between rounded-xl bg-white/5 px-3 py-3">
            <span className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#4dabf7] text-xs font-bold text-navy">{inisial}</span>
              <span className="leading-tight"><span className="block text-sm font-semibold">{sesi.nama}</span><span className="block text-xs text-white/55">{LABEL_PERAN[sesi.peran]} · {sesi.username}</span></span>
            </span>
            <form action="/api/auth/logout" method="post"><button className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm"><LogOut size={15} /> Keluar</button></form>
          </div>
        </div>
      )}
    </header>
  );
}

function LinkHp({ i, on }: { i: Item; on: boolean }) {
  return (
    <Link href={i.href} aria-current={on ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] ${on ? "bg-white/12 font-semibold" : "text-white/80 active:bg-white/10"}`}>
      <span className={`grid h-9 w-9 place-items-center rounded-lg ${on ? "bg-[#4dabf7] text-navy" : "bg-white/8"}`}><i.ikon size={18} /></span>
      <span><span className="block">{i.label}</span>{i.ket && <span className="block text-xs font-normal text-white/50">{i.ket}</span>}</span>
    </Link>
  );
}
