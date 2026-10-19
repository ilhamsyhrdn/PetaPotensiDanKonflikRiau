"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Flame, Gauge, Minus, Newspaper, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import type { Media } from "@/lib/types";
import type { Letupan } from "@/lib/letupan";
import { WARNA_SENTIMEN, geserHari, indeksSentimen, ringkasSentimen, tanggal, tanggalPendek } from "@/lib/format";
import { ISU_MEDIA } from "@/lib/kategori";
import { KABUPATEN, dalamWilayah, labelWilayah } from "@/lib/wilayah";
import { Gambar } from "./Detail";
import { BandingBulan, Catatan, ChipSentimen, IndeksPill, Kartu, KartuAngka, LabelSumber, TautanKartu } from "./ui";
import { Donut, type Irisan } from "./Grafik";

type Tab = "semua" | "berita" | "sosmed";

export default function MediaView({ media, letupan, hari }: { media: Media[]; letupan: Record<Tab, { negatif: Letupan[]; positif: Letupan[] }>; hari: string }) {
  const [tab, setTab] = useState<Tab>("berita");
  const data = useMemo(() => (tab === "semua" ? media : media.filter((m) => m.tipe === tab)), [media, tab]);
  const b30 = geserHari(hari, -30);
  const d30 = useMemo(() => data.filter((m) => m.tanggal >= b30), [data, b30]);
  const r30 = ringkasSentimen(d30);
  const b60 = geserHari(hari, -60);
  const rLalu = ringkasSentimen(data.filter((m) => m.tanggal >= b60 && m.tanggal < b30));

  const harian = useMemo(() => {
    const out: { t: string; label: string; positif: number; netral: number; negatif: number }[] = [];
    for (let t = geserHari(hari, -90); t <= hari; t = geserHari(t, 1)) out.push({ t, label: tanggalPendek(t), positif: 0, netral: 0, negatif: 0 });
    const idx = new Map(out.map((o, i) => [o.t, i]));
    for (const m of data) { const i = idx.get(m.tanggal); if (i !== undefined) out[i][m.sentimen]++; }
    return out;
  }, [data, hari]);

  const perIsu = useMemo(() => ISU_MEDIA.map((isu) => {
    const r = ringkasSentimen(d30.filter((m) => m.isu === isu));
    return { isu, ...r };
  }).filter((x) => x.total).sort((a, b) => b.total - a.total), [d30]);
  const perKab = useMemo(() => KABUPATEN.map((k) => ({ k, r: ringkasSentimen(d30.filter((m) => dalamWilayah(m.wilayahId, k.id))) })).sort((a, b) => b.r.total - a.r.total), [d30]);
  const perSumber = useMemo(() => {
    const n = new Map<string, Media[]>();
    for (const m of d30) n.set(m.sumber, [...(n.get(m.sumber) ?? []), m]);
    return [...n.entries()].map(([s, xs]) => ({ s, r: ringkasSentimen(xs) })).sort((a, b) => b.r.total - a.r.total).slice(0, 12);
  }, [d30]);
  const lt = letupan[tab];
  const tanpaLokasi = d30.filter((m) => m.wilayahId === "riau").length;


  const sentimenData: Irisan[] = (["negatif", "netral", "positif"] as const).map((s) => ({ label: s[0].toUpperCase() + s.slice(1), nilai: r30[s], warna: s === "netral" ? "#adb5bd" : WARNA_SENTIMEN[s] }));
  const indeks = indeksSentimen(r30);
  const p = (n: number) => (r30.total ? Math.round((n / r30.total) * 100) : 0);
  const satuan = tab === "sosmed" ? "unggahan" : tab === "semua" ? "item" : "berita";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="inline-flex gap-1 rounded-full border border-line bg-surface p-1 text-sm shadow-sm">
          {([["berita", "Berita online"], ["sosmed", "Media sosial"], ["semua", "Gabungan"]] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 transition ${tab === k ? "bg-navy font-semibold text-white shadow-sm" : "text-muted hover:text-ink"}`}>{l}</button>
          ))}
        </div>
        <p className="text-[12.5px] text-muted">{tab === "sosmed" ? "Data media sosial masih contoh. Belum ada sumber gratis yang bisa dipakai." : "Berita diambil dari Google News. Nadanya dibaca otomatis dari judul."}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1">
        <KartuAngka label={`Total ${satuan}, 30 hari`} nilai={r30.total} ikon={Newspaper} warna="#7a58a3" ket="Semua nada digabung" />
        <KartuAngka label="Bernada positif" nilai={p(r30.positif)} akhiran="%" ikon={ThumbsUp} warna="#2f9e44" ket={`${r30.positif} ${satuan}`} />
        <KartuAngka label="Netral" nilai={p(r30.netral)} akhiran="%" ikon={Minus} warna="#868e96" ket={`${r30.netral} ${satuan}`} />
        <KartuAngka label="Bernada negatif" nilai={p(r30.negatif)} akhiran="%" ikon={ThumbsDown} warna="#e03131" ket={`${r30.negatif} ${satuan}`} />
        <KartuAngka label="Indeks nada" nilai={indeks} ikon={Gauge} warna={indeks < -15 ? "#e03131" : indeks > 15 ? "#2f9e44" : "#2f6690"}
          ket={indeks < 0 ? "Kabar buruk lebih banyak" : indeks > 0 ? "Kabar baik lebih banyak" : "Seimbang"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Kartu judul="Jumlah berita per hari" sub="Tiga bulan terakhir. Kotak berwarna menandai hari-hari saat berita tiba-tiba ramai."
          info="Lonjakan = hari ketika berita negatif (atau positif) tiga kali lebih banyak dari rata-rata dua minggu sebelumnya, minimal 4 berita."
          aksi={<span className="flex items-center gap-3 whitespace-nowrap text-[11.5px] text-muted"><span className="flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm bg-neg/15 ring-1 ring-neg/40" />lonjakan negatif</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm bg-pos/15 ring-1 ring-pos/40" />lonjakan positif</span></span>}>
          {/* Di layar lebar tinggi grafik mengikuti kartu sebelahnya agar tidak ada ruang kosong */}
          <div className="relative h-[280px] xl:h-full xl:min-h-[280px]"><div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={harian} margin={{ top: 6, right: 6, bottom: 0, left: -22 }} barCategoryGap={1}>
              <CartesianGrid vertical={false} stroke="#eef2f6" strokeDasharray="4 4" />
              <XAxis dataKey="label" tick={{ fontSize: 11.5, fill: "#5b6b7c" }} tickLine={false} interval={13} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11.5, fill: "#5b6b7c" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5eaf0", fontSize: 12.5, boxShadow: "0 10px 30px -12px rgb(16 24 40 / 0.25)" }} />
              {[...lt.negatif, ...lt.positif].map((l) => (
                <ReferenceArea key={l.sentimen + l.dari} x1={tanggalPendek(l.dari)} x2={tanggalPendek(l.sampai)} fill={WARNA_SENTIMEN[l.sentimen]} fillOpacity={0.1} stroke={WARNA_SENTIMEN[l.sentimen]} strokeOpacity={0.35} />
              ))}
              <Bar dataKey="negatif" name="Negatif" stackId="s" fill={WARNA_SENTIMEN.negatif} isAnimationActive={false} />
              <Bar dataKey="netral" name="Netral" stackId="s" fill="#ced4da" isAnimationActive={false} />
              <Bar dataKey="positif" name="Positif" stackId="s" fill={WARNA_SENTIMEN.positif} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
          </div></div>
        </Kartu>
        <Kartu judul="Komposisi nada" sub="30 hari terakhir"
          info="Indeks nada = persen positif dikurangi persen negatif. Di bawah nol artinya kabar buruk lebih banyak.">
          <Donut data={sentimenData} tengah={{ nilai: `${indeks > 0 ? "+" : ""}${indeks}`, label: "indeks nada" }} ukuran={168} />
          <BandingBulan kini={r30} lalu={rLalu} />
          {r30.total > 0 && <Catatan>{r30.negatif > r30.positif
            ? `Dari ${r30.total} ${satuan}, ${r30.negatif} bernada negatif. Kabar buruk masih lebih banyak dari kabar baik.`
            : `Dari ${r30.total} ${satuan}, ${r30.positif} bernada positif. Kabar baik sedikit lebih banyak dari kabar buruk.`}</Catatan>}
        </Kartu>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {(["negatif", "positif"] as const).map((s) => (
          <Kartu key={s} judul={s === "negatif" ? "Lonjakan berita negatif" : "Lonjakan berita positif"} sub={s === "negatif" ? "Saat kabar buruk tiba-tiba ramai" : "Saat kabar baik tiba-tiba ramai"}
            ikon={s === "negatif" ? Flame : Sparkles} warna={WARNA_SENTIMEN[s]}>
            {lt[s].length === 0 ? <p className="text-sm text-muted">Tidak ada lonjakan dalam 90 hari terakhir.</p> : (
              <ul className="space-y-4">
                {lt[s].slice(0, 3).map((l) => (
                  <li key={l.dari} className="rounded-xl border border-line p-3">
                    <p className="flex items-start justify-between gap-2 text-[14px] font-semibold"><span>{l.isu}</span><span className="num shrink-0 rounded-full px-2 py-0.5 text-[11.5px]" style={{ background: WARNA_SENTIMEN[s] + "14", color: WARNA_SENTIMEN[s] }}>{l.jumlah} {satuan}</span></p>
                    <p className="mt-0.5 text-[12px] text-muted">{l.dari === l.sampai ? tanggal(l.dari) : `${tanggalPendek(l.dari)} – ${tanggal(l.sampai)}`} · {labelWilayah(l.wilayahId)}</p>
                    <ul className="mt-2 space-y-1 text-[13px]">
                      {l.contoh.slice(0, 2).map((m) => <li key={m.id}><Link href={`/berita/${encodeURIComponent(m.id)}`} className="line-clamp-1 text-ink/85 hover:text-accent">“{m.judul}”</Link></li>)}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Kartu>
        ))}
        <Kartu judul="Topik yang dibahas" sub="30 hari terakhir, warna menunjukkan nadanya" aksi={<LabelSumber teks="kata kunci" />}>
          <ul className="space-y-3">
            {perIsu.map((i) => (
              <li key={i.isu}>
                <Link href={`/berita?isu=${encodeURIComponent(i.isu)}`} className="block hover:text-accent">
                  <span className="flex justify-between text-[13px]"><span>{i.isu}</span><b className="num">{i.total}</b></span>
                  <span className="mt-1 flex h-2 overflow-hidden rounded-full bg-[#eef2f6]" style={{ width: `${(i.total / Math.max(1, perIsu[0].total)) * 100}%` }}>
                    {(["negatif", "netral", "positif"] as const).map((s) => <span key={s} style={{ width: `${(i[s] / i.total) * 100}%`, background: s === "netral" ? "#ced4da" : WARNA_SENTIMEN[s] }} />)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Kartu>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Kartu judul="Nada berita per daerah" sub="30 hari terakhir. Klik nama daerah untuk melihat datanya saja." rapat>
          <div className="overflow-x-auto"><table className="tabel">
            <thead><tr><th>Daerah</th><th>Komposisi nada</th><th className="!text-right">Jumlah</th><th className="!text-right">Indeks</th></tr></thead>
            <tbody>
              {perKab.map(({ k, r }) => (
                <tr key={k.id}>
                  <td><Link href={`/media?w=${k.id}`} className="font-medium hover:text-accent">{k.nama}</Link></td>
                  <td className="w-[38%]">
                    <span className="flex h-2 overflow-hidden rounded-full bg-[#eef2f6]">
                      {(["negatif", "netral", "positif"] as const).map((s) => <span key={s} style={{ width: `${(r[s] / Math.max(1, r.total)) * 100}%`, background: s === "netral" ? "#ced4da" : WARNA_SENTIMEN[s] }} />)}
                    </span>
                  </td>
                  <td className="num text-right">{r.total}</td>
                  <td className="text-right"><IndeksPill nilai={indeksSentimen(r)} ada={r.total > 0} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
          {tanpaLokasi > 0 && <p className="border-t border-line px-5 py-2.5 text-[12px] text-muted">{tanpaLokasi} {satuan} lainnya membahas Riau secara umum, tanpa menyebut kabupaten tertentu.</p>}
        </Kartu>
        <Kartu judul="Media yang paling sering memberitakan" sub="30 hari terakhir" rapat>
          <div className="overflow-x-auto"><table className="tabel">
            <thead><tr><th>Media</th><th>Komposisi nada</th><th className="!text-right">Jumlah</th></tr></thead>
            <tbody>
              {perSumber.map(({ s, r }) => (
                <tr key={s}>
                  <td className="max-w-[220px] truncate font-medium">{s}</td>
                  <td className="w-[40%]">
                    <span className="flex h-2 overflow-hidden rounded-full bg-[#eef2f6]">
                      {(["negatif", "netral", "positif"] as const).map((x) => <span key={x} style={{ width: `${(r[x] / Math.max(1, r.total)) * 100}%`, background: x === "netral" ? "#ced4da" : WARNA_SENTIMEN[x] }} />)}
                    </span>
                  </td>
                  <td className="num text-right font-semibold">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Kartu>
      </div>

      <Kartu judul="Berita terbaru" rapat aksi={<TautanKartu href={`/berita${tab === "sosmed" ? "?tipe=sosmed" : ""}`}>Buka halaman Berita</TautanKartu>}>
        <ul className="grid grid-cols-1 gap-px bg-[#eef2f6] lg:grid-cols-2 3xl:grid-cols-3">
          {data.slice(0, 12).map((m) => (
            <li key={m.id} className="bg-surface">
              <Link href={`/berita/${encodeURIComponent(m.id)}`} className="flex items-center gap-3.5 px-5 py-2.5 transition hover:bg-[#f7fafd]">
                <Gambar media={m} className="h-11 w-16 shrink-0 rounded-lg" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-[14px] font-medium">{m.judul}</span>
                  <span className="block truncate text-[12px] text-muted">{m.sumber} · {m.isu} · {tanggal(m.tanggal)}</span>
                </span>
                <ChipSentimen s={m.sentimen} />
              </Link>
            </li>
          ))}
        </ul>
      </Kartu>
    </div>
  );
}
