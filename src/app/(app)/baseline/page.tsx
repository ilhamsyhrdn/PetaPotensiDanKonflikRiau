import Link from "next/link";
import { CircleCheck, ClipboardList, Earth, ExternalLink, FileSpreadsheet, Network, Pencil, Search, type LucideIcon } from "lucide-react";
import HeaderHalaman from "@/components/HeaderHalaman";
import EksporKml from "@/components/EksporKml";
import { Chip, Kartu, KartuAngka } from "@/components/ui";
import { bacaDb } from "@/lib/db";
import { wajibSesi } from "@/lib/sesi";
import { bolehUbah } from "@/lib/auth";
import { JENIS_DOKUMEN, KEC_STUDI, STATUS_DOKUMEN, TEMPAT_CARI, terkumpul, warnaStatusDokumen } from "@/lib/baseline";
import { DESA_STUDI, KABUPATEN, KAB_STUDI, getWilayah, namaLengkap, rantai } from "@/lib/wilayah";
import { tanggal } from "@/lib/format";
import type { Dokumen } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Data Baseline · Dashboard Potensi Ekonomi & Peta Konflik" };

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const urutJenis = (j: string) => (JENIS_DOKUMEN as readonly string[]).indexOf(j);
const kabDari = (id: string) => rantai(id)[0]?.id;
const tautanEdit = (d: Dokumen) => `/kelola?tab=dokumen&q=${encodeURIComponent(d.judul)}`;

export default async function BaselinePage() {
  const sesi = await wajibSesi();
  const db = await bacaDb();
  const dok = [...db.dokumen].sort((a, b) => urutJenis(a.jenis) - urutJenis(b.jenis) || a.judul.localeCompare(b.judul));
  const bisaUbah = bolehUbah(sesi);

  const kumpul = dok.filter(terkumpul).length;
  const diinput = dok.filter((d) => d.status === "Sudah diinput").length;
  const indikator = dok.flatMap((d) => d.indikator.map((i) => ({ ...i, dok: d })));
  const kabList = [...KAB_STUDI, ...KABUPATEN.filter((k) => !KAB_STUDI.includes(k) && dok.some((d) => kabDari(d.wilayahId) === k.id))];
  const kolom = JENIS_DOKUMEN.filter((j) => j !== "Lainnya" || dok.some((d) => d.jenis === j));
  const lain = dok.filter((d) => !kabDari(d.wilayahId));

  return (
    <>
      <HeaderHalaman eyebrow={`Data sekunder · ${KAB_STUDI.length} kabupaten, ${KEC_STUDI.length} kecamatan, ${DESA_STUDI.length} desa studi`} judul="Data baseline"
        keterangan="RPJMD, Kabupaten/Kecamatan Dalam Angka, dan Renstra OPD untuk wilayah studi. Begitu dokumennya didapat, angka pentingnya diinput di sini sebagai baseline, lalu bisa dibuka di Google Earth atau Google Maps.">
        <a href="#ekspor" className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold ring-1 ring-white/20 hover:bg-white/15"><Earth size={16} /> Google Earth / Maps</a>
        {bisaUbah && <Link href="/kelola?tab=dokumen" className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-navy hover:bg-white/90"><Pencil size={15} /> Kelola dokumen</Link>}
      </HeaderHalaman>

      <div className="mx-auto max-w-[2400px] space-y-4 px-4 py-4 sm:px-6 2xl:px-10">
        <Tahapan persen={pct(kumpul, dok.length)} />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KartuAngka label="Dokumen dicari" nilai={dok.length} ikon={ClipboardList} warna="#2f6690" ket="RPJMD, Dalam Angka, dan Renstra OPD wilayah studi" />
          <KartuAngka label="Sudah terkumpul" nilai={pct(kumpul, dok.length)} akhiran="%" ikon={CircleCheck} warna="#1971c2" ket={`${kumpul} dari ${dok.length} dokumen sudah diunduh`}
            komposisi={STATUS_DOKUMEN.map((s) => ({ label: s.nama, nilai: dok.filter((d) => d.status === s.nama).length, warna: s.warna }))} />
          <KartuAngka label="Sudah diinput" nilai={diinput} ikon={FileSpreadsheet} warna="#2f9e44" ket="Dokumen yang angkanya sudah masuk ke dashboard" />
          <KartuAngka label="Angka baseline" nilai={indikator.length} ikon={Network} warna="#7a58a3" ket="Indikator kunci yang sudah diinput dari dokumen" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Kartu judul="Kelengkapan per kabupaten" sub="Jumlah dokumen yang sudah terkumpul dari yang dicari" rapat className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="tabel min-w-[620px]">
                <thead><tr><th>Kabupaten</th>{kolom.map((j) => <th key={j} className="!text-center">{j}</th>)}</tr></thead>
                <tbody>
                  {kabList.map((k) => (
                    <tr key={k.id}>
                      <td><a href={`#${k.id}`} className="font-semibold hover:text-accent">{namaLengkap(k)}</a></td>
                      {kolom.map((j) => <td key={j} className="text-center"><Sel dok={dok.filter((d) => d.jenis === j && kabDari(d.wilayahId) === k.id)} /></td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line px-5 py-3 text-[12px] text-muted">
              {STATUS_DOKUMEN.map((s) => <span key={s.nama} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.warna }} />{s.nama}</span>)}
            </div>
          </Kartu>

          <Kartu judul="Buka di Google Earth / Google Maps" sub="Unduh berkas KML berisi wilayah studi, angka baseline, dan titik data" ikon={Earth} warna="#2f9e44">
            <div id="ekspor" className="scroll-mt-[calc(var(--tinggi-nav)+90px)] space-y-4">
              <EksporKml />
              <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-ink/85">
                <li><b>Google Earth:</b> di Earth versi web pilih Proyek → Baru → Impor file KML. Di Earth Pro cukup File → Buka.</li>
                <li><b>Google Maps:</b> buka Google My Maps → Buat peta baru → Impor, lalu pilih berkasnya. Peta itu bisa dibagikan ke tim.</li>
                <li>Untuk My Maps, sebaiknya satu lapisan per berkas supaya tiap lapisan bisa dinyalakan terpisah.</li>
              </ol>
              <p className="text-[12px] text-muted">Data berlabel Rahasia tidak ikut diekspor. Klik area atau titik di Google Earth untuk melihat daftar dokumen dan angka baseline-nya.</p>
            </div>
          </Kartu>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {kabList.map((k) => {
            const isi = dok.filter((d) => kabDari(d.wilayahId) === k.id);
            return (
              <Kartu key={k.id} judul={<span id={k.id} className="block scroll-mt-[calc(var(--tinggi-nav)+24px)]">{namaLengkap(k)}</span>} rapat className="overflow-hidden"
                sub={`${isi.filter(terkumpul).length} dari ${isi.length} dokumen terkumpul`}>
                <DaftarDokumen dok={isi} bisaUbah={bisaUbah} />
              </Kartu>
            );
          })}
          {lain.length > 0 && <Kartu judul="Tingkat provinsi" rapat className="overflow-hidden"><DaftarDokumen dok={lain} bisaUbah={bisaUbah} /></Kartu>}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Kartu judul="Angka baseline" sub="Indikator kunci yang diambil dari dokumen di atas" rapat className="overflow-hidden">
            {indikator.length ? (
              <div className="overflow-x-auto">
                <table className="tabel min-w-[560px]">
                  <thead><tr><th>Wilayah</th><th>Indikator</th><th className="!text-right">Nilai</th><th>Sumber</th></tr></thead>
                  <tbody>
                    {indikator.map((i, n) => (
                      <tr key={n}>
                        <td className="whitespace-nowrap">{namaLengkap(getWilayah(i.dok.wilayahId))}</td>
                        <td>{i.nama}</td>
                        <td className="num text-right font-semibold">{i.nilai}</td>
                        <td className="text-[12px] text-muted">{i.dok.url ? <a href={i.dok.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent hover:underline">{i.dok.judul}</a> : i.dok.judul}{i.dok.tahun && ` (${i.dok.tahun})`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-muted">
                Belum ada angka yang diinput.{bisaUbah ? <> Buka <Link href="/kelola?tab=dokumen" className="font-semibold text-accent hover:underline">Kelola Data → Dokumen baseline</Link>, ubah dokumennya, lalu isi kolom <i>Angka baseline</i> (satu baris per angka: Nama | Nilai).</> : " Admin atau editor akan mengisinya begitu dokumennya didapat."}
              </p>
            )}
          </Kartu>

          <Kartu judul="Tempat mencari dokumen" sub="Semua dokumen ini seharusnya bisa diunduh terbuka" ikon={Search}>
            <dl className="space-y-3 text-[13px] leading-relaxed">
              {Object.entries(TEMPAT_CARI).map(([j, t]) => <div key={j}><dt className="font-semibold">{j}</dt><dd className="text-ink/80">{t}</dd></div>)}
            </dl>
            <p className="mt-3 text-[12px] text-muted">Kalau tidak ada di internet, ubah statusnya jadi <i>Tidak tersedia online</i> supaya tim tahu perlu minta langsung ke instansinya.</p>
          </Kartu>
        </div>
      </div>
    </>
  );
}

function Sel({ dok }: { dok: Dokumen[] }) {
  if (!dok.length) return <span className="text-muted">–</span>;
  const n = dok.filter(terkumpul).length;
  return (
    <span className="inline-flex flex-col items-center gap-1">
      <span className="num text-[13px] font-semibold" style={{ color: n === dok.length ? "#2f9e44" : n ? "#1971c2" : "#868e96" }}>{n}/{dok.length}</span>
      <span className="flex gap-0.5">{dok.map((d) => <span key={d.id} title={`${d.judul}: ${d.status}`} className="h-2 w-2 rounded-full" style={{ background: warnaStatusDokumen(d.status) }} />)}</span>
    </span>
  );
}

function DaftarDokumen({ dok, bisaUbah }: { dok: Dokumen[]; bisaUbah: boolean }) {
  if (!dok.length) return <p className="px-5 py-6 text-sm text-muted">Belum ada dokumen.</p>;
  return (
    <ul className="divide-y divide-line">
      {dok.map((d) => {
        const w = getWilayah(d.wilayahId);
        return (
          <li key={d.id} className="px-5 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold leading-snug">
                  {d.url ? <a href={d.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent hover:underline">{d.judul} <ExternalLink size={12} className="inline text-muted" /></a> : d.judul}
                </p>
                <p className="mt-0.5 text-[12px] text-muted">
                  {[d.jenis, w && w.level !== "kabupaten" ? namaLengkap(w) : "", d.tahun, d.penerbit, d.diperbarui ? `diperbarui ${tanggal(d.diperbarui)}` : ""].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1">
                <Chip warna={warnaStatusDokumen(d.status)}>{d.status}</Chip>
                {bisaUbah && <Link href={tautanEdit(d)} aria-label={`Ubah ${d.judul}`} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-accent-soft hover:text-accent"><Pencil size={13} /></Link>}
              </span>
            </div>
            {d.indikator.length > 0 && (
              <dl className="mt-2 grid gap-x-4 gap-y-1 rounded-lg bg-bg px-3 py-2 text-[12.5px] sm:grid-cols-2">
                {d.indikator.map((i, n) => <div key={n} className="flex justify-between gap-2"><dt className="text-muted">{i.nama}</dt><dd className="num font-semibold">{i.nilai}</dd></div>)}
              </dl>
            )}
            {d.catatan && <p className="mt-1.5 text-[12.5px] text-ink/80">{d.catatan}</p>}
          </li>
        );
      })}
    </ul>
  );
}

function Tahapan({ persen }: { persen: number }) {
  const TAHAP: { judul: string; ket: string; status: string; ikon: LucideIcon; aktif?: boolean; href?: string }[] = [
    { judul: "Baseline data sekunder", ket: "Dokumen resmi dikumpulkan, angka pentingnya diinput, lalu dipetakan ke Google Earth / Maps.", status: `Berjalan · ${persen}% terkumpul`, ikon: ClipboardList, aktif: true },
    { judul: "Studi social mapping", ket: "Pemetaan aktor dan relasi langsung di lapangan, di keenam desa studi.", status: "Berikutnya", ikon: Network, href: "/aktor" },
    { judul: "Pembaruan dashboard", ket: "Peta aktor contoh diganti hasil studi, lalu dashboard diperbarui dengan baseline dan temuan lapangan.", status: "Setelah studi", ikon: CircleCheck },
  ];
  return (
    <ol className="grid gap-3 md:grid-cols-3">
      {TAHAP.map((t, i) => {
        const isi = (
          <>
            <div className="flex items-center gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${t.aktif ? "bg-accent text-white" : "bg-bg text-muted"}`}>{i + 1}</span>
              <div className="min-w-0">
                <p className="font-semibold leading-snug">{t.judul}</p>
                <p className={`text-[12px] font-medium ${t.aktif ? "text-accent" : "text-muted"}`}>{t.status}</p>
              </div>
              <t.ikon size={18} className="ml-auto shrink-0 text-muted" />
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-ink/80">{t.ket}</p>
            {t.aktif && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg"><div className="h-full rounded-full bg-accent" style={{ width: `${persen}%` }} /></div>}
          </>
        );
        return (
          <li key={t.judul}>
            {t.href
              ? <Link href={t.href} className={`card card-angkat block h-full p-4`}>{isi}</Link>
              : <div className={`card h-full p-4 ${t.aktif ? "ring-2 ring-accent/30" : ""}`}>{isi}</div>}
          </li>
        );
      })}
    </ol>
  );
}
