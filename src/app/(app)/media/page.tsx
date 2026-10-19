import { Suspense } from "react";
import WilayahFilter from "@/components/WilayahFilter";
import HeaderHalaman from "@/components/HeaderHalaman";
import MediaView from "@/components/MediaView";
import { bacaDb } from "@/lib/db";
import { deteksiLetupan } from "@/lib/letupan";
import { geserHari, hariIni } from "@/lib/format";
import { dalamWilayah, labelWilayah } from "@/lib/wilayah";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analitik Media · Dashboard Potensi Ekonomi & Peta Konflik" };

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  const db = await bacaDb();
  const hari = hariIni();
  const media = db.media.filter((m) => dalamWilayah(m.wilayahId, w));
  const awal = geserHari(hari, -90);
  const letupan = Object.fromEntries((["semua", "berita", "sosmed"] as const).map((t) => {
    const d = t === "semua" ? media : media.filter((m) => m.tipe === t);
    return [t, { negatif: deteksiLetupan(d, "negatif", awal, hari), positif: deteksiLetupan(d, "positif", awal, hari) }];
  })) as Parameters<typeof MediaView>[0]["letupan"];

  return (
    <>
      <HeaderHalaman eyebrow={w ? labelWilayah(w) : "Seluruh Provinsi Riau"} judul="Analitik media"
        keterangan="Seberapa sering perusahaan dan isu di Riau diberitakan, dan apakah nadanya cenderung baik atau buruk.">
        <Suspense><WilayahFilter gelap penuh /></Suspense>
      </HeaderHalaman>
      <div className="mx-auto max-w-[2400px] px-4 py-4 sm:px-6 2xl:px-10">
        <MediaView media={media} letupan={letupan} hari={hari} />
      </div>
    </>
  );
}
