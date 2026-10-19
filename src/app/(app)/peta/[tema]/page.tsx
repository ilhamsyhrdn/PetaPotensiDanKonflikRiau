import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Gem } from "lucide-react";
import PetaTematik from "@/components/PetaTematik";
import WilayahFilter from "@/components/WilayahFilter";
import { bacaDb } from "@/lib/db";
import { hitungRingkasan, ringkasanPoligon } from "@/lib/ringkasan";
import { opsiKonflik, opsiPotensi, titikKonflik, titikPotensi } from "@/lib/titik";

export const dynamic = "force-dynamic";

const TEMA = {
  konflik: { judul: "Peta konflik", pendek: "Konflik", ket: "Konflik lahan, lingkungan, dan sosial. Sumbernya data sekunder dan berita online.", ikon: AlertTriangle, warna: "#A23A1C" },
  potensi: { judul: "Peta potensi ekonomi", pendek: "Potensi ekonomi", ket: "Sarana usaha dari OpenStreetMap, dikelompokkan menurut kategori BPS.", ikon: Gem, warna: "#2F6690" },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ tema: string }> }) {
  const { tema } = await params;
  return { title: `${tema === "potensi" ? "Peta Potensi Ekonomi" : "Peta Konflik"} · Dashboard Potensi Ekonomi & Peta Konflik` };
}

export default async function PetaPage({ params, searchParams }: { params: Promise<{ tema: string }>; searchParams: Promise<{ w?: string }> }) {
  const { tema } = await params;
  if (tema !== "konflik" && tema !== "potensi") notFound();
  const { w } = await searchParams;
  const db = await bacaDb();
  const titik = tema === "konflik" ? db.konflik.map(titikKonflik) : db.potensi.map(titikPotensi);
  const opsi = tema === "konflik" ? opsiKonflik(db.konflik) : opsiPotensi(db.potensi);

  return (
    <div className="flex h-[calc(100dvh-var(--tinggi-nav))] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2 sm:flex-nowrap sm:gap-3 sm:px-6">
        <div role="tablist" aria-label="Jenis peta" className="grid w-full shrink-0 grid-cols-2 gap-1 rounded-lg bg-bg p-1 text-[13px] sm:w-auto sm:text-sm">
          {(["konflik", "potensi"] as const).map((t) => {
            const Ikon = TEMA[t].ikon;
            return (
              <Link key={t} href={`/peta/${t}${w ? `?w=${w}` : ""}`} role="tab" aria-selected={tema === t}
                className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 sm:px-3 ${tema === t ? "bg-surface font-semibold shadow-sm" : "text-muted hover:text-ink"}`}
                style={tema === t ? { color: TEMA[t].warna } : undefined}>
                <Ikon size={15} /> <span className="sm:hidden">{TEMA[t].pendek}</span><span className="hidden sm:inline">{TEMA[t].judul}</span>
              </Link>
            );
          })}
        </div>
        <p className="hidden min-w-0 flex-1 truncate text-xs text-muted xl:block" title={TEMA[tema].ket}>{TEMA[tema].ket}</p>
        <div className="w-full min-w-0 sm:ml-auto sm:w-auto"><Suspense><WilayahFilter penuh /></Suspense></div>
      </div>
      <div className="min-h-0 flex-1">
        <PetaTematik key={tema} tema={tema} titik={titik} opsi={opsi} ringkasan={ringkasanPoligon(hitungRingkasan(db))} fokus={w} />
      </div>
    </div>
  );
}
