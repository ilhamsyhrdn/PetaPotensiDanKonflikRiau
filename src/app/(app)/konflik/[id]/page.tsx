import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Lock, MapPin } from "lucide-react";
import MiniPeta from "@/components/MiniPeta";
import Bagikan from "@/components/Bagikan";
import { BeritaMini, DaftarKolom, DaftarRujukan, JudulBagian, KartuSamping, TabelAtribut, TautanGoogleMaps } from "@/components/Detail";
import { Chip } from "@/components/ui";
import { bacaDb } from "@/lib/db";
import { warnaSektorKonflik, warnaStatus, kategoriPotensi } from "@/lib/kategori";
import { angka, tanggal, tanggalPanjang } from "@/lib/format";
import { getWilayah, labelWilayah, namaLengkap, rantai } from "@/lib/wilayah";
import { beritaTerkait, satuKab, satuKec, terdekat } from "@/lib/terkait";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const k = (await bacaDb()).konflik.find((x) => x.id === decodeURIComponent(id));
  return { title: k ? `${k.judul} · Data konflik` : "Data konflik" };
}

export default async function DetailKonflik({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await bacaDb();
  const k = db.konflik.find((x) => x.id === decodeURIComponent(id));
  if (!k) notFound();

  const r = rantai(k.wilayahId);
  const kab = r[0], kec = r[1];
  const warna = warnaSektorKonflik(k.sektor);
  const lain = db.konflik.filter((x) => x.id !== k.id && satuKab(x.wilayahId, k.wilayahId)).sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1)).slice(0, 6);
  const berita = beritaTerkait(db, k.wilayahId, `${k.judul} ${k.keterlibatan.perusahaan.join(" ")} ${k.keterlibatan.masyarakat.join(" ")}`, 5);
  const potensiKec = db.potensi.filter((p) => satuKec(p.wilayahId, k.wilayahId));
  const konflikDekat = terdekat(db.konflik, k.koordinat, 5, k.id);
  const potensiDekat = terdekat(db.potensi, k.koordinat, 5);
  const km = (n: number) => (n < 1 ? `${Math.round(n * 1000)} m` : `${n.toFixed(n < 10 ? 1 : 0)} km`);
  const perKat = Object.entries(potensiKec.reduce<Record<string, number>>((n, p) => ((n[p.kategori] = (n[p.kategori] ?? 0) + 1), n), {})).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto max-w-[2400px] px-4 py-4 sm:px-6 2xl:px-10">
      <div className="progres-gulir" aria-hidden />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href={`/peta/konflik?w=${kab?.id ?? ""}`} className="flex items-center gap-1.5 text-muted hover:text-accent"><ArrowLeft size={15} /> Peta konflik</Link>
        <p className="eyebrow">Data detil konflik · {k.asal === "TanahKita" ? "data sekunder" : k.asal === "Berita" ? "dihimpun dari berita online" : k.asal}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] 3xl:grid-cols-[minmax(0,1fr)_440px]">
        <article className="card overflow-hidden">
          <header className="flex flex-wrap items-start justify-between gap-4 px-5 pb-3 pt-5">
            <div className="min-w-0 max-w-3xl">
              <h1 className="text-xl font-bold uppercase leading-snug text-[#a23a1c] text-balance">{k.judul}</h1>
              <div className="mt-2 h-[3px] w-14 rounded bg-[#a23a1c]" />
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Chip warna={warna}>{k.sektor}</Chip><Chip warna={warnaStatus(k.status)}>{k.status}</Chip><Chip warna="#2f6690">{k.jenis}</Chip>
                {k.asal === "Berita" && <Chip warna="#868e96">Perlu verifikasi lapangan</Chip>}
              </div>
            </div>
            <Bagikan judul={k.judul} />
          </header>

          <div className="grid gap-4 px-5 pb-5 lg:grid-cols-[1fr_1.05fr]">
            <div className="h-[290px] lg:h-auto lg:min-h-[290px]">
              <MiniPeta koordinat={k.koordinat} warna={warna} kecId={kec?.id} label={`Riau, ${kab ? namaLengkap(kab) : ""}${kec ? ", " + namaLengkap(kec) : ""}`} zoom={k.presisi === "kabupaten" ? 9 : k.presisi === "kecamatan" ? 10.5 : 12.5} />
            </div>
            <TabelAtribut baris={[
              ["Nomor kejadian", k.nomor],
              ["Waktu kejadian", tanggalPanjang(k.tanggal)],
              ["Konflik", k.jenis],
              ["Status konflik", <span key="s" className="inline-flex items-center gap-1.5 font-medium" style={{ color: warnaStatus(k.status) }}>{k.status}{k.status === "Belum ditangani" && <AlertTriangle size={14} />}</span>],
              ["Sektor", k.sektor],
              ["Sektor lain", k.sektorLain],
              ["Luas", k.luasHa !== null ? `${angka(k.luasHa)} Ha` : ""],
              ["Dampak masyarakat", k.dampakJiwa ? `${angka(k.dampakJiwa)} jiwa` : ""],
              ["Lokasi", <span key="l" className="inline-flex items-center gap-1"><MapPin size={13} className="text-muted" />{labelWilayah(k.wilayahId)} <span className="text-xs text-muted">(presisi {k.presisi})</span> <TautanGoogleMaps koordinat={k.koordinat} /></span>],
              ["Kerahasiaan", <span key="r" className="inline-flex items-center gap-1 rounded bg-[#4dabf7] px-1.5 py-0.5 text-[11px] font-semibold text-white">{k.kerahasiaan !== "Publik" && <Lock size={11} />}{k.kerahasiaan}</span>],
            ]} />
          </div>

          <JudulBagian>Keterlibatan</JudulBagian>
          <DaftarKolom kolom={[["Pemerintah", k.keterlibatan.pemerintah], ["Perusahaan", k.keterlibatan.perusahaan], ["Masyarakat", k.keterlibatan.masyarakat]]} />

          <JudulBagian>Konten</JudulBagian>
          <div className="grid gap-6 px-5 py-4 lg:grid-cols-[minmax(0,1.6fr)_1fr]">
            <div>
              <h3 className="mb-1.5 text-lg font-semibold">Narasi</h3>
              <div className="space-y-3 whitespace-pre-line text-[14.5px] leading-relaxed text-ink/90">{k.narasi || k.ringkasan || "Belum ada narasi."}</div>
            </div>
            <div className="space-y-5">
              <div><h3 className="mb-1.5 text-lg font-semibold">Sumber</h3><DaftarRujukan list={k.sumber} kosong="Sumber belum dicantumkan." /></div>
              <div><h3 className="mb-1.5 text-lg font-semibold">Lampiran</h3><DaftarRujukan list={k.lampiran} kosong="Tidak ada lampiran." /></div>
            </div>
          </div>

          <JudulBagian>Sekitar lokasi</JudulBagian>
          <div className="grid gap-6 px-5 py-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold">Konflik lain yang paling dekat</h3>
              <ul className="divide-y divide-line text-[13px]">
                {konflikDekat.map(({ x, km: d }) => (
                  <li key={x.id}><Link href={`/konflik/${encodeURIComponent(x.id)}`} className="flex items-center gap-2 py-1.5 hover:text-accent">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: warnaSektorKonflik(x.sektor) }} />
                    <span className="min-w-0 flex-1 truncate">{x.judul}</span>
                    <span className="shrink-0 text-xs" style={{ color: warnaStatus(x.status) }}>{x.status}</span>
                    <span className="num w-14 shrink-0 text-right text-xs text-muted">{km(d)}{x.presisi === "titik" && k.presisi === "titik" ? "" : "*"}</span>
                  </Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Sarana ekonomi terdekat</h3>
              <ul className="divide-y divide-line text-[13px]">
                {potensiDekat.map(({ x, km: d }) => (
                  <li key={x.id}><Link href={`/potensi/${encodeURIComponent(x.id)}`} className="flex items-center gap-2 py-1.5 hover:text-accent">
                    <span className="h-2.5 w-2.5 shrink-0 rotate-45" style={{ background: kategoriPotensi(x.kategori).warna }} />
                    <span className="min-w-0 flex-1 truncate"><b className="font-medium">{x.nama}</b> <span className="text-muted">· {x.subkategori}</span></span>
                    <span className="num shrink-0 text-xs text-muted">{km(d)}</span>
                  </Link></li>
                ))}
              </ul>
            </div>
            <p className="text-[11px] text-muted lg:col-span-2">* Lokasi kasus dari berita kadang hanya diketahui sampai desa, kecamatan, atau kabupaten, jadi jaraknya perkiraan.</p>
          </div>
        </article>

        <aside className="space-y-4">
          <KartuSamping judul={`Konflik lain di ${kab ? namaLengkap(kab) : "wilayah ini"}`} aksi={<span className="num text-xs text-muted">{lain.length}</span>}>
            {lain.length ? (
              <ul className="space-y-2">
                {lain.map((x) => (
                  <li key={x.id}>
                    <Link href={`/konflik/${encodeURIComponent(x.id)}`} className="group flex gap-2">
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: warnaSektorKonflik(x.sektor) }} />
                      <span className="min-w-0"><span className="line-clamp-2 text-[13px] font-medium leading-snug group-hover:text-accent">{x.judul}</span>
                        <span className="text-[11px] text-muted">{x.sektor} · {tanggal(x.tanggal)} · {x.status}</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Belum ada konflik lain yang tercatat.</p>}
          </KartuSamping>
          <KartuSamping judul="Berita terkait"><BeritaMini list={berita} /></KartuSamping>
          <KartuSamping judul={`Potensi ekonomi di ${kec ? namaLengkap(kec) : "sekitar"}`} aksi={<span className="num text-xs text-muted">{potensiKec.length}</span>}>
            {perKat.length ? (
              <ul className="space-y-1.5 text-sm">
                {perKat.map(([kt, n]) => (
                  <li key={kt} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: kategoriPotensi(kt).warna }} /><span className="flex-1">{kategoriPotensi(kt).nama}</span><b className="num">{n}</b></li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Belum ada potensi ekonomi yang tercatat di kecamatan ini.</p>}
            <Link href={`/peta/potensi?w=${kec?.id ?? kab?.id ?? ""}`} className="mt-2 inline-block text-xs font-semibold text-accent hover:underline">Lihat di peta potensi →</Link>
          </KartuSamping>
          {getWilayah(k.wilayahId)?.catatan && <p className="rounded-lg bg-[#fbe9e3] px-3 py-2 text-xs text-[#a23a1c]">{getWilayah(k.wilayahId)?.catatan}</p>}
        </aside>
      </div>
    </div>
  );
}
