import Presentasi from "@/components/Presentasi";
import { bacaDb } from "@/lib/db";
import { wajibSesi } from "@/lib/sesi";
import { hitungRingkasan } from "@/lib/ringkasan";
import { deteksiLetupan } from "@/lib/letupan";
import { buatIkhtisar } from "@/lib/narasi";
import { geserHari, hariIni } from "@/lib/format";
import { titikKonflik, titikPotensi } from "@/lib/titik";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mode Presentasi · Dashboard Potensi Ekonomi & Peta Konflik" };

export default async function PresentasiPage() {
  await wajibSesi();
  const db = await bacaDb();
  const hari = hariIni(), awal = geserHari(hari, -90);
  const berita = db.media.filter((m) => m.tipe === "berita");
  // sorotan: berita dengan skor paling ekstrem (negatif & positif) 30 hari terakhir yang punya lokasi
  const baru = berita.filter((m) => m.tanggal >= geserHari(hari, -30) && m.wilayahId !== "riau");
  const sorotan = [
    ...[...baru].filter((m) => m.sentimen === "negatif").sort((a, b) => (a.skor ?? 0) - (b.skor ?? 0)).slice(0, 2),
    ...[...baru].filter((m) => m.sentimen === "positif").sort((a, b) => (b.skor ?? 0) - (a.skor ?? 0)).slice(0, 2),
  ];
  return (
    <Presentasi ikhtisar={buatIkhtisar(db, hitungRingkasan(db))} konflik={db.konflik.map(titikKonflik)} potensi={db.potensi.map(titikPotensi)} sorotan={sorotan}
      letupanNeg={deteksiLetupan(berita, "negatif", awal, hari)} letupanPos={deteksiLetupan(berita, "positif", awal, hari)} />
  );
}
