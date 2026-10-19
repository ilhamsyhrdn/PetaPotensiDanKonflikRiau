import Link from "next/link";
import { AlertTriangle, Gem, MonitorPlay } from "lucide-react";
import siluet from "@/data/riau-siluet.json";
import { Parallax } from "./Efek";

/**
 * Hero dashboard: judul, tombol utama, dan siluet Riau berisi titik konflik & potensi (lapisan parallax).
 * Kartu angka ditaruh di luar hero dan menumpang ke bawahnya, jadi hero diberi ruang bawah ekstra.
 */
export default function HeroRiau({ judul, label, keterangan, konflik, potensi, aksi, samping, wilayah }: {
  judul: string; label: string; keterangan: string; konflik: [number, number][]; potensi: [number, number][]; aksi?: React.ReactNode;
  /** Wilayah fokus yang dibawa tombol peta. */
  wilayah?: string;
  /** Panel tambahan yang hanya muncul di layar sangat lebar, di antara teks dan siluet. */
  samping?: React.ReactNode;
}) {
  const [minX, , maxX, maxY] = siluet.batas as number[];
  const k = siluet.lebar / (maxX - minX);
  const xy = ([x, y]: [number, number]) => [Math.round((x - minX) * k), Math.round((maxY - y) * k)];
  // Semua titik digabung jadi satu <path> per lapisan: ribuan <circle> membuat HTML & payload RSC membengkak
  const lingkaran = (pts: [number, number][], r: number) =>
    pts.map((p) => { const [x, y] = xy(p); return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`; }).join("");

  return (
    <section className="relative isolate overflow-hidden bg-navy text-white">
      <Parallax kecepatan={0.15} className="pola-grid absolute -inset-x-10 -top-20 bottom-[-160px] -z-10"><span /></Parallax>
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(900px_480px_at_80%_0%,rgb(47_102_144/0.6),transparent_62%),radial-gradient(640px_380px_at_0%_100%,rgb(162_58_28/0.32),transparent_70%)]" />

      <div className="mx-auto grid max-w-[2400px] items-center gap-6 px-4 pb-24 pt-8 sm:px-6 2xl:px-10 lg:grid-cols-[1.3fr_1fr] lg:pb-28 lg:pt-10 3xl:grid-cols-[1.1fr_1fr_0.8fr]">
        <div className="relative z-10">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12.5px] font-medium text-white/80 ring-1 ring-white/15 backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#69db7c]" />{label}
          </p>
          <h1 className="mt-4 max-w-2xl text-[30px] font-extrabold leading-[1.1] tracking-tight text-balance sm:text-[44px]">{judul}</h1>
          <p className="mt-3 max-w-xl text-[15.5px] leading-relaxed text-white/70">{keterangan}</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href={`/peta/konflik${wilayah ? `?w=${wilayah}` : ""}`} className="flex items-center gap-2 rounded-xl bg-[#c2410c] px-4 py-2.5 text-sm font-semibold shadow-lg shadow-black/25 transition hover:-translate-y-0.5 hover:bg-[#d4521b]"><AlertTriangle size={16} /> Peta konflik</Link>
            <Link href={`/peta/potensi${wilayah ? `?w=${wilayah}` : ""}`} className="flex items-center gap-2 rounded-xl bg-[#2f6690] px-4 py-2.5 text-sm font-semibold shadow-lg shadow-black/25 transition hover:-translate-y-0.5 hover:bg-[#3873a0]"><Gem size={16} /> Peta potensi ekonomi</Link>
            <Link href="/presentasi" className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold ring-1 ring-white/15 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15"><MonitorPlay size={16} /> Mode presentasi</Link>
          </div>
          {aksi && <div className="mt-5 w-full max-w-md">{aksi}</div>}
        </div>

        {samping && <div className="relative z-10 hidden 3xl:block">{samping}</div>}

        <Parallax kecepatan={-0.06} className="relative mx-auto hidden w-full max-w-[360px] lg:block xl:max-w-[400px]">
          <svg viewBox={`0 0 ${siluet.lebar} ${siluet.tinggi}`} className="h-auto w-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.45)]" role="img" aria-label="Siluet Provinsi Riau dengan titik konflik dan potensi ekonomi">
            <defs>
              <linearGradient id="isi-kab" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2f6690" stopOpacity=".55" /><stop offset="1" stopColor="#1c2f40" stopOpacity=".9" /></linearGradient>
              <filter id="kabur-konflik" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="6" /></filter>
            </defs>
            {siluet.kab.map((kb) => (
              <path key={kb.id} d={kb.d} fill={kb.studi ? "url(#isi-kab)" : "rgb(143 184 216 / 0.12)"} stroke="#8fb8d8" strokeOpacity=".55" strokeWidth="2.2" strokeLinejoin="round" />
            ))}
            <path d={lingkaran(potensi, 4)} fill="#74c0fc" opacity=".7" />
            <path d={lingkaran(konflik, 14)} fill="#ff8a5c" opacity=".75" filter="url(#kabur-konflik)" />
            <path d={lingkaran(konflik, 6)} fill="#ff9b70" stroke="#0f1b27" strokeWidth="2.6" paintOrder="stroke" />
          </svg>
          <div className="pointer-events-none absolute bottom-0 right-0 flex gap-3.5 rounded-full bg-navy/70 px-3.5 py-1.5 text-[11.5px] text-white/75 ring-1 ring-white/10 backdrop-blur">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#ff8a5c]" />konflik</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#74c0fc]" />potensi</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-[#2f6690]" />kabupaten desa studi</span>
          </div>
        </Parallax>
      </div>
    </section>
  );
}
