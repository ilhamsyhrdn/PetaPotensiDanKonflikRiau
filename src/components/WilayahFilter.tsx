"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MapPin } from "lucide-react";
import { DESA_STUDI, KABUPATEN, anak, namaLengkap } from "@/lib/wilayah";

/** Pilihan wilayah: kabupaten/kota → kecamatan, plus desa studi. Disimpan di URL (?w=). */
export default function WilayahFilter({ gelap = false, penuh = false }: { gelap?: boolean; penuh?: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const nilai = params.get("w") ?? "";

  function ganti(id: string) {
    const p = new URLSearchParams(params);
    if (id) p.set("w", id); else p.delete("w");
    p.delete("hal");
    router.push(`${path}${p.size ? "?" + p : ""}`, { scroll: false });
  }

  return (
    <label htmlFor="filter-wilayah"
      className={`flex min-w-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${penuh ? "w-full sm:w-auto" : ""} ${gelap ? "border-white/15 bg-white/10 text-white backdrop-blur" : "border-line bg-surface"}`}>
      <MapPin size={16} className={gelap ? "shrink-0 text-[#8fb8d8]" : "shrink-0 text-muted"} />
      <span className="sr-only">Wilayah</span>
      <select id="filter-wilayah" value={nilai} onChange={(e) => ganti(e.target.value)}
        className={`min-w-0 bg-transparent outline-none ${penuh ? "flex-1 sm:max-w-[230px] sm:flex-none" : "max-w-[200px] sm:max-w-[230px]"} ${gelap ? "[&>*]:text-ink" : ""}`}>
        <option value="">Seluruh Provinsi Riau</option>
        <optgroup label="Desa studi SIM">
          {DESA_STUDI.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
        </optgroup>
        {KABUPATEN.map((kab) => (
          <optgroup key={kab.id} label={namaLengkap(kab)}>
            <option value={kab.id}>{namaLengkap(kab)} (semua)</option>
            {[...anak(kab.id)].sort((a, b) => a.nama.localeCompare(b.nama)).map((kec) => (
              <option key={kec.id} value={kec.id}>{"  "}Kec. {kec.nama}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
