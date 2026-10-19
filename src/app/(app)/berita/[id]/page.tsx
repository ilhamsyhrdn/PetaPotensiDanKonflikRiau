import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, ExternalLink, Info, MapPin, PenLine } from "lucide-react";
import MiniPeta from "@/components/MiniPeta";
import Bagikan from "@/components/Bagikan";
import { BeritaMini, Gambar, KartuSamping } from "@/components/Detail";
import { ChipSentimen } from "@/components/ui";
import { bacaDb } from "@/lib/db";
import { warnaIsu, warnaSektorKonflik } from "@/lib/kategori";
import { WARNA_SENTIMEN, domain, tanggal, tanggalPanjang } from "@/lib/format";
import { getWilayah, labelWilayah, rantai } from "@/lib/wilayah";
import { beritaTerkait, satuKab } from "@/lib/terkait";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = (await bacaDb()).media.find((x) => x.id === decodeURIComponent(id));
  return { title: m ? `${m.judul} · Berita` : "Berita" };
}

export default async function DetailBerita({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await bacaDb();
  const m = db.media.find((x) => x.id === decodeURIComponent(id));
  if (!m) notFound();

  const w = getWilayah(m.wilayahId);
  const lain = db.media.filter((x) => x.id !== m.id && x.tipe === m.tipe && (x.isu === m.isu || satuKab(x.wilayahId, m.wilayahId))).slice(0, 6);
  const konflik = w && w.level !== "provinsi" ? db.konflik.filter((k) => satuKab(k.wilayahId, m.wilayahId)).slice(0, 5) : [];
  const internal = m.asal === "Input" && !!m.isi;
  const paragraf = (m.isi || "").split(/\n{2,}/).filter(Boolean);
  const liputan = beritaTerkait(db, m.wilayahId === "riau" ? "" : m.wilayahId, m.judul, 6, m.id);

  return (
    <div className="mx-auto max-w-[2400px] px-4 py-4 sm:px-6 2xl:px-10">
      <div className="progres-gulir" aria-hidden />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href="/berita" className="flex items-center gap-1.5 text-muted hover:text-accent"><ArrowLeft size={15} /> Semua berita</Link>
        <Bagikan judul={m.judul} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px] 3xl:grid-cols-[minmax(0,1fr)_440px]">
        <article className="card overflow-hidden">
          <h1 className="px-5 pt-5 text-xl font-bold leading-snug text-balance sm:text-2xl">{m.judul}</h1>
          <div className="flex flex-wrap items-center gap-1.5 px-5 pb-4 pt-2 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded bg-[#4dabf7] px-1.5 py-0.5 font-semibold uppercase text-white"><PenLine size={11} />{m.asal === "Input" ? "Tim studi" : m.sumber}</span>
            <span className="inline-flex items-center gap-1 rounded bg-[#495057] px-1.5 py-0.5 font-semibold text-white"><CalendarDays size={11} />{tanggalPanjang(m.tanggal)}</span>
            <ChipSentimen s={m.sentimen} />
            <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: warnaIsu(m.isu) + "1a", color: warnaIsu(m.isu) }}>{m.isu}</span>
            {m.asal === "Contoh" && <span className="rounded bg-amber-200 px-1.5 py-0.5 font-semibold text-amber-900">DATA CONTOH</span>}
          </div>

          {(m.gambar || internal) && <Gambar media={m} className="aspect-[16/8] w-full" />}

          <div className="grid gap-6 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="min-w-0 text-[15px] leading-relaxed text-ink/90">
              {paragraf.length ? (
                <div className="space-y-4 whitespace-pre-line">{paragraf.map((p, i) => <p key={i}>{p}</p>)}</div>
              ) : (
                <>
                  {m.ringkasan && <p className="text-[16px]">{m.ringkasan}</p>}
                  {m.tipe === "berita" && (
                    <div className="mt-5 flex gap-3 rounded-lg border border-line bg-bg p-4 text-sm">
                      <Info size={18} className="mt-0.5 shrink-0 text-accent" />
                      <div>
                        <p className="font-semibold">Berita ini dari {m.sumber}</p>
                        <p className="mt-1 text-muted">Dashboard ini hanya menyimpan judul dan tautannya supaya tidak melanggar hak cipta. Isi lengkapnya bisa dibaca di situs aslinya. Kalau perlu, tim bisa menambahkan catatan sendiri lewat Kelola Data.</p>
                      </div>
                    </div>
                  )}
                </>
              )}
              {m.url && (
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#25557a]">
                  Baca di {m.asal === "Google News" ? m.sumber : domain(m.url) || m.sumber} <ExternalLink size={15} />
                </a>
              )}
              {liputan.length > 0 && (
                <section className="mt-6 border-t border-line pt-4">
                  <h2 className="mb-2 text-sm font-semibold">Liputan terkait di media lain</h2>
                  <ul className="divide-y divide-line">
                    {liputan.map((x) => (
                      <li key={x.id}><Link href={`/berita/${encodeURIComponent(x.id)}`} className="flex items-center gap-3 py-2 hover:text-accent">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: WARNA_SENTIMEN[x.sentimen] }} />
                        <span className="min-w-0 flex-1"><span className="line-clamp-1 text-[14px] font-medium">{x.judul}</span><span className="text-[11.5px] text-muted">{x.sumber} · {tanggal(x.tanggal)} · {x.isu}</span></span>
                      </Link></li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <div className="space-y-4">
              <section className="rounded-lg border border-line p-3 text-sm">
                <p className="eyebrow mb-2">Tentang berita ini</p>
                <dl className="space-y-1.5">
                  <div className="flex justify-between gap-2"><dt className="text-muted">Nada</dt><dd className="font-semibold capitalize" style={{ color: WARNA_SENTIMEN[m.sentimen] }}>{m.sentimen}</dd></div>
                  {typeof m.skor === "number" && <div className="flex justify-between gap-2"><dt className="text-muted">Skor nada</dt><dd className="num font-semibold">{m.skor > 0 ? "+" : ""}{m.skor.toFixed(2)}</dd></div>}
                  <div className="flex justify-between gap-2"><dt className="text-muted">Metode</dt><dd>{m.metodeSentimen === "InSet" ? "Otomatis (kamus InSet)" : "Dinilai tim"}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-muted">Topik</dt><dd className="text-right">{m.isu}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-muted">Jenis</dt><dd>{m.tipe === "berita" ? "Berita online" : "Media sosial"}</dd></div>
                  {m.asal !== "Input" && <div className="flex justify-between gap-2"><dt className="text-muted">Diambil lewat</dt><dd>{m.asal}</dd></div>}
                </dl>
                {m.metodeSentimen === "InSet" && <p className="mt-2 text-[11px] leading-snug text-muted">Nada dibaca mesin dari judul dan cuplikan memakai kamus InSet (Koto &amp; Rahmaningtyas, 2017). Bisa meleset kalau beritanya bernada sindiran.</p>}
              </section>
              <section className="overflow-hidden rounded-lg border border-line text-sm">
                <p className="flex items-center gap-1.5 px-3 py-2 font-semibold"><MapPin size={14} className="text-muted" />{labelWilayah(m.wilayahId)}</p>
                {w && w.level !== "provinsi" ? (
                  <div className="h-44"><MiniPeta koordinat={w.koordinat} warna={WARNA_SENTIMEN[m.sentimen]} kecId={rantai(w.id)[1]?.id} label={w.nama} zoom={w.level === "kabupaten" ? 8.2 : w.level === "kecamatan" ? 10 : 12} /></div>
                ) : <p className="px-3 pb-3 text-xs text-muted">Berita ini membahas Riau secara umum, tidak menyebut daerah tertentu.</p>}
              </section>
            </div>
          </div>
        </article>

        <aside className="space-y-4">
          <KartuSamping judul="Berita lainnya"><BeritaMini list={lain} /></KartuSamping>
          {konflik.length > 0 && (
            <KartuSamping judul="Konflik di daerah ini">
              <ul className="space-y-2">
                {konflik.map((k) => (
                  <li key={k.id}><Link href={`/konflik/${encodeURIComponent(k.id)}`} className="group flex gap-2">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: warnaSektorKonflik(k.sektor) }} />
                    <span className="min-w-0"><span className="line-clamp-2 text-[13px] font-medium leading-snug group-hover:text-accent">{k.judul}</span><span className="text-[11px] text-muted">{tanggal(k.tanggal)} · {k.status}</span></span>
                  </Link></li>
                ))}
              </ul>
            </KartuSamping>
          )}
        </aside>
      </div>
    </div>
  );
}
