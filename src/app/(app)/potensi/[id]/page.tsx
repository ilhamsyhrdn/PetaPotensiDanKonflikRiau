import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import MiniPeta from "@/components/MiniPeta";
import Bagikan from "@/components/Bagikan";
import { BeritaMini, DaftarKolom, DaftarRujukan, JudulBagian, KartuSamping, TabelAtribut, TautanGoogleMaps } from "@/components/Detail";
import { Chip } from "@/components/ui";
import { bacaDb } from "@/lib/db";
import { kategoriPotensi, warnaSektorKonflik } from "@/lib/kategori";
import { tanggal, tanggalPanjang } from "@/lib/format";
import { labelWilayah, namaLengkap, rantai } from "@/lib/wilayah";
import { beritaTerkait, satuKab, satuKec, terdekat } from "@/lib/terkait";
import { kategoriPotensi as kp, warnaStatus } from "@/lib/kategori";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = (await bacaDb()).potensi.find((x) => x.id === decodeURIComponent(id));
  return { title: p ? `${p.nama} · Potensi ekonomi` : "Potensi ekonomi" };
}

const WARNA_STATUS = { Beroperasi: "#2f9e44", "Tidak aktif": "#868e96", "Dalam pembangunan": "#e8590c", "Tidak diketahui": "#868e96" } as const;

export default async function DetailPotensi({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await bacaDb();
  const p = db.potensi.find((x) => x.id === decodeURIComponent(id));
  if (!p) notFound();

  const r = rantai(p.wilayahId);
  const kab = r[0], kec = r[1];
  const kat = kategoriPotensi(p.kategori);
  const sejenis = db.potensi.filter((x) => x.id !== p.id && x.kategori === p.kategori && satuKec(x.wilayahId, p.wilayahId)).slice(0, 8);
  const konflik = db.konflik.filter((x) => satuKab(x.wilayahId, p.wilayahId)).sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1)).slice(0, 5);
  const berita = beritaTerkait(db, p.wilayahId, `${p.nama} ${p.subkategori} ${p.komoditas.join(" ")} ekonomi umkm`, 5);
  const osm = p.sumber.find((s) => s.url?.includes("openstreetmap.org"))?.url;
  const potensiDekat = terdekat(db.potensi, p.koordinat, 6, p.id);
  const konflikDekat = terdekat(db.konflik, p.koordinat, 5);
  const km = (n: number) => (n < 1 ? `${Math.round(n * 1000)} m` : `${n.toFixed(n < 10 ? 1 : 0)} km`);

  return (
    <div className="mx-auto max-w-[2400px] px-4 py-4 sm:px-6 2xl:px-10">
      <div className="progres-gulir" aria-hidden />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href={`/peta/potensi?w=${kab?.id ?? ""}`} className="flex items-center gap-1.5 text-muted hover:text-accent"><ArrowLeft size={15} /> Peta potensi ekonomi</Link>
        <p className="eyebrow">Data detil potensi ekonomi · sumber {p.asal === "OSM" ? "OpenStreetMap" : p.asal}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] 3xl:grid-cols-[minmax(0,1fr)_440px]">
        <article className="card overflow-hidden">
          <header className="flex flex-wrap items-start justify-between gap-4 px-5 pb-3 pt-5">
            <div className="min-w-0 max-w-3xl">
              <h1 className="text-xl font-bold uppercase leading-snug text-balance" style={{ color: "#2f6690" }}>{p.nama}</h1>
              <div className="mt-2 h-[3px] w-14 rounded" style={{ background: kat.warna }} />
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Chip warna={kat.warna}>{kat.nama}</Chip><Chip warna="#2f6690">{p.subkategori}</Chip><Chip warna={WARNA_STATUS[p.status]}>{p.status}</Chip>
              </div>
            </div>
            <Bagikan judul={p.nama} />
          </header>

          <div className="grid gap-4 px-5 pb-5 lg:grid-cols-[1fr_1.05fr]">
            <div className="h-[290px] lg:h-auto lg:min-h-[290px]">
              <MiniPeta koordinat={p.koordinat} warna={kat.warna} kecId={kec?.id} label={`Riau, ${kab ? namaLengkap(kab) : ""}${kec ? ", " + namaLengkap(kec) : ""}`} zoom={14} />
            </div>
            <TabelAtribut baris={[
              ["Nomor data", p.id.replace(/^p-osm-/, "OSM ").toUpperCase()],
              ["Lapangan usaha", `${kat.nama} (KBLI ${kat.kbli})`],
              ["Jenis", p.subkategori],
              ["Komoditas", p.komoditas.join(", ")],
              ["Status", <span key="s" style={{ color: WARNA_STATUS[p.status] }} className="font-medium">{p.status}</span>],
              ["Pengelola", p.pengelola],
              ["Lokasi", <span key="l" className="inline-flex items-center gap-1"><MapPin size={13} className="text-muted" />{labelWilayah(p.wilayahId)} <TautanGoogleMaps koordinat={p.koordinat} /></span>],
              ["Koordinat", `${p.koordinat[1].toFixed(5)}, ${p.koordinat[0].toFixed(5)}`],
              ["Pembaruan data", p.tanggal ? tanggalPanjang(p.tanggal) : ""],
              ["Kerahasiaan", <span key="r" className="rounded bg-[#4dabf7] px-1.5 py-0.5 text-[11px] font-semibold text-white">{p.kerahasiaan}</span>],
            ]} />
          </div>

          <JudulBagian>Keterlibatan</JudulBagian>
          <DaftarKolom kolom={[["Pemerintah", p.keterlibatan.pemerintah], ["Swasta", p.keterlibatan.swasta], ["Masyarakat", p.keterlibatan.masyarakat]]} />

          <JudulBagian>Konten</JudulBagian>
          <div className="grid gap-6 px-5 py-4 lg:grid-cols-[minmax(0,1.4fr)_1fr]">
            <div>
              <h3 className="mb-1.5 text-lg font-semibold">Deskripsi</h3>
              <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-ink/90">{p.deskripsi || "Belum ada deskripsi."}</p>
              {Object.keys(p.atribut).length > 0 && (
                <>
                  <h3 className="mb-1.5 mt-5 text-lg font-semibold">Keterangan tambahan</h3>
                  <TabelAtribut baris={Object.entries(p.atribut).map(([a, b]) => [a, /^https?:\/\//.test(b) ? <a key={a} href={b} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{b}</a> : b])} />
                </>
              )}
            </div>
            <div className="space-y-5">
              <div><h3 className="mb-1.5 text-lg font-semibold">Sumber</h3><DaftarRujukan list={p.sumber} kosong="Sumber belum dicantumkan." />
                {osm && <p className="mt-2 text-xs text-muted">Data © kontributor OpenStreetMap (ODbL). Kalau ada yang keliru, perbaiki di OpenStreetMap lalu jalankan ulang skrip data.</p>}
              </div>
              <div><h3 className="mb-1.5 text-lg font-semibold">Lampiran</h3><DaftarRujukan list={p.lampiran} kosong="Tidak ada lampiran." /></div>
            </div>
          </div>

          <JudulBagian>Sekitar lokasi</JudulBagian>
          <div className="grid gap-6 px-5 py-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold">Potensi ekonomi terdekat</h3>
              <ul className="divide-y divide-line text-[13px]">
                {potensiDekat.map(({ x, km: d }) => (
                  <li key={x.id}><Link href={`/potensi/${encodeURIComponent(x.id)}`} className="flex items-center gap-2 py-1.5 hover:text-accent">
                    <span className="h-2.5 w-2.5 shrink-0 rotate-45" style={{ background: kp(x.kategori).warna }} />
                    <span className="min-w-0 flex-1 truncate"><b className="font-medium">{x.nama}</b> <span className="text-muted">· {x.subkategori}</span></span>
                    <span className="num shrink-0 text-xs text-muted">{km(d)}</span>
                  </Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Konflik terdekat</h3>
              <ul className="divide-y divide-line text-[13px]">
                {konflikDekat.map(({ x, km: d }) => (
                  <li key={x.id}><Link href={`/konflik/${encodeURIComponent(x.id)}`} className="flex items-center gap-2 py-1.5 hover:text-accent">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: warnaSektorKonflik(x.sektor) }} />
                    <span className="min-w-0 flex-1 truncate">{x.judul}</span>
                    <span className="shrink-0 text-xs" style={{ color: warnaStatus(x.status) }}>{x.status}</span>
                    <span className="num w-14 shrink-0 text-right text-xs text-muted" title={x.presisi === "titik" ? "" : `Lokasi konflik hanya diketahui sampai tingkat ${x.presisi}`}>{km(d)}{x.presisi === "titik" ? "" : "*"}</span>
                  </Link></li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] text-muted">* lokasi konflik dari berita hanya sampai tingkat desa/kecamatan/kabupaten, jarak berupa perkiraan.</p>
            </div>
          </div>
        </article>

        <aside className="space-y-4">
          <KartuSamping judul={`${kat.nama} lain di ${kec ? namaLengkap(kec) : "sekitar"}`} aksi={<span className="num text-xs text-muted">{sejenis.length}</span>}>
            {sejenis.length ? (
              <ul className="space-y-1.5">
                {sejenis.map((x) => (
                  <li key={x.id}><Link href={`/potensi/${encodeURIComponent(x.id)}`} className="group flex items-start gap-2 text-[13px]">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rotate-45" style={{ background: kat.warna }} />
                    <span className="min-w-0"><span className="font-medium group-hover:text-accent">{x.nama}</span> <span className="text-[11px] text-muted">· {x.subkategori}</span></span>
                  </Link></li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Belum ada sarana sejenis di kecamatan ini.</p>}
          </KartuSamping>
          <KartuSamping judul={`Konflik di ${kab ? namaLengkap(kab) : "wilayah ini"}`} aksi={<Link href={`/peta/konflik?w=${kab?.id ?? ""}`} className="text-[11px] font-semibold text-accent hover:underline">Peta</Link>}>
            {konflik.length ? (
              <ul className="space-y-2">
                {konflik.map((x) => (
                  <li key={x.id}><Link href={`/konflik/${encodeURIComponent(x.id)}`} className="group flex gap-2">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: warnaSektorKonflik(x.sektor) }} />
                    <span className="min-w-0"><span className="line-clamp-2 text-[13px] font-medium leading-snug group-hover:text-accent">{x.judul}</span>
                      <span className="text-[11px] text-muted">{x.sektor} · {tanggal(x.tanggal)}</span></span>
                  </Link></li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Belum ada konflik yang tercatat.</p>}
          </KartuSamping>
          <KartuSamping judul="Berita terkait"><BeritaMini list={berita} /></KartuSamping>
        </aside>
      </div>
    </div>
  );
}
