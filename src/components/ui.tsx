import Link from "next/link";
import { Info, Lightbulb, Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import type { Sentimen } from "@/lib/types";
import { WARNA_SENTIMEN } from "@/lib/format";
import { Angka } from "./Efek";

export function Chip({ warna, children }: { warna: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: warna + "1a", color: warna }}>
      {children}
    </span>
  );
}

export const ChipSentimen = ({ s }: { s: Sentimen }) => <Chip warna={WARNA_SENTIMEN[s]}>{s[0].toUpperCase() + s.slice(1)}</Chip>;

/** Ikon (i) kecil dengan penjelasan istilah saat disorot atau difokus. */
export function InfoTip({ teks }: { teks: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button type="button" aria-label={teks} className="grid h-5 w-5 place-items-center rounded-full text-muted/70 transition hover:text-accent focus:text-accent focus:outline-none">
        <Info size={14} />
      </button>
      <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 w-60 -translate-x-1/2 rounded-lg bg-navy px-3 py-2 text-[12px] font-normal normal-case leading-relaxed tracking-normal text-white opacity-0 shadow-xl transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
        {teks}
      </span>
    </span>
  );
}

export function Kartu({ judul, sub, info, ikon: Ikon, warna = "#2f6690", aksi, children, className = "", rapat = false }: {
  judul?: React.ReactNode; sub?: React.ReactNode; info?: string; ikon?: LucideIcon; warna?: string;
  aksi?: React.ReactNode; children: React.ReactNode; className?: string; rapat?: boolean;
}) {
  return (
    <section className={`card flex min-w-0 flex-col ${className}`}>
      {judul && (
        <header className={`flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-5 pt-4 ${rapat ? "border-b border-line pb-3.5" : "pb-1"}`}>
          <div className="flex min-w-0 items-start gap-3">
            {Ikon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: warna + "14", color: warna }}><Ikon size={17} /></span>}
            <div className="min-w-0">
              <h2 className="flex items-center gap-1 text-[15px] font-semibold leading-snug">{judul}{info && <InfoTip teks={info} />}</h2>
              {sub && <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{sub}</p>}
            </div>
          </div>
          {aksi && <div className="flex shrink-0 items-center">{aksi}</div>}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${rapat ? "" : `flex flex-col ${judul ? "px-5 pb-5 pt-3" : "p-5"}`}`}>{children}</div>
    </section>
  );
}

/** Tautan kecil di pojok kartu ("Lihat semua →"). */
export function TautanKartu({ href, children, warna }: { href: string; children: React.ReactNode; warna?: string }) {
  return (
    <Link href={href} className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-accent transition hover:bg-accent-soft" style={warna ? { color: warna } : undefined}>
      {children} →
    </Link>
  );
}

/** Satu kalimat penjelas di bawah grafik, supaya pembaca langsung tahu maksudnya. */
export function Catatan({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-auto pt-4">
      <p className="flex gap-2.5 rounded-xl bg-[#f3f7fb] px-3.5 py-2.5 text-[13px] leading-relaxed text-ink/85">
        <Lightbulb size={16} className="mt-0.5 shrink-0 text-[#e8a100]" />
        <span>{children}</span>
      </p>
    </div>
  );
}

export function BarHorizontal({ data, warna, lebarLabel = 130 }: { data: { label: string; nilai: number; warna?: string; href?: string }[]; warna?: string; lebarLabel?: number }) {
  const maks = Math.max(1, ...data.map((d) => d.nilai));
  return (
    <ul className="space-y-2.5">
      {data.map((d) => {
        const isi = (
          <>
            <span className="truncate text-ink/85" title={d.label}>{d.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-[#eef2f6]">
              <span className="block h-full rounded-full" style={{ width: `${(d.nilai / maks) * 100}%`, background: d.warna ?? warna ?? "#2f6690" }} />
            </span>
            <span className="num text-right font-semibold">{d.nilai.toLocaleString("id-ID")}</span>
          </>
        );
        const gaya = { gridTemplateColumns: `${lebarLabel}px 1fr 38px` };
        return (
          <li key={d.label}>
            {d.href
              ? <Link href={d.href} className="grid items-center gap-3 rounded-md text-[13px] hover:text-accent" style={gaya}>{isi}</Link>
              : <span className="grid items-center gap-3 text-[13px]" style={gaya}>{isi}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export function IndeksPill({ nilai, ada }: { nilai: number; ada: boolean }) {
  if (!ada) return <span className="text-xs text-muted">–</span>;
  const w = nilai <= -15 ? "#c92a2a" : nilai >= 15 ? "#2f9e44" : "#5b6b7c";
  return <span className="num inline-block min-w-12 rounded-full px-2 py-0.5 text-center text-xs font-semibold" style={{ background: w + "1a", color: w }}>{nilai > 0 ? "+" : ""}{nilai}</span>;
}

/** Label sumber data di pojok kartu, supaya jelas mana data terbuka dan mana data contoh. */
export function LabelSumber({ teks, contoh = false }: { teks: string; contoh?: boolean }) {
  return <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${contoh ? "bg-amber-100 text-amber-800" : "bg-[#eef2f6] text-muted"}`}>{teks}</span>;
}

/** Garis tren mini (SVG statis). */
export function Sparkline({ data, warna, tinggi = 34 }: { data: number[]; warna: string; tinggi?: number }) {
  if (data.length < 2) return null;
  const w = 120, maks = Math.max(1, ...data), min = Math.min(...data);
  const y = (v: number) => tinggi - 3 - ((v - min) / Math.max(1, maks - min)) * (tinggi - 6);
  const titik = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${y(v).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${w} ${tinggi}`} preserveAspectRatio="none" className="h-[34px] w-full" aria-hidden>
      <path d={`M0,${tinggi} L${titik.join(" L")} L${w},${tinggi} Z`} fill={warna} opacity=".1" />
      <polyline points={titik.join(" ")} fill="none" stroke={warna} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export type Delta = { teks: string; arah: "naik" | "turun" | "tetap"; baik?: boolean };

export function LencanaDelta({ teks, arah, baik }: Delta) {
  const Ikon = arah === "naik" ? TrendingUp : arah === "turun" ? TrendingDown : Minus;
  const w = baik === undefined || arah === "tetap" ? "#5b6b7c" : baik ? "#2f9e44" : "#e03131";
  return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: w + "14", color: w }}><Ikon size={13} />{teks}</span>;
}

/** Kartu angka utama: ikon, angka besar, perubahan, garis tren, dan keterangan singkat. */
export function KartuAngka({ label, nilai, akhiran, ikon: Ikon, warna, ket, delta, tren, komposisi, href }: {
  label: string; nilai: number; akhiran?: string; ikon: LucideIcon; warna: string; ket: string; delta?: Delta; tren?: number[];
  komposisi?: { label: string; nilai: number; warna: string }[]; href?: string;
}) {
  const total = komposisi?.reduce((n, k) => n + k.nilai, 0) ?? 0;
  const isi = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: warna + "16", color: warna }}><Ikon size={19} /></span>
        {delta && <LencanaDelta {...delta} />}
      </div>
      <p className="mt-3 text-[13px] font-medium text-muted">{label}</p>
      <p className="text-[30px] font-bold leading-tight tracking-tight"><Angka nilai={nilai} akhiran={akhiran} /></p>
      {tren && <div className="mt-1"><Sparkline data={tren} warna={warna} /></div>}
      {komposisi && total > 0 && (
        <div className="mt-1 flex h-[34px] items-center" title={komposisi.map((k) => `${k.label}: ${k.nilai}`).join("\n")}>
          <span className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full">
            {komposisi.filter((k) => k.nilai).map((k) => <span key={k.label} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(k.nilai / total) * 100}%`, background: k.warna }} />)}
          </span>
        </div>
      )}
      <p className="mt-1 text-[12.5px] leading-snug text-muted">{ket}</p>
    </>
  );
  return href
    ? <Link href={href} className="card card-angkat block p-4 sm:p-5">{isi}</Link>
    : <div className="card p-4 sm:p-5">{isi}</div>;
}

/** Persentase nada berita bulan ini dibanding 30 hari sebelumnya. */
export function BandingBulan({ kini, lalu }: { kini: Record<Sentimen | "total", number>; lalu: Record<Sentimen | "total", number> }) {
  if (!lalu.total || !kini.total) return null;
  const p = (r: Record<Sentimen | "total", number>, s: Sentimen) => Math.round((r[s] / r.total) * 100);
  return (
    <div className="mt-5">
      <p className="mb-2 text-[12.5px] font-semibold text-ink/80">Dibanding bulan lalu</p>
      <div className="grid grid-cols-3 gap-2">
        {(["negatif", "netral", "positif"] as const).map((s) => {
          const a = p(lalu, s), b = p(kini, s), d = b - a;
          return (
            <div key={s} className="rounded-xl bg-[#f6f8fb] px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[12px] text-muted"><span className="h-2 w-2 rounded-full" style={{ background: s === "netral" ? "#adb5bd" : WARNA_SENTIMEN[s] }} />{s[0].toUpperCase() + s.slice(1)}</p>
              <p className="num mt-0.5 text-[13px] text-muted">{a}% <span className="text-ink/40">→</span> <b className="text-[15px] text-ink">{b}%</b></p>
              <div className="mt-1"><LencanaDelta teks={`${Math.abs(d)} poin`} arah={d > 0 ? "naik" : d < 0 ? "turun" : "tetap"} baik={s === "netral" ? undefined : s === "negatif" ? d < 0 : d > 0} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Judul bagian di halaman panjang (dashboard). */
export function JudulSeksi({ id, ikon: Ikon, warna, judul, sub, aksi }: { id: string; ikon: LucideIcon; warna: string; judul: string; sub?: string; aksi?: React.ReactNode }) {
  return (
    <div id={id} className="flex scroll-mt-[calc(var(--tinggi-nav)+64px)] flex-wrap items-end justify-between gap-3 pt-6">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl text-white shadow-sm" style={{ background: warna }}><Ikon size={19} /></span>
        <div>
          <h2 className="text-xl font-bold tracking-tight">{judul}</h2>
          {sub && <p className="text-[13.5px] text-muted">{sub}</p>}
        </div>
      </div>
      {aksi}
    </div>
  );
}
