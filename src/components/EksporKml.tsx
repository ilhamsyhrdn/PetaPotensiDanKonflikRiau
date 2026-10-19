"use client";

import { useState } from "react";
import { Download } from "lucide-react";

const LAPISAN = [
  { id: "baseline", label: "Wilayah studi & angka baseline" },
  { id: "konflik", label: "Titik konflik" },
  { id: "potensi", label: "Titik potensi ekonomi" },
];

export default function EksporKml() {
  const [pilih, setPilih] = useState(() => new Set(LAPISAN.map((l) => l.id)));
  const togel = (id: string) => setPilih((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const lapisan = LAPISAN.filter((l) => pilih.has(l.id)).map((l) => l.id);

  return (
    <div className="space-y-3">
      <fieldset className="space-y-1.5 text-sm">
        <legend className="mb-1 text-[12.5px] font-semibold text-ink/80">Lapisan yang diekspor</legend>
        {LAPISAN.map((l) => (
          <label key={l.id} htmlFor={`kml-${l.id}`} className="flex items-center gap-2">
            <input id={`kml-${l.id}`} type="checkbox" checked={pilih.has(l.id)} onChange={() => togel(l.id)} className="h-4 w-4 accent-[#2f6690]" />
            {l.label}
          </label>
        ))}
      </fieldset>
      {lapisan.length ? (
        <a href={`/api/ekspor/kml?lapisan=${lapisan.join(",")}`} download
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#25557a]">
          <Download size={16} /> Unduh berkas KML
        </a>
      ) : (
        <button type="button" disabled className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white opacity-50">
          <Download size={16} /> Pilih minimal satu lapisan
        </button>
      )}
    </div>
  );
}
