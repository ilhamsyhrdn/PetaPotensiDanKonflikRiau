import { DESA_STUDI, KABUPATEN, WILAYAH } from "@/lib/wilayah";
import siluet from "@/data/riau-siluet.json";
import Logo from "@/components/Logo";
import LoginForm from "./LoginForm";

export const metadata = { title: "Masuk · Dashboard Potensi Ekonomi & Peta Konflik" };

const STAT = [
  { l: "Kabupaten/kota", n: KABUPATEN.length },
  { l: "Kecamatan", n: WILAYAH.filter((w) => w.level === "kecamatan").length },
  { l: "Desa/kelurahan", n: WILAYAH.filter((w) => w.level === "desa").length },
  { l: "Desa studi SIM", n: DESA_STUDI.length },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ lanjut?: string }> }) {
  const { lanjut } = await searchParams;
  return (
    <main className="grid min-h-dvh bg-bg lg:grid-cols-[1.15fr_1fr]">
      {/* Panel kiri (desktop) / pita atas (HP) */}
      <section className="relative isolate flex flex-col justify-between gap-8 overflow-hidden bg-navy px-5 pb-10 pt-6 text-white sm:px-8 lg:p-12">
        <div aria-hidden className="pola-kontur absolute inset-0 -z-10" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(900px_420px_at_90%_0%,rgb(47_102_144/0.55),transparent_60%),radial-gradient(600px_380px_at_0%_100%,rgb(162_58_28/0.3),transparent_70%)]" />
        <svg aria-hidden viewBox={`0 0 ${siluet.lebar} ${siluet.tinggi}`} className="anim-muncul pointer-events-none absolute -right-[12%] top-[46%] -z-10 hidden h-[66%] -translate-y-1/2 opacity-70 lg:block">
          {siluet.kab.map((k) => (
            <path key={k.id} d={k.d} fill={k.studi ? "rgb(47 102 144 / 0.55)" : "rgb(143 184 216 / 0.08)"} stroke="#8fb8d8" strokeOpacity=".5" strokeWidth="2.2" strokeLinejoin="round" />
          ))}
        </svg>
        <div aria-hidden className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-navy via-navy/75 to-transparent lg:block" />

        <div className="flex items-center gap-3">
          <Logo ukuran={38} />
          <span className="leading-tight">
            <span className="block font-bold">Potensi &amp; Konflik</span>
            <span className="block font-mono text-[10.5px] uppercase tracking-[0.08em] text-white/55">SIM · Provinsi Riau</span>
          </span>
        </div>

        <div className="max-w-md space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#8fb8d8]">Studi Social Intelligence Mapping · PHR</p>
          <h1 className="text-[28px] font-bold leading-[1.15] text-balance sm:text-4xl">Dashboard Potensi Ekonomi &amp; Peta Konflik</h1>
          <p className="text-[15px] leading-relaxed text-white/70">
            Sebaran potensi ekonomi, titik konflik, jejaring aktor, dan persepsi publik di seluruh Provinsi Riau, dengan fokus pada enam desa studi.
          </p>
        </div>

        <dl className="grid max-w-lg grid-cols-4 gap-3 sm:gap-6">
          {STAT.map((s) => (
            <div key={s.l} className="flex flex-col-reverse">
              <dt className="text-[11px] leading-snug text-white/55 sm:text-xs">{s.l}</dt>
              <dd className="num text-xl font-bold sm:text-2xl">{s.n.toLocaleString("id-ID")}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex items-start justify-center px-5 py-8 sm:px-8 lg:items-center lg:py-12">
        <div className="anim-muncul w-full max-w-sm space-y-7">
          <div className="space-y-1.5">
            <p className="eyebrow">Akses terbatas</p>
            <h2 className="text-2xl font-bold">Masuk ke dashboard</h2>
            <p className="text-sm text-muted">Akun dibuat oleh admin. Tidak ada pendaftaran terbuka.</p>
          </div>

          <LoginForm lanjut={lanjut} />

          <div className="rounded-xl border border-dashed border-line bg-surface p-4 text-sm">
            <p className="text-xs leading-relaxed text-muted">
              Konflik, potensi, dan berita diambil dari sumber terbuka (OpenStreetMap, Google News, GDELT, dan data sekunder). Data aktor dan media sosial masih contoh.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
