import Link from "next/link";
import { Suspense } from "react";
import { Activity, AlertTriangle, Building2, Gem, Map as IkonPeta, MapPin, MonitorPlay, Newspaper, ThumbsDown, type LucideIcon } from "lucide-react";
import WilayahFilter from "@/components/WilayahFilter";
import PetaDashboard from "@/components/PetaDashboard";
import HeroRiau from "@/components/HeroRiau";
import GrafikTren, { type TitikTren } from "@/components/GrafikTren";
import { Donut, NavSeksi, TabelUrut, type Irisan } from "@/components/Grafik";
import { Gambar } from "@/components/Detail";
import { BarHorizontal, Catatan, Chip, ChipSentimen, IndeksPill, JudulSeksi, Kartu, KartuAngka, LabelSumber, BandingBulan, TautanKartu } from "@/components/ui";
import { bacaDb } from "@/lib/db";
import { hitungRingkasan, ringkasanPoligon } from "@/lib/ringkasan";
import { sorotanPotensi } from "@/lib/narasi";
import { KATEGORI_POTENSI, STATUS_KONFLIK, kategoriPotensi, konflikAktif, warnaSektorKonflik, warnaStatus } from "@/lib/kategori";
import { WARNA_SENTIMEN, geserHari, hariIni, indeksSentimen, ringkasSentimen, tanggal, tanggalPendek } from "@/lib/format";
import { DESA_STUDI, KABUPATEN, KAB_STUDI, anak, dalamWilayah, getWilayah, labelWilayah, namaLengkap, namaWilayah, rantai } from "@/lib/wilayah";
import { opsiKonflik, opsiPotensi, titikKonflik, titikPotensi } from "@/lib/titik";
import type { Konflik } from "@/lib/types";

export const dynamic = "force-dynamic";

const hitung = <T,>(xs: T[], f: (x: T) => string) => xs.reduce<Record<string, number>>((n, x) => ((n[f(x)] = (n[f(x)] ?? 0) + 1), n), {});
const urut = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]);
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const ribuan = (n: number) => n.toLocaleString("id-ID");

/** Satukan variasi nama perusahaan: "PT RAPP" dan "PT Riau Andalan Pulp and Paper (RAPP)" dihitung sama. */
function kunciPerusahaan(nama: string) {
  if (/^PTPN/i.test(nama)) return nama.toUpperCase().replace(/\s+/g, " ").trim();
  const singkat = nama.match(/\(([^)]+)\)\s*$/);
  return (singkat ? singkat[1] : nama.replace(/^(PT|CV)\.?\s+/i, "")).toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim();
}

function perusahaanTeratas(konflik: Konflik[], maks = 7) {
  const grup = new Map<string, { nama: string; kasus: Konflik[] }>();
  for (const k of konflik) {
    for (const kunci of new Set((k.keterlibatan?.perusahaan ?? []).map(kunciPerusahaan))) {
      const nama = (k.keterlibatan.perusahaan ?? []).find((p) => kunciPerusahaan(p) === kunci)!;
      const g = grup.get(kunci) ?? { nama, kasus: [] };
      if (nama.length > g.nama.length) g.nama = nama;
      g.kasus.push(k);
      grup.set(kunci, g);
    }
  }
  return [...grup.values()].sort((a, b) => b.kasus.length - a.kasus.length).slice(0, maks).map((g) => ({
    nama: g.nama, kasus: g.kasus.length, aktif: g.kasus.filter((k) => konflikAktif(k.status)).length,
    sektor: urut(hitung(g.kasus.filter((k) => k.sektor !== "Lainnya"), (k) => k.sektor))[0]?.[0],
  }));
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  const db = await bacaDb();
  const di = <T extends { wilayahId: string }>(xs: T[]) => xs.filter((x) => dalamWilayah(x.wilayahId, w));
  const konflik = di(db.konflik), potensi = di(db.potensi), media = di(db.media);
  const berita = media.filter((m) => m.tipe === "berita");
  const ringkasan = hitungRingkasan(db);
  const hari = hariIni();
  const fokus = w ? getWilayah(w) : undefined;
  // daerah satu tingkat di bawah fokus: kabupaten untuk seluruh Riau, kecamatan untuk satu kabupaten
  const anakFokus = !fokus ? KABUPATEN : fokus.level === "kabupaten" ? anak(fokus.id) : [];

  // ---- angka berita
  const b30 = geserHari(hari, -30), b60 = geserHari(hari, -60);
  const r30 = ringkasSentimen(berita.filter((m) => m.tanggal >= b30));
  const rLalu = ringkasSentimen(berita.filter((m) => m.tanggal >= b60 && m.tanggal < b30));
  const neg30 = pct(r30.negatif, r30.total), negLalu = pct(rLalu.negatif, rLalu.total);
  const selisihNeg = neg30 - negLalu;
  const ubahVolume = rLalu.total ? Math.round(((r30.total - rLalu.total) / rLalu.total) * 100) : 0;
  const indeks = indeksSentimen(r30);

  const tren: TitikTren[] = [];
  for (let i = 12; i >= 0; i--) {
    const akhir = geserHari(hari, -i * 7), awal = geserHari(akhir, -6);
    const r = ringkasSentimen(berita.filter((m) => m.tanggal >= awal && m.tanggal <= akhir));
    tren.push({ label: tanggalPendek(awal), positif: r.positif, netral: r.netral, negatif: r.negatif });
  }
  const bulan = Array.from({ length: 12 }, (_, i) => { const d = new Date(hari + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() - 11 + i); return d.toISOString().slice(0, 7); });
  const konflikPerBulan = bulan.map((b) => konflik.filter((k) => k.tanggal?.startsWith(b)).length);

  // ---- konflik
  const perStatus = hitung(konflik, (k) => k.status);
  const aktif = konflik.filter((k) => konflikAktif(k.status)).length;
  const belum = perStatus["Belum ditangani"] ?? 0;
  const perSektor = urut(hitung(konflik, (k) => k.sektor));
  const sektorJelas = perSektor.filter(([s]) => s !== "Lainnya");
  const totalJelas = sektorJelas.reduce((n, [, x]) => n + x, 0);
  const sektorData: Irisan[] = [
    ...sektorJelas.slice(0, 6).map(([s, n]) => ({ label: s, nilai: n, warna: warnaSektorKonflik(s) })),
    ...(sektorJelas.length > 6 ? [{ label: `${sektorJelas.length - 6} sektor lain`, nilai: sektorJelas.slice(6).reduce((n, [, x]) => n + x, 0), warna: "#c5ccd3" }] : []),
    ...(perSektor.find(([s]) => s === "Lainnya") ? [{ label: "Belum diketahui", nilai: perSektor.find(([s]) => s === "Lainnya")![1], warna: "#868e96" }] : []),
  ];
  const statusData: Irisan[] = STATUS_KONFLIK.map((s) => ({ label: s.nama, nilai: perStatus[s.nama] ?? 0, warna: s.warna }));
  const perJenis = urut(hitung(konflik.filter((k) => k.jenis !== "Lainnya"), (k) => k.jenis));
  const perusahaan = perusahaanTeratas(konflik, 6);
  const konflikBaru = [...konflik].sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1)).slice(0, 6);

  // ---- potensi
  const perKat = hitung(potensi, (p) => p.kategori);
  const katData: Irisan[] = KATEGORI_POTENSI.map((k) => ({ label: k.nama, nilai: perKat[k.id] ?? 0, warna: k.warna })).sort((a, b) => b.nilai - a.nilai);
  const potensiDaerah = anakFokus.map((a) => ({ label: namaLengkap(a), nilai: potensi.filter((p) => dalamWilayah(p.wilayahId, a.id)).length, href: `/?w=${a.id}` }))
    .filter((x) => x.nilai).sort((a, b) => b.nilai - a.nilai).slice(0, 12);
  const sarana = sorotanPotensi({ potensi });

  // ---- sekitar desa studi (dihitung per kecamatan karena batas desa belum ada)
  const studiBaris = DESA_STUDI.map((d) => {
    const [kab, kec] = rantai(d.id);
    const diKec = <T extends { wilayahId: string }>(xs: T[]) => (kec ? xs.filter((x) => dalamWilayah(x.wilayahId, kec.id)) : []);
    const k = diKec(db.konflik);
    return {
      id: d.id, desa: d.nama, kec: kec?.nama ?? "–", kab: kab ? namaLengkap(kab) : "–",
      konflik: k.length, aktif: k.filter((x) => konflikAktif(x.status)).length, potensi: diKec(db.potensi).length,
      berita: kab ? db.media.filter((m) => m.tipe === "berita" && m.tanggal >= b30 && dalamWilayah(m.wilayahId, kab.id)).length : 0,
    };
  });
  const studiTeratas = [...studiBaris].sort((a, b) => b.konflik - a.konflik)[0];

  // ---- pemberitaan
  const sentimenData: Irisan[] = (["negatif", "netral", "positif"] as const).map((s) => ({ label: s[0].toUpperCase() + s.slice(1), nilai: r30[s], warna: s === "netral" ? "#adb5bd" : WARNA_SENTIMEN[s], href: `/berita?s=${s}` }));
  const isuNeg = urut(hitung(berita.filter((m) => m.tanggal >= b30 && m.sentimen === "negatif" && m.isu !== "Lainnya"), (m) => m.isu)).slice(0, 6);
  const isuPos = urut(hitung(berita.filter((m) => m.tanggal >= b30 && m.sentimen === "positif" && m.isu !== "Lainnya"), (m) => m.isu)).slice(0, 6);

  // ---- kalimat "yang perlu diketahui"
  const konflikDaerah = anakFokus.map((a) => [a, konflik.filter((k) => dalamWilayah(k.wilayahId, a.id)).length] as const).sort((a, b) => b[1] - a[1]);
  const [jenis1, nJenis1] = perJenis[0] ?? [];
  const [kat1, nKat1] = urut(perKat)[0] ?? [];
  const sekilas: { ikon: LucideIcon; warna: string; teks: React.ReactNode; href?: string; lebar?: boolean }[] = [];
  if (konflikDaerah[0]?.[1]) sekilas.push({
    ikon: IkonPeta, warna: "#c2410c", href: `/?w=${konflikDaerah[0][0].id}`,
    teks: <>Konflik paling banyak ada di <b>{namaLengkap(konflikDaerah[0][0])}</b> ({konflikDaerah[0][1]} kasus){konflikDaerah[1]?.[1] ? <>, disusul {namaLengkap(konflikDaerah[1][0])} ({konflikDaerah[1][1]}).</> : "."}</>,
  });
  if (sektorJelas[0]) sekilas.push({
    ikon: AlertTriangle, warna: warnaSektorKonflik(sektorJelas[0][0]),
    teks: <>Sektor <b>{sektorJelas[0][0].toLowerCase()}</b> paling sering memicu konflik, {sektorJelas[0][1]} kasus.{jenis1 ? <> Bentuknya {nJenis1! > konflik.length / 2 ? "kebanyakan" : "paling sering"} {jenis1.toLowerCase()}.</> : null}</>,
  });
  if (konflik.length) sekilas.push({
    ikon: Activity, warna: "#e03131", href: "/peta/konflik",
    teks: <><b>{belum} kasus</b> belum ditangani sama sekali, dan {perStatus["Dalam proses"] ?? 0} lainnya masih diproses.</>,
  });
  if (r30.total) sekilas.push({
    ikon: Newspaper, warna: "#7a58a3", href: "/media",
    teks: <>Bulan ini ada {r30.total} berita, <b>{neg30}% bernada negatif</b>{rLalu.total ? (selisihNeg ? ` (${selisihNeg > 0 ? "naik" : "turun"} ${Math.abs(selisihNeg)} poin dari bulan lalu)` : " (sama seperti bulan lalu)") : null}.{isuNeg[0] ? <> Keluhan paling banyak soal {isuNeg[0][0].toLowerCase()}.</> : null}</>,
  });
  if (kat1) sekilas.push({
    ikon: Gem, warna: "#2f6690", href: "/peta/potensi",
    teks: <>Dari {ribuan(potensi.length)} titik potensi ekonomi, yang paling banyak <b>{kategoriPotensi(kat1).nama.toLowerCase()}</b> ({ribuan(nKat1!)} titik).</>,
  });

  // dua kalimat tambahan, hanya di layar sangat lebar supaya kotak tidak lebih tinggi dari peta
  if (perusahaan[0]) sekilas.push({
    ikon: Building2, warna: "#495057", lebar: true,
    teks: <>Perusahaan yang paling sering disebut dalam kasus konflik: <b>{perusahaan[0].nama}</b> ({perusahaan[0].kasus} kasus, {perusahaan[0].aktif} masih berjalan).</>,
  });
  const konflikStudi = studiBaris.reduce((n, d) => n + d.konflik, 0);
  if (!w && studiTeratas) sekilas.push({
    ikon: MapPin, warna: "#e8a100", href: "#daerah", lebar: true,
    teks: <>Di kecamatan sekitar enam desa studi ada <b>{konflikStudi} kasus konflik</b>, paling banyak di Kec. {studiTeratas.kec}.</>,
  });

  // panel "baru masuk" di hero: kasus & berita terbaru, digabung lalu diurutkan
  const baruMasuk = [
    ...konflikBaru.slice(0, 3).map((k) => ({ id: k.id, jenis: "Konflik", judul: k.judul, tanggal: k.tanggal, wilayah: labelWilayah(k.wilayahId).split(" › ").slice(0, 2).join(" › "), href: `/konflik/${encodeURIComponent(k.id)}`, warna: "#ff8a5c" })),
    ...berita.slice(0, 3).map((m) => ({ id: m.id, jenis: "Berita", judul: m.judul, tanggal: m.tanggal, wilayah: m.sumber, href: `/berita/${encodeURIComponent(m.id)}`, warna: m.sentimen === "negatif" ? "#ff8787" : m.sentimen === "positif" ? "#8ce99a" : "#ced4da" })),
  ].sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1)).slice(0, 5);

  const titikData = {
    konflik: { titik: konflik.map(titikKonflik), opsi: opsiKonflik(konflik) },
    potensi: { titik: potensi.map(titikPotensi), opsi: opsiPotensi(potensi) },
  };
  const bulat = (c: [number, number]) => [Math.round(c[0] * 50) / 50, Math.round(c[1] * 50) / 50] as [number, number];
  const unik = (xs: [number, number][]) => [...new Map(xs.map((c) => [c.join(","), c])).values()];

  // ---- tabel per kabupaten/kota
  const kabStudi = new Set(KAB_STUDI.map((k) => k.id));
  const maksPot = Math.max(1, ...KABUPATEN.map((k) => ringkasan[k.id].potensi));
  const barisKab = KABUPATEN.filter((k) => !w || dalamWilayah(k.id, w) || dalamWilayah(w, k.id)).map((kab) => {
    const r = ringkasan[kab.id];
    const sektor = urut(hitung(db.konflik.filter((k) => k.sektor !== "Lainnya" && dalamWilayah(k.wilayahId, kab.id)), (k) => k.sektor))[0];
    return {
      id: kab.id, sorot: w === kab.id,
      sel: {
        daerah: { urut: kab.nama, teks: <><Link href={`/?w=${kab.id}`} className="font-semibold hover:text-accent">{namaLengkap(kab)}</Link>{kabStudi.has(kab.id) && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800">desa studi</span>}</> },
        konflik: { urut: r.konflik, teks: <b className="text-[#c2410c]">{r.konflik}</b> },
        aktif: { urut: r.konflikAktif, teks: r.konflikAktif },
        sektor: { urut: sektor?.[0] ?? "", teks: sektor ? <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><span className="h-2 w-2 rounded-full" style={{ background: warnaSektorKonflik(sektor[0]) }} />{sektor[0]}</span> : <span className="text-muted">–</span> },
        potensi: { urut: r.potensi, teks: (
          <span className="flex items-center justify-end gap-2.5">
            <span className="flex h-2 w-28 overflow-hidden rounded-full bg-[#eef2f6]" title={KATEGORI_POTENSI.map((k) => `${k.nama}: ${r.potensiKat[k.id] ?? 0}`).join("\n")}>
              <span className="flex h-full" style={{ width: `${(r.potensi / maksPot) * 100}%` }}>
                {KATEGORI_POTENSI.map((k) => <span key={k.id} style={{ width: `${((r.potensiKat[k.id] ?? 0) / Math.max(1, r.potensi)) * 100}%`, background: k.warna }} />)}
              </span>
            </span>
            <b className="w-10">{ribuan(r.potensi)}</b>
          </span>
        ) },
        berita: { urut: r.media30, teks: r.media30 },
        nada: { urut: r.media30 ? r.indeks : -999, teks: <IndeksPill nilai={r.indeks} ada={r.media30 > 0} /> },
      },
    };
  });

  return (
    <>
      <HeroRiau
        label={fokus ? `Sedang melihat ${labelWilayah(fokus.id)}` : `Data terakhir dimuat ${tanggal(db.meta?.dimuat ?? hari)}`}
        judul={fokus ? `Konflik & potensi ekonomi di ${namaLengkap(fokus)}` : "Konflik & potensi ekonomi di Riau"}
        keterangan={fokus ? "Semua angka dan peta di halaman ini sudah difilter ke daerah ini saja." : "Pantau titik konflik, sebaran usaha, dan nada pemberitaan tentang perusahaan di 12 kabupaten/kota. Pilih daerah untuk melihat lebih dekat."}
        konflik={unik(konflik.map((k) => bulat(k.koordinat)))}
        potensi={unik(potensi.map((p) => bulat(p.koordinat)))}
        aksi={<Suspense><WilayahFilter gelap penuh /></Suspense>}
        samping={
          <div className="rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10 backdrop-blur-md">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-white/85"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff8a5c]" />Baru masuk</p>
            <ul className="mt-3 divide-y divide-white/10">
              {baruMasuk.map((b) => (
                <li key={b.id}>
                  <Link href={b.href} className="group block py-2.5">
                    <span className="flex items-center gap-2 text-[11.5px] text-white/50">
                      <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: b.warna + "26", color: b.warna }}>{b.jenis}</span>
                      {tanggal(b.tanggal)} · <span className="truncate">{b.wilayah}</span>
                    </span>
                    <span className="mt-1 line-clamp-2 text-[13.5px] font-medium leading-snug text-white/90 group-hover:text-white group-hover:underline">{b.judul}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        }
      />

      <div className="mx-auto max-w-[2400px] px-4 pb-10 sm:px-6 2xl:px-10">
        <div className="relative z-10 -mt-16 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
          <KartuAngka label="Konflik tercatat" nilai={konflik.length} ikon={AlertTriangle} warna="#c2410c" tren={konflikPerBulan} href="/peta/konflik"
            ket={`${konflik.filter((k) => k.asal === "TanahKita").length} dari TanahKita, ${konflik.filter((k) => k.asal === "Berita").length} dari berita`} />
          <KartuAngka label="Masih berjalan" nilai={aktif} ikon={Activity} warna="#e8590c" href="/peta/konflik" komposisi={statusData}
            ket={`${belum} belum ditangani, ${perStatus["Dalam proses"] ?? 0} sedang diproses`} />
          <KartuAngka label="Titik potensi ekonomi" nilai={potensi.length} ikon={Gem} warna="#2f6690" href="/peta/potensi" komposisi={katData}
            ket={`Tersebar di ${Object.keys(perKat).length} lapangan usaha`} />
          <KartuAngka label="Berita 30 hari terakhir" nilai={r30.total} ikon={Newspaper} warna="#7a58a3" href="/berita" tren={tren.map((t) => t.positif + t.netral + t.negatif)}
            delta={rLalu.total ? { teks: `${ubahVolume > 0 ? "+" : ""}${ubahVolume}%`, arah: ubahVolume > 0 ? "naik" : ubahVolume < 0 ? "turun" : "tetap" } : undefined}
            ket={`Bulan sebelumnya ${rLalu.total} berita`} />
          <KartuAngka label="Berita bernada negatif" nilai={neg30} akhiran="%" ikon={ThumbsDown} warna="#e03131" href="/media"
            tren={tren.map((t) => pct(t.negatif, t.positif + t.netral + t.negatif))}
            delta={rLalu.total ? { teks: `${Math.abs(selisihNeg)} poin`, arah: selisihNeg > 0 ? "naik" : selisihNeg < 0 ? "turun" : "tetap", baik: selisihNeg < 0 } : undefined}
            ket="Dibanding 30 hari sebelumnya" />
        </div>

        <div className="mt-6"><NavSeksi bagian={[{ id: "sekilas", label: "Sekilas" }, { id: "konflik", label: "Konflik" }, { id: "potensi", label: "Potensi ekonomi" }, { id: "media", label: "Pemberitaan" }, { id: "daerah", label: "Per daerah" }]} /></div>

        {/* SEKILAS */}
        <div id="sekilas" className="grid scroll-mt-[calc(var(--tinggi-nav)+64px)] gap-4 pt-5 xl:grid-cols-[1.55fr_1fr]">
          <Kartu judul="Peta sebaran" sub="Klik titik untuk lihat detailnya. Makin diperbesar, makin rinci sampai tingkat desa." rapat className="muncul-gulir h-[460px] overflow-hidden sm:h-[540px]"
            aksi={<span className="flex"><TautanKartu href="/peta/konflik" warna="#c2410c">Peta konflik</TautanKartu><TautanKartu href="/peta/potensi">Peta potensi</TautanKartu></span>}>
            <PetaDashboard data={titikData} ringkasan={ringkasanPoligon(ringkasan)} fokus={w} />
          </Kartu>
          <Kartu judul="Yang perlu diketahui" sub="Diringkas otomatis dari data yang ada sekarang." className="muncul-gulir">
            <ul className="space-y-1">
              {sekilas.map((s, i) => {
                const isi = (
                  <>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: s.warna + "14", color: s.warna }}><s.ikon size={17} /></span>
                    <span className="text-[14px] leading-relaxed text-ink/90">{s.teks}</span>
                  </>
                );
                return <li key={i} className={s.lebar ? "hidden 3xl:block" : ""}>{s.href ? <Link href={s.href} className="flex gap-3 rounded-xl p-2.5 transition hover:bg-[#f3f7fb]">{isi}</Link> : <div className="flex gap-3 p-2.5">{isi}</div>}</li>;
              })}
            </ul>
            <Link href="/presentasi" className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 text-sm font-semibold text-white transition hover:bg-navy-2">
              <MonitorPlay size={16} /> Tampilkan sebagai presentasi
            </Link>
          </Kartu>
        </div>

        {/* KONFLIK */}
        <JudulSeksi id="konflik" ikon={AlertTriangle} warna="#c2410c" judul="Konflik" sub={`${konflik.length} kasus dari TanahKita.id dan berita online`} aksi={<TautanKartu href="/peta/konflik" warna="#c2410c">Buka peta konflik</TautanKartu>} />
        <div className="mt-4 grid gap-4 lg:grid-cols-2 3xl:grid-cols-4">
          <Kartu judul="Status penanganan" sub="Sudah sejauh mana kasusnya ditangani" className="muncul-gulir"
            info="Status kasus dari berita dibaca otomatis dari isi artikel. Tetap perlu dicek ke lapangan.">
            <Donut data={statusData} tengah={{ nilai: String(aktif), label: "masih berjalan" }} />
            {konflik.length > 0 && <Catatan>{pct(belum, konflik.length)}% kasus belum ditangani sama sekali. Yang tercatat selesai baru {perStatus["Selesai"] ?? 0} kasus.</Catatan>}
          </Kartu>
          <Kartu judul="Bentuk konflik" sub="Masalah yang paling sering muncul" className="muncul-gulir">
            <BarHorizontal lebarLabel={170} data={perJenis.slice(0, 8).map(([l, n]) => ({ label: l, nilai: n, warna: "#c2410c" }))} />
            {jenis1 && <Catatan>{pct(nJenis1!, konflik.length) >= 50 ? "Sebagian besar" : "Paling banyak"} berupa {jenis1.toLowerCase()}, yaitu {pct(nJenis1!, konflik.length)}% dari semua kasus.</Catatan>}
          </Kartu>
          <Kartu judul="Sektor pemicu" sub="Bidang usaha tempat konflik terjadi" className="muncul-gulir">
            <Donut data={sektorData} tengah={{ nilai: String(konflik.length), label: "kasus" }} />
            {sektorJelas[0] && <Catatan>Dari kasus yang sektornya sudah jelas, {pct(sektorJelas[0][1], totalJelas)}% terjadi di sektor {sektorJelas[0][0].toLowerCase()}.</Catatan>}
          </Kartu>
          <Kartu judul="Perusahaan yang paling sering disebut" sub="Jumlah kasus yang menyebut nama perusahaan" rapat className="muncul-gulir"
            info="Satu kasus bisa menyebut lebih dari satu perusahaan. Nama yang ditulis berbeda (misalnya singkatan) sudah digabung.">
            {perusahaan.length ? (
              <table className="tabel [&_td]:!py-2">
                <thead><tr><th className="w-10">#</th><th>Perusahaan</th><th className="!text-right">Kasus</th><th className="!text-right">Berjalan</th></tr></thead>
                <tbody>
                  {perusahaan.map((p, i) => (
                    <tr key={p.nama}>
                      <td><span className="num grid h-6 w-6 place-items-center rounded-full bg-[#eef2f6] text-[11.5px] font-semibold text-muted">{i + 1}</span></td>
                      <td><span className="block font-medium leading-snug">{p.nama}</span>{p.sektor && <span className="block text-[12px] text-muted">{p.sektor}</span>}</td>
                      <td className="num text-right text-[15px] font-bold">{p.kasus}</td>
                      <td className="num text-right">{p.aktif}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="p-5 text-sm text-muted">Belum ada kasus yang menyebut nama perusahaan.</p>}
          </Kartu>
        </div>
        <Kartu judul="Kasus terbaru" rapat className="muncul-gulir mt-4 overflow-hidden" aksi={<TautanKartu href="/peta/konflik">Semua kasus</TautanKartu>}>
          <ul className="grid gap-px bg-[#eef2f6] lg:grid-cols-2 3xl:grid-cols-3">
            {konflikBaru.map((k) => (
              <li key={k.id} className="bg-surface">
                <Link href={`/konflik/${encodeURIComponent(k.id)}`} className="flex h-full items-start gap-3 px-5 py-3.5 transition hover:bg-[#f7fafd]">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: warnaSektorKonflik(k.sektor) }} />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[14px] font-medium leading-snug">{k.judul}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted"><Chip warna={warnaStatus(k.status)}>{k.status}</Chip>{labelWilayah(k.wilayahId)} · {tanggal(k.tanggal)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Kartu>

        {/* POTENSI */}
        <JudulSeksi id="potensi" ikon={Gem} warna="#2f6690" judul="Potensi ekonomi" sub={`${ribuan(potensi.length)} sarana usaha dari OpenStreetMap, dikelompokkan menurut kategori BPS`} aksi={<TautanKartu href="/peta/potensi">Buka peta potensi</TautanKartu>} />
        <div className="mt-4 grid gap-4 lg:grid-cols-2 3xl:grid-cols-3">
          <Kartu judul="Lapangan usaha" sub="Jenis kegiatan ekonominya" className="muncul-gulir"
            info="Pengelompokan mengikuti Klasifikasi Baku Lapangan Usaha Indonesia (KBLI) dari BPS.">
            <Donut data={katData} tengah={{ nilai: ribuan(potensi.length), label: "titik" }} />
            {katData[0]?.nilai > 0 && <Catatan>{katData[0].label} paling banyak, sekitar {pct(katData[0].nilai, potensi.length)}% dari semua titik. {katData[1] && <>Berikutnya {katData[1].label.toLowerCase()}.</>}</Catatan>}
          </Kartu>
          {potensiDaerah.length > 0 ? (
            <Kartu judul={fokus ? "Per kecamatan" : "Per kabupaten/kota"} sub="Daerah dengan sarana ekonomi terbanyak. Klik untuk fokus ke sana." className="muncul-gulir">
              <BarHorizontal lebarLabel={150} warna="#2f6690" data={potensiDaerah} />
              {potensiDaerah.length > 1 && <Catatan>{potensiDaerah[0].label} punya {ribuan(potensiDaerah[0].nilai)} titik, {potensiDaerah[0].nilai >= potensiDaerah[1].nilai * 2 ? `lebih dari dua kali lipat ${potensiDaerah[1].label}` : `disusul ${potensiDaerah[1].label} (${ribuan(potensiDaerah[1].nilai)})`}.</Catatan>}
            </Kartu>
          ) : null}
          <Kartu judul="Sarana ekonomi besar" sub="Kilang, pembangkit, bandara, kawasan industri, dan sejenisnya" rapat
            className={`muncul-gulir overflow-hidden ${potensiDaerah.length ? "lg:col-span-2 3xl:col-span-1" : ""}`}>
            {sarana.length ? (
              <ul className="grid flex-1 gap-px bg-[#eef2f6] sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-1">
                {sarana.map((s) => (
                  <li key={s.id} className="bg-surface">
                    <Link href={`/potensi/${encodeURIComponent(s.id)}`} className="flex h-full items-center gap-3 px-5 py-3.5 transition hover:bg-[#f7fafd]">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: kategoriPotensi(s.kategori).warna }}><Gem size={16} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{s.nama}</span>
                        <span className="block truncate text-[12px] text-muted">{s.jenis} · {s.wilayah}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="p-5 text-sm text-muted">Tidak ada sarana besar di daerah ini.</p>}
          </Kartu>
        </div>

        {/* PEMBERITAAN */}
        <JudulSeksi id="media" ikon={Newspaper} warna="#7a58a3" judul="Pemberitaan" sub="Berita online tentang perusahaan dan isu di Riau" aksi={<TautanKartu href="/media" warna="#7a58a3">Analitik lengkap</TautanKartu>} />
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.6fr] 3xl:grid-cols-[1fr_1.8fr_1fr]">
          <Kartu judul="Nada berita bulan ini" sub="30 hari terakhir" className="muncul-gulir"
            info="Indeks nada = persen berita positif dikurangi persen berita negatif. Di bawah nol artinya kabar buruk lebih banyak. Nada dibaca otomatis dari judul berita.">
            <Donut data={sentimenData} tengah={{ nilai: `${indeks > 0 ? "+" : ""}${indeks}`, label: "indeks nada" }} />
            <BandingBulan kini={r30} lalu={rLalu} />
            {r30.total > 0 && <Catatan>{r30.negatif > r30.positif ? `Kabar buruk masih lebih banyak dari kabar baik: ${r30.negatif} berita negatif lawan ${r30.positif} positif.` : `Kabar baik sedikit lebih banyak: ${r30.positif} berita positif lawan ${r30.negatif} negatif.`}</Catatan>}
          </Kartu>
          <Kartu judul="Berita per minggu" sub="Tiga bulan terakhir, dipisah menurut nadanya" aksi={<LabelSumber teks="Google News" />} className="muncul-gulir">
            <div className="relative h-[320px] lg:h-auto lg:min-h-[320px] lg:flex-1"><div className="absolute inset-0"><GrafikTren data={tren} tinggi="100%" /></div></div>
          </Kartu>
          <Kartu judul="Isu yang dibahas" sub="Topik di berita negatif dan positif bulan ini" className="muncul-gulir">
            <p className="mb-2.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#e03131]"><span className="h-2 w-2 rounded-full bg-[#e03131]" />Di berita negatif</p>
            {isuNeg.length
              ? <BarHorizontal lebarLabel={160} data={isuNeg.slice(0, 5).map(([l, n]) => ({ label: l, nilai: n, warna: "#e03131", href: `/berita?s=negatif&isu=${encodeURIComponent(l)}` }))} />
              : <p className="text-sm text-muted">Tidak ada berita negatif.</p>}
            <p className="mb-2.5 mt-5 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#2f9e44]"><span className="h-2 w-2 rounded-full bg-[#2f9e44]" />Di berita positif</p>
            {isuPos.length
              ? <BarHorizontal lebarLabel={160} data={isuPos.slice(0, 5).map(([l, n]) => ({ label: l, nilai: n, warna: "#2f9e44", href: `/berita?s=positif&isu=${encodeURIComponent(l)}` }))} />
              : <p className="text-sm text-muted">Tidak ada berita positif.</p>}
          </Kartu>
          <Kartu judul="Berita terbaru" rapat className="muncul-gulir overflow-hidden 3xl:col-span-3" aksi={<TautanKartu href="/berita">Semua berita</TautanKartu>}>
            <ul className="grid flex-1 gap-px bg-[#eef2f6] 3xl:grid-cols-3">
              {berita.slice(0, 6).map((m) => (
                <li key={m.id} className="bg-surface">
                  <Link href={`/berita/${encodeURIComponent(m.id)}`} className="flex h-full items-center gap-3.5 px-5 py-2.5 transition hover:bg-[#f7fafd]">
                    <Gambar media={m} className="h-11 w-16 shrink-0 rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[14px] font-medium leading-snug sm:line-clamp-1">{m.judul}</span>
                      <span className="mt-0.5 block truncate text-[12px] text-muted">{m.sumber} · {tanggal(m.tanggal)} · {m.isu}</span>
                    </span>
                    <ChipSentimen s={m.sentimen} />
                  </Link>
                </li>
              ))}
            </ul>
          </Kartu>
        </div>

        {/* PER DAERAH */}
        <JudulSeksi id="daerah" ikon={IkonPeta} warna="#0f1b27" judul="Per kabupaten/kota" sub="Klik judul kolom untuk mengurutkan, atau klik nama daerah untuk melihat datanya saja." />
        <div className="mt-4 grid gap-4 3xl:grid-cols-[1.9fr_1fr]">
          <Kartu rapat className="muncul-gulir overflow-hidden">
            <TabelUrut awal={{ kunci: "konflik", turun: true }}
              kolom={[
                { kunci: "daerah", judul: "Daerah" }, { kunci: "konflik", judul: "Konflik", kanan: true }, { kunci: "aktif", judul: "Masih berjalan", kanan: true },
                { kunci: "sektor", judul: "Sektor utama" }, { kunci: "potensi", judul: "Potensi ekonomi", kanan: true },
                { kunci: "berita", judul: "Berita 30 hari", kanan: true }, { kunci: "nada", judul: "Nada berita", kanan: true },
              ]}
              baris={barisKab} />
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line px-5 py-3 text-[12px] text-muted">
              <span className="font-medium text-ink/70">Warna batang potensi:</span>
              {KATEGORI_POTENSI.map((k) => <span key={k.id} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: k.warna }} />{k.nama}</span>)}
            </div>
          </Kartu>
          <Kartu judul="Sekitar desa studi" sub="Angka di kecamatan tempat keenam desa studi berada" rapat className="muncul-gulir overflow-hidden"
            info="Konflik dan potensi dihitung per kecamatan karena batas desa belum tersedia di data terbuka. Berita dihitung per kabupaten.">
            <div className="flex h-full flex-col">
            <table className="tabel">
              <thead><tr><th>Desa</th><th className="!text-right">Konflik</th><th className="!text-right">Berjalan</th><th className="!text-right">Potensi</th><th className="!text-right">Berita</th></tr></thead>
              <tbody>
                {studiBaris.map((d) => (
                  <tr key={d.id}>
                    <td><Link href={`/?w=${d.id}`} className="font-semibold hover:text-accent">{d.desa}</Link><span className="block text-[12px] text-muted">Kec. {d.kec}, {d.kab}</span></td>
                    <td className="num text-right font-bold text-[#c2410c]">{d.konflik}</td>
                    <td className="num text-right">{d.aktif}</td>
                    <td className="num text-right">{d.potensi}</td>
                    <td className="num text-right">{d.berita}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {studiTeratas && <div className="mt-auto px-5 pb-5"><Catatan>Dari keenam desa studi, Kec. {studiTeratas.kec} (desa {studiTeratas.desa}) paling banyak mencatat konflik, {studiTeratas.konflik} kasus.</Catatan></div>}
            </div>
          </Kartu>
        </div>

        <p className="mt-8 text-center text-[12.5px] text-muted">
          Sumber: TanahKita.id, OpenStreetMap, Google News, dan kamus sentimen InSet. Data aktor dan media sosial masih contoh{fokus ? ` · Fokus: ${namaWilayah(fokus.id)}` : ""}.
        </p>
      </div>
    </>
  );
}
