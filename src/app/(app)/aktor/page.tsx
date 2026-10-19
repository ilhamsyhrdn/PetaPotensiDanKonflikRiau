import { Suspense } from "react";
import WilayahFilter from "@/components/WilayahFilter";
import HeaderHalaman from "@/components/HeaderHalaman";
import AktorView from "@/components/AktorView";
import { bacaDb } from "@/lib/db";
import { dalamWilayah, labelWilayah } from "@/lib/wilayah";

export const dynamic = "force-dynamic";
export const metadata = { title: "Aktor & Pemangku Kepentingan · Dashboard Potensi Ekonomi & Peta Konflik" };

export default async function AktorPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  const db = await bacaDb();
  const aktor = db.aktor.filter((a) => a.level === "perusahaan" || dalamWilayah(a.wilayahId, w));
  return (
    <>
      <HeaderHalaman eyebrow={w ? labelWilayah(w) : "6 desa studi"} judul="Aktor & pemangku kepentingan"
        keterangan="Tokoh dan lembaga di sekitar desa studi, lengkap dengan hubungan dan sikap mereka terhadap perusahaan.">
        <Suspense><WilayahFilter gelap penuh /></Suspense>
      </HeaderHalaman>
      <div className="mx-auto max-w-[2400px] space-y-3 px-4 py-4 sm:px-6 2xl:px-10">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <b>Masih data contoh.</b> Nanti diganti hasil pemetaan aktor di lapangan (2–13 November). Data aktor tidak ada di sumber terbuka, dan karena memuat data pribadi, aksesnya perlu dibatasi.
        </p>
        <AktorView aktor={aktor} relasi={db.relasi} />
      </div>
    </>
  );
}
