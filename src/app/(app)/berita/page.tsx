import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, Flame, Search, X } from "lucide-react";
import WilayahFilter from "@/components/WilayahFilter";
import HeaderHalaman from "@/components/HeaderHalaman";
import { Gambar, KartuSamping } from "@/components/Detail";
import { ChipSentimen } from "@/components/ui";
import { bacaDb } from "@/lib/db";
import { ISU_MEDIA, warnaIsu, warnaSektorKonflik } from "@/lib/kategori";
import { WARNA_SENTIMEN, geserHari, hariIni, persen, potong, ringkasSentimen, tanggal, tanggalPendek } from "@/lib/format";
import { cakupan, dalamWilayah, labelWilayah } from "@/lib/wilayah";
import { deteksiLetupan } from "@/lib/letupan";
import type { Sentimen } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Berita & Informasi · Dashboard Potensi Ekonomi & Peta Konflik" };

const PER_HAL = 20;

type Param = { q?: string; s?: string; isu?: string; tipe?: string; w?: string; hal?: string; dari?: string; sampai?: string };
const TGL = /^\d{4}-\d{2}-\d{2}$/;

export default async function BeritaPage({ searchParams }: { searchParams: Promise<Param> }) {
  const sp = await searchParams;
  const db = await bacaDb();
  const q = (sp.q ?? "").trim().toLowerCase();
  const c = cakupan(sp.w);
  const semua = db.media.filter((m) => dalamWilayah(m.wilayahId, c.berita));
  const dari = TGL.test(sp.dari ?? "") ? sp.dari : undefined, sampai = TGL.test(sp.sampai ?? "") ? sp.sampai : undefined;
  const hasil = semua.filter((m) => (!sp.tipe || m.tipe === sp.tipe) && (!sp.s || m.sentimen === sp.s) && (!sp.isu || m.isu === sp.isu)
    && (!dari || m.tanggal >= dari) && (!sampai || m.tanggal <= sampai)
    && (!q || `${m.judul} ${m.ringkasan} ${m.sumber}`.toLowerCase().includes(q)));
  const hal = Math.max(1, Math.min(Math.ceil(hasil.length / PER_HAL) || 1, Number(sp.hal) || 1));
  const tampil = hasil.slice((hal - 1) * PER_HAL, hal * PER_HAL);
  const url = (ubah: Partial<Param>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, hal: undefined, ...ubah }).filter(([, v]) => v) as [string, string][]);
    return `/berita${p.size ? "?" + p : ""}`;
  };

  const b30 = geserHari(hariIni(), -30);
  const r30 = ringkasSentimen(semua.filter((m) => m.tanggal >= b30));
  const letupan = [...deteksiLetupan(semua, "negatif", geserHari(hariIni(), -90), hariIni()), ...deteksiLetupan(semua, "positif", geserHari(hariIni(), -90), hariIni())]
    .sort((a, b) => (a.sampai < b.sampai ? 1 : -1)).slice(0, 4);
  const konflik = db.konflik.filter((k) => dalamWilayah(k.wilayahId, c.titik)).sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1)).slice(0, 7);
  const perIsu = ISU_MEDIA.map((i) => ({ i, n: semua.filter((m) => m.isu === i && m.tanggal >= b30).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  const maksIsu = Math.max(1, ...perIsu.map((x) => x.n));

  return (
    <>
    <HeaderHalaman eyebrow={sp.w ? labelWilayah(sp.w) : "Seluruh Provinsi Riau"} judul="Berita"
      keterangan={c.catatan ?? "Berita online soal perusahaan dan isu di Riau, ditambah catatan yang ditulis tim."}>
      <form action="/berita" className="flex w-full min-w-0 items-center gap-1.5 sm:w-auto">
        {Object.entries(sp).filter(([k, v]) => v && k !== "q" && k !== "hal").map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <label htmlFor="q" className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm backdrop-blur">
          <Search size={15} className="shrink-0 text-[#8fb8d8]" /><input id="q" name="q" defaultValue={sp.q} placeholder="Kata kunci" className="w-full min-w-0 bg-transparent text-white outline-none placeholder:text-white/50 sm:w-44" />
        </label>
        <button className="shrink-0 rounded-lg bg-[#4dabf7] px-3 py-1.5 text-sm font-semibold text-navy">Tampilkan</button>
        {(sp.q || sp.s || sp.isu || sp.tipe || dari || sampai) && <Link href={url({ q: undefined, s: undefined, isu: undefined, tipe: undefined, dari: undefined, sampai: undefined })} aria-label="Hapus filter" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10"><X size={15} /></Link>}
      </form>
      <Suspense><WilayahFilter gelap penuh /></Suspense>
    </HeaderHalaman>
    <div className="mx-auto max-w-[2400px] px-4 py-4 sm:px-6 2xl:px-10">
      <div className="-mx-4 mb-3 flex items-center gap-2 overflow-x-auto px-4 pb-1 text-sm sm:mx-0 sm:flex-wrap sm:px-0">
        {([["", "Semua"], ["berita", "Berita online"], ["sosmed", "Media sosial"]] as const).map(([v, l]) => (
          <Link key={v} href={url({ tipe: v || undefined })} className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 ${(sp.tipe ?? "") === v ? "border-navy bg-navy text-white" : "border-line bg-surface text-muted hover:text-ink"}`}>{l}</Link>
        ))}
        <span className="mx-1 h-5 w-px bg-line" />
        {(["negatif", "netral", "positif"] as Sentimen[]).map((s) => (
          <Link key={s} href={url({ s: sp.s === s ? undefined : s })} className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 capitalize"
            style={sp.s === s ? { background: WARNA_SENTIMEN[s], borderColor: WARNA_SENTIMEN[s], color: "#fff" } : { borderColor: "#dde3ea", color: WARNA_SENTIMEN[s], background: "#fff" }}>
            <span className="h-2 w-2 rounded-full" style={{ background: sp.s === s ? "#fff" : WARNA_SENTIMEN[s] }} />{s}
          </Link>
        ))}
        {sp.isu && <Link href={url({ isu: undefined })} className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-accent-soft px-3 py-1 text-accent">Isu: {sp.isu} <X size={13} /></Link>}
        {(dari || sampai) && (
          <Link href={url({ dari: undefined, sampai: undefined })} className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-accent-soft px-3 py-1 text-accent">
            {dari && sampai ? (dari === sampai ? tanggal(dari) : `${tanggalPendek(dari)} – ${tanggal(sampai)}`) : dari ? `Sejak ${tanggal(dari)}` : `Sampai ${tanggal(sampai!)}`} <X size={13} />
          </Link>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px] 3xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="grid min-w-0 content-start gap-2.5 3xl:grid-cols-2">
          {tampil.map((m) => (
            <article key={m.id} className="card muncul-gulir flex gap-3 p-3 transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md sm:gap-4">
              <Link href={`/berita/${encodeURIComponent(m.id)}`} className="shrink-0"><Gambar media={m} className="h-[64px] w-[84px] rounded-xl sm:h-[76px] sm:w-[112px]" /></Link>
              <div className="min-w-0 flex-1">
                <Link href={`/berita/${encodeURIComponent(m.id)}`} className="line-clamp-3 text-[14.5px] font-semibold leading-snug hover:text-accent sm:line-clamp-2 sm:text-[15.5px]">{m.judul}</Link>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="inline-flex items-center gap-1 rounded bg-[#4dabf7] px-1.5 py-0.5 font-semibold text-white"><CalendarDays size={11} />{tanggal(m.tanggal)}</span>
                  <span className="max-w-[140px] truncate rounded bg-[#495057] px-1.5 py-0.5 font-semibold text-white">{m.sumber}</span>
                  <ChipSentimen s={m.sentimen} />
                  <Link href={url({ isu: m.isu })} className="hidden rounded-full px-2 py-0.5 font-semibold sm:inline" style={{ background: warnaIsu(m.isu) + "1a", color: warnaIsu(m.isu) }}>{m.isu}</Link>
                  {m.asal === "Contoh" && <span className="rounded bg-amber-200 px-1.5 py-0.5 font-semibold text-amber-900">CONTOH</span>}
                  <span className="hidden text-muted sm:inline">· {labelWilayah(m.wilayahId)}</span>
                </div>
                {(m.isi || m.ringkasan) && <p className="mt-1.5 hidden text-[13.5px] leading-relaxed text-ink/80 sm:line-clamp-2">{potong(m.isi || m.ringkasan, 260)}</p>}
                <Link href={`/berita/${encodeURIComponent(m.id)}`} className="mt-1.5 hidden text-[12.5px] font-semibold text-accent hover:underline sm:inline-block">Baca selengkapnya →</Link>
              </div>
            </article>
          ))}
          {!tampil.length && <p className="card p-8 text-center text-sm text-muted">Belum ketemu berita yang cocok. Coba kata kunci lain atau longgarkan filternya.</p>}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-sm text-[#1c7ed6]">Menampilkan {hasil.length ? (hal - 1) * PER_HAL + 1 : 0}–{Math.min(hal * PER_HAL, hasil.length)} dari {hasil.length} berita</p>
            <Halaman hal={hal} total={Math.ceil(hasil.length / PER_HAL)} url={(n) => { const u = url({}); return `${u}${u.includes("?") ? "&" : "?"}hal=${n}`; }} />
          </div>
        </section>

        <aside className="space-y-4">
          <KartuSamping judul="Nada berita, 30 hari" aksi={<Link href={`/media${sp.w ? `?w=${sp.w}` : ""}`} className="text-[11px] font-semibold text-accent hover:underline">Lihat analitik</Link>}>
            <div className="flex h-3 overflow-hidden rounded-full">
              {(["negatif", "netral", "positif"] as const).map((s) => <span key={s} style={{ width: `${(r30[s] / Math.max(1, r30.total)) * 100}%`, background: s === "netral" ? "#ced4da" : WARNA_SENTIMEN[s] }} />)}
            </div>
            <dl className="mt-2 grid grid-cols-3 text-center text-xs">
              {(["negatif", "netral", "positif"] as const).map((s) => <div key={s}><dt className="capitalize text-muted">{s}</dt><dd className="num text-base font-bold" style={{ color: s === "netral" ? undefined : WARNA_SENTIMEN[s] }}>{persen(r30[s] / Math.max(1, r30.total))}</dd></div>)}
            </dl>
          </KartuSamping>
          <KartuSamping judul="Lonjakan berita" aksi={<Flame size={14} className="text-neg" />}>
            {letupan.length ? (
              <ul className="space-y-2">
                {letupan.map((l) => (
                  <li key={l.sentimen + l.dari} className="border-l-[3px] pl-2.5" style={{ borderColor: WARNA_SENTIMEN[l.sentimen] }}>
                    <Link href={url({ s: l.sentimen, dari: l.dari, sampai: l.sampai, isu: undefined, tipe: undefined, q: undefined })} className="text-[13px] font-semibold hover:text-accent">{l.isu}</Link>
                    <p className="text-[11px] text-muted">{l.jumlah} berita {l.sentimen} · {tanggalPendek(l.dari)}{l.dari !== l.sampai ? `–${tanggalPendek(l.sampai)}` : ""} · {labelWilayah(l.wilayahId)}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Tidak ada lonjakan dalam 90 hari terakhir.</p>}
          </KartuSamping>
          <KartuSamping judul="Topik 30 hari">
            <ul className="space-y-1.5">
              {perIsu.map(({ i, n }) => (
                <li key={i}><Link href={url({ isu: i, dari: b30, sampai: undefined, s: undefined, tipe: undefined, q: undefined })} className="grid grid-cols-[118px_1fr_26px] items-center gap-2 text-xs hover:text-accent">
                  <span className="truncate">{i}</span><span className="h-2 rounded-full bg-bg"><span className="block h-full rounded-full" style={{ width: `${(n / maksIsu) * 100}%`, background: warnaIsu(i) }} /></span><b className="num text-right">{n}</b>
                </Link></li>
              ))}
            </ul>
          </KartuSamping>
          <KartuSamping judul="Kasus konflik terbaru" aksi={<Link href={`/peta/konflik${c.titik ? `?w=${c.titik}` : ""}`} className="text-[11px] font-semibold text-accent hover:underline">Buka peta</Link>}>
            <ul className="space-y-2">
              {konflik.map((k) => (
                <li key={k.id}><Link href={`/konflik/${encodeURIComponent(k.id)}`} className="group flex gap-2">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: warnaSektorKonflik(k.sektor) }} />
                  <span className="min-w-0"><span className="line-clamp-2 text-[13px] font-medium leading-snug group-hover:text-accent">{k.judul}</span><span className="text-[11px] text-muted">{tanggal(k.tanggal)} · {labelWilayah(k.wilayahId).split(" › ")[0]}</span></span>
                </Link></li>
              ))}
            </ul>
          </KartuSamping>
        </aside>
      </div>
    </div>
    </>
  );
}

function Halaman({ hal, total, url }: { hal: number; total: number; url: (n: number) => string }) {
  if (total <= 1) return null;
  const nomor = [...new Set([1, hal - 2, hal - 1, hal, hal + 1, hal + 2, total])].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  return (
    <nav aria-label="Halaman" className="flex items-center gap-1.5">
      {hal > 1 && <Link href={url(hal - 1)} className="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface text-sm text-muted hover:text-ink">«</Link>}
      {nomor.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          {i > 0 && n - nomor[i - 1] > 1 && <span className="text-muted">…</span>}
          <Link href={url(n)} aria-current={n === hal ? "page" : undefined} className={`num grid h-8 w-8 place-items-center rounded-full border text-sm ${n === hal ? "border-[#1c7ed6] font-semibold text-[#1c7ed6]" : "border-line bg-surface text-muted hover:text-ink"}`}>{n}</Link>
        </span>
      ))}
      {hal < total && <Link href={url(hal + 1)} className="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface text-sm text-muted hover:text-ink">»</Link>}
    </nav>
  );
}
