"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ImagePlus, Loader2, Pencil, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import type { Database, Koleksi, Peran } from "@/lib/types";
import { SKEMA, TAB_KELOLA, ratakan, type Field } from "@/lib/skema";
import { WILAYAH, getWilayah, labelWilayah } from "@/lib/wilayah";
import { labelAsal, tanggal } from "@/lib/format";
import { kategoriPotensi } from "@/lib/kategori";

type Baris = Record<string, unknown> & { id: string };


/**
 * Tabel kelola data. Pencarian & halaman diproses di server (?tab=&q=&hal=),
 * jadi browser hanya menerima satu halaman data.
 */
export default function KelolaData({ koleksi, baris, total, hal, perHal, q, jumlah, log, peran }: {
  koleksi: Koleksi; baris: Baris[]; total: number; hal: number; perHal: number; q: string;
  jumlah: Record<Koleksi, number>; log: Database["log"]; peran: Peran;
}) {
  const router = useRouter();
  const path = usePathname();
  const [memuat, mulai] = useTransition();
  const [cari, setCari] = useState(q);
  const [form, setForm] = useState<{ mode: "baru" | "ubah"; data: Baris } | null>(null);
  const [hapus, setHapus] = useState<string | null>(null);
  const [pesan, setPesan] = useState<{ jenis: "ok" | "galat"; teks: string } | null>(null);
  const [konfirmasiReset, setKonfirmasiReset] = useState(false);
  const bisaUbah = peran !== "viewer";
  const skema = SKEMA[koleksi];
  const halMaks = Math.max(1, Math.ceil(total / perHal));

  const ke = (ubah: { tab?: Koleksi; q?: string; hal?: number }) => {
    const p = new URLSearchParams({ tab: ubah.tab ?? koleksi, ...(ubah.q ?? q ? { q: ubah.q ?? q } : {}), ...((ubah.hal ?? 1) > 1 ? { hal: String(ubah.hal) } : {}) });
    mulai(() => router.push(`${path}?${p}`, { scroll: false }));
  };
  // cari otomatis setelah berhenti mengetik
  const awal = useRef(true);
  useEffect(() => {
    if (awal.current) { awal.current = false; return; }
    const t = setTimeout(() => { if (cari !== q) ke({ q: cari, hal: 1 }); }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cari]);

  async function kirim(url: string, method: string, body?: unknown) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.pesan ?? "Gagal menyimpan. Coba lagi.");
    return data;
  }
  async function simpan(data: Baris) {
    try {
      if (form?.mode === "ubah") await kirim(`/api/data/${koleksi}/${encodeURIComponent(data.id)}`, "PUT", data);
      else await kirim(`/api/data/${koleksi}`, "POST", data);
      setPesan({ jenis: "ok", teks: form?.mode === "ubah" ? "Perubahan disimpan." : `Data ${skema.tunggal} ditambahkan.` });
      setForm(null);
      router.refresh();
    } catch (e) { return (e as Error).message; }
  }
  async function hapusItem(id: string) {
    try { await kirim(`/api/data/${koleksi}/${encodeURIComponent(id)}`, "DELETE"); setPesan({ jenis: "ok", teks: "Data dihapus." }); router.refresh(); }
    catch (e) { setPesan({ jenis: "galat", teks: (e as Error).message }); }
    setHapus(null);
  }
  async function reset() {
    try { await kirim("/api/data/reset", "POST"); setPesan({ jenis: "ok", teks: "Data dimuat ulang dari sumber terbuka." }); router.refresh(); }
    catch (e) { setPesan({ jenis: "galat", teks: (e as Error).message }); }
    setKonfirmasiReset(false);
  }

  const sel = (b: Baris, kunci: string) => {
    const v = b[kunci];
    if (kunci === "wilayahId") return labelWilayah(String(v));
    if (kunci === "tanggal") return v ? tanggal(String(v)) : "";
    if (kunci === "kategori" && koleksi === "potensi") return kategoriPotensi(String(v)).nama;
    return String(v ?? "");
  };
  const lencanaAsal = (b: Baris) => <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${b.asal === "Input" ? "bg-accent-soft text-accent" : b.asal === "Contoh" ? "bg-amber-100 text-amber-800" : "bg-bg text-muted"}`}>{labelAsal(String(b.asal ?? ""))}</span>;
  const aksi = (b: Baris) => hapus === b.id ? (
    <span className="inline-flex items-center gap-2 text-xs">Hapus data ini?
      <button onClick={() => hapusItem(b.id)} className="rounded bg-neg px-2 py-1 font-semibold text-white">Hapus</button>
      <button onClick={() => setHapus(null)} className="rounded border border-line px-2 py-1">Batal</button>
    </span>
  ) : (
    <span className="inline-flex gap-1">
      <button onClick={() => setForm({ mode: "ubah", data: ratakan(koleksi, b) as Baris })} aria-label="Ubah" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-accent-soft hover:text-accent"><Pencil size={15} /></button>
      <button onClick={() => setHapus(b.id)} aria-label="Hapus" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-neg/10 hover:text-neg"><Trash2 size={15} /></button>
    </span>
  );

  return (
    <div className="space-y-3">
      {!bisaUbah && <p className="rounded-xl border border-line bg-accent-soft px-4 py-2.5 text-sm">Akun viewer hanya bisa melihat data. Masuk sebagai admin atau editor untuk mengubah.</p>}
      {pesan && (
        <p role="status" className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-sm ${pesan.jenis === "ok" ? "bg-pos/10 text-pos" : "bg-neg/10 text-neg"}`}>
          {pesan.teks}<button onClick={() => setPesan(null)} aria-label="Tutup pesan"><X size={16} /></button>
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" className="-mx-4 flex gap-1 overflow-x-auto px-4 text-sm sm:mx-0 sm:rounded-xl sm:border sm:border-line sm:bg-surface sm:p-1 sm:px-1">
          {TAB_KELOLA.map((t) => (
            <button key={t} role="tab" aria-selected={koleksi === t} onClick={() => { setCari(""); setHapus(null); ke({ tab: t, q: "", hal: 1 }); }}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 ${koleksi === t ? "bg-navy font-semibold text-white" : "bg-surface text-muted hover:text-ink sm:bg-transparent"}`}>
              {SKEMA[t].label} <span className="num opacity-70">({jumlah[t].toLocaleString("id-ID")})</span>
            </button>
          ))}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm sm:flex-none" htmlFor="cari-data">
            {memuat ? <Loader2 size={15} className="animate-spin text-muted" /> : <Search size={15} className="text-muted" />}
            <input id="cari-data" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari judul, wilayah, sektor…" className="w-full min-w-0 bg-transparent outline-none sm:w-56" />
          </label>
          {bisaUbah && (
            <button onClick={() => setForm({ mode: "baru", data: { id: "", kerahasiaan: "Publik", tanggal: new Date().toISOString().slice(0, 10), ...(koleksi === "media" ? { tipe: "berita" } : {}), ...(koleksi === "konflik" ? { status: "Belum ditangani" } : {}), ...(koleksi === "potensi" ? { status: "Beroperasi" } : {}), ...(koleksi === "dokumen" ? { status: "Belum dicari" } : {}) } })}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#25557a]">
              <Plus size={16} /> <span className="hidden sm:inline">Tambah</span> {skema.tunggal}
            </button>
          )}
        </div>
      </div>

      <div className={`card overflow-hidden transition-opacity ${memuat ? "opacity-60" : ""}`}>
        {/* tabel (layar lebar) */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead>
              <tr className="text-left">
                {skema.kolom.map((k) => <th key={k.kunci} className="eyebrow bg-bg px-3 py-2 font-medium">{k.label}</th>)}
                {bisaUbah && <th className="eyebrow bg-bg px-3 py-2 text-right font-medium">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {baris.map((b) => (
                <tr key={b.id} className="border-t border-line align-top hover:bg-bg/50">
                  {skema.kolom.map((k, i) => (
                    <td key={k.kunci} className={`px-3 py-2 ${i === 0 ? "max-w-md font-medium" : "text-ink/80"}`}>{k.kunci === "asal" ? lencanaAsal(b) : sel(b, k.kunci)}</td>
                  ))}
                  {bisaUbah && <td className="whitespace-nowrap px-3 py-1.5 text-right">{aksi(b)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* daftar kartu (HP) */}
        <ul className="divide-y divide-line md:hidden">
          {baris.map((b) => (
            <li key={b.id} className="px-4 py-3">
              <p className="text-[14px] font-semibold leading-snug">{sel(b, skema.kolom[0].kunci)}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                {skema.kolom.slice(1).map((k) => k.kunci === "asal" ? <span key={k.kunci}>{lencanaAsal(b)}</span> : sel(b, k.kunci) ? <span key={k.kunci}>{sel(b, k.kunci)}</span> : null)}
              </p>
              {bisaUbah && <div className="mt-1.5 flex justify-end">{aksi(b)}</div>}
            </li>
          ))}
        </ul>
        {baris.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">Belum ketemu data yang cocok. Coba kata kunci lain.</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-xs text-muted">
          <span>Menampilkan {total ? (hal - 1) * perHal + 1 : 0}–{Math.min(hal * perHal, total)} dari {total.toLocaleString("id-ID")}</span>
          <span className="flex items-center gap-1">
            <button disabled={hal <= 1 || memuat} onClick={() => ke({ hal: hal - 1 })} className="rounded-md border border-line px-2.5 py-1 disabled:opacity-40">‹ Sebelumnya</button>
            <span className="num px-2">{hal} / {halMaks}</span>
            <button disabled={hal >= halMaks || memuat} onClick={() => ke({ hal: hal + 1 })} className="rounded-md border border-line px-2.5 py-1 disabled:opacity-40">Berikutnya ›</button>
          </span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-semibold">Riwayat perubahan</h2>
          {log.length === 0 ? <p className="text-sm text-muted">Belum ada perubahan. Nanti setiap data yang ditambah, diubah, atau dihapus muncul di sini.</p> : (
            <ul className="space-y-1.5 text-sm">
              {log.slice(0, 10).map((l, i) => (
                <li key={i} className="flex flex-wrap gap-x-3"><span className="num font-mono text-xs text-muted">{new Date(l.waktu).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</span><b className="font-medium">{l.oleh}</b><span>{l.aksi}</span></li>
              ))}
            </ul>
          )}
        </section>
        {peran === "admin" && (
          <section className="card space-y-2 p-4 text-sm">
            <h2 className="font-semibold">Muat ulang data sumber</h2>
            <p className="text-muted">Kembalikan semua data ke hasil pengambilan data terbuka terakhir. Hati-hati, data yang diinput manual ikut hilang, kecuali daftar dokumen baseline.</p>
            <p className="text-xs text-muted">Untuk mengambil data terbaru: jalankan <code className="rounded bg-bg px-1">npm run data</code> lalu tekan tombol ini.</p>
            {konfirmasiReset ? (
              <div className="flex gap-2"><button onClick={reset} className="rounded-lg bg-neg px-3 py-1.5 font-semibold text-white">Ya, muat ulang</button><button onClick={() => setKonfirmasiReset(false)} className="rounded-lg border border-line px-3 py-1.5">Batal</button></div>
            ) : (
              <button onClick={() => setKonfirmasiReset(true)} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 font-semibold"><RotateCcw size={14} /> Muat ulang data</button>
            )}
          </section>
        )}
      </div>

      {form && <FormIsian koleksi={koleksi} awal={form.data} mode={form.mode} tutup={() => setForm(null)} simpan={simpan} />}
    </div>
  );
}

const OPSI_WILAYAH = WILAYAH.map((w) => ({ id: w.id, level: w.level, label: w.level === "provinsi" ? "Provinsi Riau (tanpa lokasi spesifik)" : labelWilayah(w.id) }));

function FormIsian({ koleksi, awal, mode, tutup, simpan }: {
  koleksi: Koleksi; awal: Baris; mode: "baru" | "ubah"; tutup: () => void; simpan: (d: Baris) => Promise<string | undefined>;
}) {
  const skema = SKEMA[koleksi];
  const [nilai, setNilai] = useState<Baris>(() => ({ ...awal }));
  const [galat, setGalat] = useState("");
  const [proses, setProses] = useState(false);
  const [sibuk, setSibuk] = useState(false); // gambar sedang diunggah
  const set = (k: string, v: unknown) => setNilai((n) => ({ ...n, [k]: v }));

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setProses(true); setGalat("");
    const g = await simpan(nilai);
    if (g) setGalat(g);
    setProses(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy/40" onClick={tutup}>
      <form onSubmit={kirim} onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-2xl flex-col bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-bold">{mode === "baru" ? `Tambah ${skema.tunggal}` : `Ubah ${skema.tunggal}`}</h2>
          <button type="button" onClick={tutup} aria-label="Tutup form" className="text-muted hover:text-ink"><X size={18} /></button>
        </div>
        <div className="grid flex-1 content-start gap-x-4 gap-y-3 overflow-y-auto px-5 py-4 sm:grid-cols-2">
          {skema.field.map((f) => (
            <div key={f.kunci} className={`min-w-0 space-y-1 ${f.lebar === "setengah" ? "" : "sm:col-span-2"}`}>
              <label htmlFor={`f-${f.kunci}`} className="text-[13px] font-medium">{f.label}{f.wajib && <span className="text-neg"> *</span>}</label>
              <Kontrol f={f} nilai={nilai} set={set} setSibuk={setSibuk} />
              {f.bantuan && <p className="text-[11px] text-muted">{f.bantuan}</p>}
            </div>
          ))}
        </div>
        <div className="space-y-2 border-t border-line px-5 py-3">
          {galat && <p role="alert" className="rounded-md bg-neg/10 px-3 py-2 text-sm text-neg">{galat}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={tutup} className="rounded-md border border-line px-4 py-2 text-sm">Batal</button>
            <button type="submit" disabled={proses || sibuk} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{sibuk ? "Menunggu unggahan…" : proses ? "Menyimpan…" : mode === "baru" ? "Simpan" : "Simpan perubahan"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

const kelasInput = "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

function Kontrol({ f, nilai, set, setSibuk }: { f: Field; nilai: Baris; set: (k: string, v: unknown) => void; setSibuk: (b: boolean) => void }) {
  const id = `f-${f.kunci}`;
  const v = nilai[f.kunci];
  switch (f.tipe) {
    case "panjang": case "rujukan": case "indikator":
      return <textarea id={id} rows={f.baris ?? (f.tipe === "rujukan" ? 2 : 3)} className={kelasInput} value={String(v ?? "")} onChange={(e) => set(f.kunci, e.target.value)} />;
    case "pilih":
      return (
        <select id={id} className={kelasInput} value={String(v ?? "")} onChange={(e) => set(f.kunci, e.target.value)}>
          <option value="">Pilih…</option>
          {f.opsi!.map((o) => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.nilai} value={o.nilai}>{o.label}</option>)}
        </select>
      );
    case "tanggal": return <input id={id} type="date" className={kelasInput} value={String(v ?? "")} onChange={(e) => set(f.kunci, e.target.value)} />;
    case "angka": case "desimal":
      return <input id={id} type="number" step={f.tipe === "desimal" ? "any" : 1} min={f.min} max={f.max} className={kelasInput} value={v === undefined || v === null ? "" : String(v)} onChange={(e) => set(f.kunci, e.target.value === "" ? null : Number(e.target.value))} />;
    case "daftar": return <input id={id} className={kelasInput} value={Array.isArray(v) ? v.join(", ") : String(v ?? "")} onChange={(e) => set(f.kunci, e.target.value)} />;
    case "url": return <input id={id} type="url" placeholder="https://" className={kelasInput} value={String(v ?? "")} onChange={(e) => set(f.kunci, e.target.value)} />;
    case "wilayah": return <PilihWilayah id={id} f={f} nilai={String(v ?? "")} ubah={(x) => set(f.kunci, x)} />;
    case "gambar": return <PilihGambar id={id} nilai={String(v ?? "")} ubah={(x) => set(f.kunci, x)} setSibuk={setSibuk} />;
    case "koordinat": {
      const k = (Array.isArray(v) ? v : []) as (number | undefined)[];
      const w = getWilayah(String(nilai.wilayahId ?? ""));
      return (
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-2">
            <input id={id} aria-label="Lintang (latitude)" placeholder="Lintang, mis. 1.40211" type="number" step="any" className={kelasInput} value={k[1] ?? ""} onChange={(e) => set(f.kunci, [k[0], e.target.value === "" ? undefined : Number(e.target.value)])} />
            <input aria-label="Bujur (longitude)" placeholder="Bujur, mis. 101.15801" type="number" step="any" className={kelasInput} value={k[0] ?? ""} onChange={(e) => set(f.kunci, [e.target.value === "" ? undefined : Number(e.target.value), k[1]])} />
          </div>
          <p className="text-[11px] text-muted">Kosongkan untuk memakai titik tengah wilayah.{w && w.level !== "provinsi" && <> <button type="button" className="font-semibold text-accent hover:underline" onClick={() => set(f.kunci, w.koordinat)}>Isi dengan titik {w.nama}</button></>}</p>
        </div>
      );
    }
    default: return <input id={id} className={kelasInput} value={String(v ?? "")} onChange={(e) => set(f.kunci, e.target.value)} />;
  }
}

/** Kotak isian wilayah yang bisa diketik & dicari (±2.000 pilihan kab/kec/desa). */
function PilihWilayah({ id, f, nilai, ubah }: { id: string; f: Field; nilai: string; ubah: (id: string) => void }) {
  const opsi = useMemo(() => OPSI_WILAYAH.filter((o) => f.level!.includes(o.level)), [f.level]);
  const [teks, setTeks] = useState(() => opsi.find((o) => o.id === nilai)?.label ?? "");
  return (
    <>
      <input id={id} list={`${id}-daftar`} className={kelasInput} placeholder="Ketik nama kabupaten, kecamatan, atau desa…" value={teks}
        onChange={(e) => { setTeks(e.target.value); const cocok = opsi.find((o) => o.label === e.target.value); ubah(cocok ? cocok.id : ""); }} />
      <datalist id={`${id}-daftar`}>{opsi.map((o) => <option key={o.id} value={o.label} />)}</datalist>
      {teks && !nilai && <p className="text-[11px] text-neg">Pilih salah satu wilayah dari daftar.</p>}
    </>
  );
}

function PilihGambar({ id, nilai, ubah, setSibuk }: { id: string; nilai: string; ubah: (url: string) => void; setSibuk: (b: boolean) => void }) {
  const berkas = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  async function unggah(f: File) {
    setStatus("Mengunggah…");
    setSibuk(true);
    const fd = new FormData();
    fd.append("berkas", f);
    const res = await fetch("/api/unggah", { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { ubah(d.url); setStatus(""); } else setStatus(d.pesan ?? "Gagal mengunggah.");
    setSibuk(false);
  }
  return (
    <div className="flex gap-3">
      <div className="grid h-20 w-28 shrink-0 place-items-center overflow-hidden rounded-md border border-dashed border-line bg-bg">
        {nilai ? <img src={nilai} alt="Pratinjau gambar" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : <ImagePlus size={22} className="text-muted" />}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <input ref={berkas} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => e.target.files?.[0] && unggah(e.target.files[0])} />
        <div className="flex gap-2">
          <button type="button" onClick={() => berkas.current?.click()} className="rounded-md border border-line px-3 py-1.5 text-sm font-semibold hover:bg-bg">Unggah gambar</button>
          {nilai && <button type="button" onClick={() => ubah("")} className="rounded-md px-2 py-1.5 text-sm text-muted hover:text-neg">Hapus</button>}
        </div>
        <input id={id} type="url" placeholder="atau tempel URL gambar https://…" className={kelasInput} value={nilai.startsWith("/api/") ? "" : nilai} onChange={(e) => ubah(e.target.value)} />
        {status && <p className="text-[11px] text-muted">{status}</p>}
      </div>
    </div>
  );
}
