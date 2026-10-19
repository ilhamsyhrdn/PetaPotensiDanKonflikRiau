"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, X } from "lucide-react";

type Status = {
  berjalan: boolean; tahap: string; langkah: number; total: number; mulai: string | null; selesai: string | null; oleh: string | null;
  hasil: { media: number; konflik: number; potensi: number } | null; galat: string[]; otomatis: boolean; berikutnya: string | null;
};

const waktu = (iso: string) => new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) + " WIB";

/** Tombol "Perbarui" di navigasi; `hp` menampilkan panelnya di dalam menu layar penuh. */
export default function TombolPerbarui({ hp = false }: { hp?: boolean }) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [s, setS] = useState<Status | null>(null);
  const [pesan, setPesan] = useState("");
  const [kirim, setKirim] = useState(false);
  const tadiJalan = useRef(false);
  const wadah = useRef<HTMLDivElement>(null);

  const muat = useCallback(async () => {
    const r = await fetch("/api/pembaruan", { cache: "no-store" }).catch(() => null);
    if (r?.ok) setS(await r.json());
  }, []);

  useEffect(() => { muat(); }, [muat]);
  useEffect(() => {
    if (!buka && !s?.berjalan) return;
    const t = setInterval(muat, 3000);
    return () => clearInterval(t);
  }, [buka, s?.berjalan, muat]);
  // begitu selesai, tampilkan data baru tanpa memuat ulang halaman
  useEffect(() => {
    if (tadiJalan.current && s && !s.berjalan) router.refresh();
    tadiJalan.current = !!s?.berjalan;
  }, [s, router]);
  useEffect(() => {
    if (hp || !buka) return;
    const luar = (e: MouseEvent) => { if (!wadah.current?.contains(e.target as Node)) setBuka(false); };
    document.addEventListener("mousedown", luar);
    return () => document.removeEventListener("mousedown", luar);
  }, [buka, hp]);

  async function mulai() {
    setKirim(true); setPesan("");
    const r = await fetch("/api/pembaruan", { method: "POST" }).catch(() => null);
    const d = await r?.json().catch(() => null);
    if (d) setS(d);
    if (!r?.ok) setPesan(d?.pesan ?? "Gagal memulai pembaruan. Coba lagi.");
    setKirim(false);
  }

  const jalan = !!s?.berjalan;
  const panel = (
    <div className="space-y-3 text-[13px] leading-relaxed">
      <p className="text-muted">Mengambil berita dan konflik terbaru seputar Riau dari Google News &amp; GDELT, lalu menggabungkannya ke dashboard. Data yang diinput manual tidak terhapus.</p>
      {jalan && s ? (
        <div className="space-y-1.5 rounded-lg bg-accent-soft px-3 py-2.5">
          <p className="font-semibold text-accent">{s.tahap}…</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(6, (s.langkah / Math.max(1, s.total)) * 100)}%` }} /></div>
          <p className="text-[12px] text-muted">Langkah {s.langkah + 1} dari {s.total}{s.mulai && `, mulai ${waktu(s.mulai)}`}. Bisa butuh 5–15 menit; halaman ini boleh ditinggal.</p>
        </div>
      ) : (
        <dl className="space-y-1">
          <div className="flex justify-between gap-3"><dt className="text-muted">Terakhir</dt><dd className="text-right">{s?.selesai ? `${waktu(s.selesai)}${s.oleh ? ` · ${s.oleh}` : ""}` : "Belum pernah"}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Otomatis</dt><dd className="text-right">{s?.otomatis ? "Tiap hari ± 06.00 WIB" : "Nonaktif"}</dd></div>
        </dl>
      )}
      {!jalan && s?.hasil && <p className="rounded-lg bg-pos/10 px-3 py-2 text-pos">Hasil terakhir: +{s.hasil.media} berita, +{s.hasil.konflik} konflik, +{s.hasil.potensi} potensi.</p>}
      {!jalan && s?.galat.length ? <ul className="space-y-1 rounded-lg bg-neg/10 px-3 py-2 text-[12px] text-neg">{s.galat.map((g) => <li key={g}>{g}</li>)}</ul> : null}
      {pesan && <p role="alert" className="text-[12px] text-neg">{pesan}</p>}
      <button type="button" onClick={mulai} disabled={jalan || kirim}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 font-semibold text-white transition hover:bg-[#25557a] disabled:opacity-60">
        <RefreshCw size={15} className={jalan || kirim ? "animate-spin" : ""} /> {jalan ? "Sedang memperbarui…" : "Perbarui sekarang"}
      </button>
    </div>
  );

  if (hp) {
    return (
      <div className="rounded-xl bg-white/5">
        <button type="button" onClick={() => setBuka(!buka)} aria-expanded={buka} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] text-white/80">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/8"><RefreshCw size={18} className={jalan ? "animate-spin" : ""} /></span>
          <span><span className="block">Perbarui data</span><span className="block text-xs text-white/50">{jalan ? "Sedang berjalan…" : s?.selesai ? `Terakhir ${waktu(s.selesai)}` : "Ambil berita & konflik terbaru"}</span></span>
        </button>
        {buka && <div className="mx-3 mb-3 rounded-lg bg-surface p-3 text-ink">{panel}</div>}
      </div>
    );
  }

  return (
    <div ref={wadah} className="relative">
      <button type="button" onClick={() => setBuka(!buka)} aria-expanded={buka}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-[14px] transition-colors ${buka ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/[0.06] hover:text-white"}`}>
        <RefreshCw size={16} className={jalan ? "animate-spin" : ""} /> Perbarui
      </button>
      {buka && (
        <div className="anim-turun absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-line bg-surface p-4 text-ink shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold">Perbarui data</p>
            <button type="button" onClick={() => setBuka(false)} aria-label="Tutup" className="text-muted hover:text-ink"><X size={16} /></button>
          </div>
          {panel}
        </div>
      )}
    </div>
  );
}
