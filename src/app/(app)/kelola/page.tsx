import HeaderHalaman from "@/components/HeaderHalaman";
import KelolaData from "@/components/KelolaData";
import { TAB_KELOLA } from "@/lib/skema";
import { bacaDb } from "@/lib/db";
import { wajibSesi } from "@/lib/sesi";
import { labelWilayah } from "@/lib/wilayah";
import { labelAsal, tanpaTanahKita } from "@/lib/format";
import type { Koleksi } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kelola Data · Dashboard Potensi Ekonomi & Peta Konflik" };

const PER_HAL = 50;
type Baris = Record<string, unknown> & { id: string };

const bersihkan = (b: Baris): Baris => ({
  ...b,
  ...(typeof b.asal === "string" ? { asal: labelAsal(b.asal) } : {}),
  ...(Array.isArray(b.sumber) ? { sumber: tanpaTanahKita(b.sumber) } : {}),
});

export default async function KelolaPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; hal?: string }> }) {
  const sesi = await wajibSesi();
  const sp = await searchParams;
  const db = await bacaDb();
  const koleksi: Koleksi = TAB_KELOLA.includes(sp.tab as Koleksi) ? (sp.tab as Koleksi) : "konflik";
  const q = (sp.q ?? "").trim();

  // pencarian di server: judul/nama, sumber, wilayah, sektor/kategori, isu
  const semua = (db[koleksi] as unknown as Baris[]).filter((x) => x.level !== "perusahaan");
  const kata = q.toLowerCase();
  const hasil = kata
    ? semua.filter((x) => `${x.judul ?? ""} ${x.nama ?? ""} ${typeof x.sumber === "string" ? x.sumber : ""} ${labelWilayah(String(x.wilayahId))} ${x.sektor ?? ""} ${x.subkategori ?? ""} ${x.isu ?? ""} ${x.kategori ?? ""}`.toLowerCase().includes(kata))
    : semua;
  const halMaks = Math.max(1, Math.ceil(hasil.length / PER_HAL));
  const hal = Math.min(halMaks, Math.max(1, Number(sp.hal) || 1));
  const jumlah = Object.fromEntries(TAB_KELOLA.map((t) => [t, (db[t] as unknown[]).length - (t === "aktor" ? 1 : 0)])) as Record<Koleksi, number>;

  return (
    <>
      <HeaderHalaman eyebrow="Khusus admin & editor" judul="Kelola data"
        keterangan="Tambah, ubah, atau hapus data. Begitu disimpan, perubahannya langsung muncul di peta, dashboard, dan presentasi." />
      <div className="mx-auto max-w-[2400px] px-4 py-4 sm:px-6 2xl:px-10">
        <KelolaData key={koleksi} koleksi={koleksi} baris={hasil.slice((hal - 1) * PER_HAL, hal * PER_HAL).map(bersihkan)} total={hasil.length} hal={hal} perHal={PER_HAL} q={q}
          jumlah={jumlah} log={db.log.slice(0, 10)} peran={sesi.peran} />
      </div>
    </>
  );
}
