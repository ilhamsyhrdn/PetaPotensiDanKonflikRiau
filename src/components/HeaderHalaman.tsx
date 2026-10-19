import { Parallax } from "./Efek";

/** Pita judul halaman: biru tua berpola kontur (parallax ringan), judul, keterangan, dan aksi di kanan. */
export default function HeaderHalaman({ eyebrow, judul, keterangan, children }: {
  eyebrow?: string; judul: string; keterangan?: string; children?: React.ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-navy text-white">
      <Parallax kecepatan={0.22} className="pola-grid absolute -inset-x-10 -top-10 bottom-[-120px] -z-10"><span /></Parallax>
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(900px_320px_at_90%_0%,rgb(47_102_144/0.55),transparent_65%),radial-gradient(500px_260px_at_0%_120%,rgb(122_88_163/0.25),transparent_70%)]" />
      <div className="mx-auto flex max-w-[2400px] flex-wrap items-end justify-between gap-x-6 gap-y-4 px-4 pb-7 pt-6 sm:px-6 2xl:px-10 sm:pb-8 sm:pt-8">
        <div className="min-w-0">
          {eyebrow && <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium text-white/80 ring-1 ring-white/15">{eyebrow}</p>}
          <h1 className="mt-3 text-[26px] font-extrabold leading-tight tracking-tight text-balance sm:text-[32px]">{judul}</h1>
          {keterangan && <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-white/70">{keterangan}</p>}
        </div>
        {children && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{children}</div>}
      </div>
    </section>
  );
}
