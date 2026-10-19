"use client";

import { useState } from "react";
import PetaTematik, { type OpsiFilter } from "./PetaTematik";
import type { Ringkasan, Tema, TitikPeta } from "@/lib/peta";

/** Peta ringkas di dashboard dengan tab Konflik / Potensi ekonomi. */
export default function PetaDashboard({ data, ringkasan, fokus }: {
  data: Record<Tema, { titik: TitikPeta[]; opsi: OpsiFilter }>; ringkasan: Ringkasan; fokus?: string;
}) {
  const [tema, setTema] = useState<Tema>("konflik");
  return (
    <div className="flex h-full flex-col">
      <div role="tablist" className="flex gap-1 border-b border-line px-4 py-2.5">
        {(["konflik", "potensi"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tema === t} onClick={() => setTema(t)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] transition ${tema === t ? "font-semibold text-white shadow-sm" : "text-muted hover:bg-[#eef2f6] hover:text-ink"}`}
            style={tema === t ? { background: t === "konflik" ? "#c2410c" : "#2F6690" } : undefined}>
            {t === "konflik" ? `Konflik (${data.konflik.titik.length})` : `Potensi ekonomi (${data.potensi.titik.length.toLocaleString("id-ID")})`}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        <PetaTematik key={tema} ringkas tema={tema} titik={data[tema].titik} opsi={data[tema].opsi} ringkasan={ringkasan} fokus={fokus} />
      </div>
    </div>
  );
}
