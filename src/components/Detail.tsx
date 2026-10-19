import Link from "next/link";
import { ExternalLink, FileText, Newspaper } from "lucide-react";
import type { Koordinat, Media, Rujukan } from "@/lib/types";
import { WARNA_SENTIMEN, domain, tanggal, tanpaTanahKita } from "@/lib/format";
import { warnaIsu } from "@/lib/kategori";

/** Potongan tampilan bersama halaman detail konflik, potensi, dan berita. */

export function JudulBagian({ children, aksi }: { children: React.ReactNode; aksi?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-y border-line bg-[#eef2f6] px-4 py-2">
      <h2 className="text-[13px] font-bold uppercase tracking-wide text-ink">{children}</h2>
      {aksi}
    </div>
  );
}

export function TabelAtribut({ baris }: { baris: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-line border-y border-line text-sm">
      {baris.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[118px_10px_1fr] gap-1 px-1 py-[7px] sm:grid-cols-[150px_12px_1fr]">
          <dt className="font-medium text-ink">{k}</dt>
          <span className="text-muted">:</span>
          <dd className="min-w-0 break-words text-ink/85">{v === "" || v === null || v === undefined ? <span className="text-muted">–</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DaftarKolom({ kolom }: { kolom: [string, string[]][] }) {
  return (
    <div className="grid gap-4 px-4 py-3 sm:grid-cols-3 sm:px-5">
      {kolom.map(([judul, isi]) => (
        <div key={judul} className="min-w-0">
          <p className="mb-1 text-sm font-semibold">{judul}</p>
          {isi.length ? (
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink/85">{isi.map((x) => <li key={x}>{x}</li>)}</ul>
          ) : <p className="text-sm text-muted">Belum tercatat</p>}
        </div>
      ))}
    </div>
  );
}

export function TautanGoogleMaps({ koordinat: [x, y] }: { koordinat: Koordinat }) {
  return (
    <a href={`https://www.google.com/maps/search/?api=1&query=${y},${x}`} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-accent hover:underline">
      Google Maps <ExternalLink size={11} />
    </a>
  );
}

export function DaftarRujukan({ list: semua, kosong }: { list: Rujukan[]; kosong: string }) {
  const list = tanpaTanahKita(semua);
  if (!list.length) return <p className="text-sm text-muted">{kosong}</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {list.map((r, i) => (
        <li key={i} className="flex items-start gap-2">
          <FileText size={15} className="mt-0.5 shrink-0 text-muted" />
          {r.url ? (
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="min-w-0 break-words text-accent hover:underline">
              {r.nama || domain(r.url)} <span className="text-xs text-muted">({domain(r.url)})</span> <ExternalLink size={12} className="inline" />
            </a>
          ) : <span>{r.nama}</span>}
        </li>
      ))}
    </ul>
  );
}

export function KartuSamping({ judul, children, aksi }: { judul: string; children: React.ReactNode; aksi?: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-[14px] font-semibold">{judul}</h2>{aksi}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function BeritaMini({ list }: { list: Media[] }) {
  if (!list.length) return <p className="text-sm text-muted">Belum ada berita terkait.</p>;
  return (
    <ul className="space-y-2.5">
      {list.map((m) => (
        <li key={m.id}>
          <Link href={`/berita/${encodeURIComponent(m.id)}`} className="group flex gap-2.5">
            <Gambar media={m} className="h-12 w-16 shrink-0 rounded" />
            <span className="min-w-0">
              <span className="line-clamp-2 text-[13px] font-medium leading-snug group-hover:text-accent">{m.judul}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: WARNA_SENTIMEN[m.sentimen] }} />{m.sumber} · {tanggal(m.tanggal)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Gambar berita; bila tidak ada, tampilkan kartu pengganti dengan inisial media dan warna isu. */
export function Gambar({ media, className = "" }: { media: Pick<Media, "gambar" | "sumber" | "isu" | "tipe">; className?: string }) {
  if (media.gambar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={media.gambar} alt="" loading="lazy" referrerPolicy="no-referrer" className={`bg-bg object-cover ${className}`} />;
  }
  const inisial = media.sumber.replace(/^(www\.)/, "").split(/[\s.·-]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  return (
    <span className={`relative grid place-items-center overflow-hidden text-white ${className}`} style={{ background: `linear-gradient(135deg, #1c2b38 15%, ${warnaIsu(media.isu)})` }} aria-hidden>
      <span className="absolute inset-0 opacity-25" style={{ backgroundImage: "repeating-linear-gradient(45deg,transparent 0 6px,rgba(255,255,255,.18) 6px 7px)" }} />
      <span className="relative flex flex-col items-center leading-none">
        {media.tipe === "sosmed" ? <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">sosmed</span> : <Newspaper size={14} className="opacity-80" />}
        <span className="mt-0.5 font-bold">{inisial || "?"}</span>
      </span>
    </span>
  );
}
