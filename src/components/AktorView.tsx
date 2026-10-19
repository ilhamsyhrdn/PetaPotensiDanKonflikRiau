"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape from "cytoscape";
import type { Aktor, Relasi } from "@/lib/types";
import { WARNA_KATEGORI_AKTOR, WARNA_RELASI, WARNA_SIKAP, warnaKategori } from "@/lib/format";
import { WILAYAH, getWilayah, labelWilayah, namaWilayah, rantai } from "@/lib/wilayah";
import { Chip, Kartu } from "./ui";

const BENTUK: Record<Aktor["level"], cytoscape.Css.NodeShape> = { perusahaan: "round-rectangle", kabupaten: "hexagon", kecamatan: "diamond", desa: "ellipse" };

/**
 * Tata letak radial ala sosiogram: perusahaan di tengah, cincin kabupaten, cincin kecamatan,
 * lalu kotak tiap desa di lingkar luar searah dengan kecamatan & kabupatennya.
 */
function posisiRadial(aktor: Aktor[]): Record<string, { x: number; y: number }> {
  // desa diurutkan per kabupaten lalu kecamatan, supaya desa satu kabupaten bersebelahan di lingkaran
  const urut = (id: string) => rantai(id).map((w) => String(WILAYAH.indexOf(w)).padStart(3, "0")).join(".");
  const desaIds = WILAYAH.filter((w) => w.level === "desa" && aktor.some((a) => a.wilayahId === w.id)).map((w) => w.id).sort((a, b) => urut(a).localeCompare(urut(b)));
  const sudut = new Map<string, number>(desaIds.map((id, i) => [id, -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(1, desaIds.length)]));
  const rerata = (xs: number[]) => (xs.length ? Math.atan2(xs.reduce((s, a) => s + Math.sin(a), 0), xs.reduce((s, a) => s + Math.cos(a), 0)) : 0);
  const sudutWilayah = (id: string) => rerata(desaIds.filter((d) => rantai(d).some((w) => w.id === id)).map((d) => sudut.get(d)!));
  const pos: Record<string, { x: number; y: number }> = {};
  const di = (r: number, a: number, dx = 0, dy = 0) => ({ x: Math.cos(a) * r + dx, y: Math.sin(a) * r + dy });
  const geser = new Map<string, number>();
  const SLOT = [[-62, -38], [62, -38], [-62, 52], [62, 52], [0, 120], [-124, 120], [124, 120]];
  for (const a of [...aktor].sort((x, y) => y.pengaruh - x.pengaruh)) {
    if (a.level === "perusahaan") pos[a.id] = { x: 0, y: 0 };
    else if (a.level === "kabupaten") pos[a.id] = di(150, sudutWilayah(a.wilayahId));
    else if (a.level === "kecamatan") pos[a.id] = di(265, sudutWilayah(a.wilayahId));
    else {
      const k = geser.get(a.wilayahId) ?? 0;
      geser.set(a.wilayahId, k + 1);
      const [dx, dy] = SLOT[k % SLOT.length];
      pos[a.id] = di(470, sudut.get(a.wilayahId) ?? 0, dx, dy);
    }
  }
  // dua simpul di sudut yang sama (mis. kab & kec dengan satu desa) digeser sedikit agar tak bertumpuk
  const terpakai = new Map<string, number>();
  for (const [id, p] of Object.entries(pos)) {
    const kunci = `${Math.round(p.x / 20)},${Math.round(p.y / 20)}`;
    const n = terpakai.get(kunci) ?? 0;
    terpakai.set(kunci, n + 1);
    if (n) pos[id] = { x: p.x + 46 * n, y: p.y };
  }
  return pos;
}

export default function AktorView({ aktor, relasi }: { aktor: Aktor[]; relasi: Relasi[] }) {
  const wadah = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [pilih, setPilih] = useState<string | null>(null);
  const byId = useMemo(() => new Map(aktor.map((a) => [a.id, a])), [aktor]);
  const ids = useMemo(() => new Set(aktor.map((a) => a.id)), [aktor]);
  const rel = useMemo(() => relasi.filter((r) => ids.has(r.dari) && ids.has(r.ke)), [relasi, ids]);

  useEffect(() => {
    if (!wadah.current) return;
    const desaGrup = [...new Set(aktor.filter((a) => a.level === "desa").map((a) => a.wilayahId))];
    const cy = cytoscape({
      container: wadah.current,
      elements: [
        ...desaGrup.map((id) => ({ data: { id: "grup-" + id, label: "Desa " + namaWilayah(id), grup: 1 } })),
        ...aktor.map((a) => ({ data: { id: a.id, label: a.nama, parent: a.level === "desa" ? "grup-" + a.wilayahId : undefined, warna: warnaKategori(a.kategori), sikap: WARNA_SIKAP[a.sikap], ukuran: 22 + a.pengaruh * 7, bentuk: BENTUK[a.level] } })),
        ...rel.map((r) => ({ data: { id: r.id, source: r.dari, target: r.ke, warna: WARNA_RELASI[r.status], status: r.status } })),
      ],
      style: [
        { selector: "node[grup]", style: { "background-color": "#f3f5f8", "background-opacity": 1, "border-color": "#c5d0db", "border-width": 1, shape: "round-rectangle", label: "data(label)", "text-valign": "top", "text-halign": "center", "font-size": 14, "font-weight": 700, color: "#2f6690", padding: "18px" } },
        { selector: "node[!grup]", style: { "background-color": "data(warna)", width: "data(ukuran)", height: "data(ukuran)", shape: "data(bentuk)" as never, "border-color": "data(sikap)", "border-width": 4, label: "data(label)", "font-size": 12, color: "#1c2b38", "text-wrap": "wrap", "text-max-width": "110px", "text-valign": "bottom", "text-margin-y": 5, "text-background-color": "#ffffff", "text-background-opacity": 0.8, "text-background-padding": "1px" } },
        { selector: "edge", style: { width: 1.6, "line-color": "data(warna)", "curve-style": "bezier", opacity: 0.75 } },
        { selector: "edge[status = 'buruk']", style: { "line-style": "dashed", width: 2.2 } },
        { selector: ".redup", style: { opacity: 0.12 } },
        { selector: "node.dipilih", style: { "border-width": 5, "underlay-color": "#ffd43b", "underlay-opacity": 0.6, "underlay-padding": 6 } as never },
      ],
      layout: { name: "preset", positions: posisiRadial(aktor), fit: true, padding: 24 } as cytoscape.LayoutOptions,
      wheelSensitivity: 0.25,
      minZoom: 0.3, maxZoom: 2.5,
    });
    cy.on("tap", "node[!grup]", (e) => setPilih(e.target.id()));
    cy.on("tap", (e) => { if (e.target === cy) setPilih(null); });
    cyRef.current = cy;
    return () => { cy.destroy(); cyRef.current = null; };
  }, [aktor, rel]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass("redup dipilih");
    if (!pilih) return;
    const n = cy.getElementById(pilih);
    const sekitar = n.closedNeighborhood();
    cy.elements().not(sekitar).not(sekitar.parents()).addClass("redup");
    n.addClass("dipilih");
  }, [pilih]);

  const a = pilih ? byId.get(pilih) : undefined;
  const relasiA = a ? rel.filter((r) => r.dari === a.id || r.ke === a.id) : [];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-[1fr_340px] 3xl:grid-cols-[1.25fr_1fr_400px]">
        <Kartu judul="Peta jejaring aktor" sub="Klik salah satu aktor untuk melihat dengan siapa saja ia berhubungan." rapat>
          <div ref={wadah} className="h-[440px] rounded-b-2xl bg-[radial-gradient(#e3e8ee_1px,transparent_1px)] [background-size:18px_18px] sm:h-[640px] 3xl:h-full 3xl:min-h-[820px]" />
        </Kartu>

        <div className="space-y-3 3xl:order-2">
          <Kartu judul={a ? "Detail aktor" : "Keterangan"}>
            {a ? (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted">{a.level === "perusahaan" ? "Perusahaan" : labelWilayah(a.wilayahId)}</p>
                  <p className="text-base font-bold">{a.nama}</p>
                </div>
                <div className="flex flex-wrap gap-1.5"><Chip warna={warnaKategori(a.kategori)}>{a.kategori}</Chip><Chip warna={WARNA_SIKAP[a.sikap]}>{a.sikap}</Chip></div>
                <dl className="grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-bg p-2"><dt className="text-xs text-muted">Pengaruh</dt><dd className="num font-bold">{a.pengaruh} / 5</dd></div>
                  <div className="rounded-md bg-bg p-2"><dt className="text-xs text-muted">Kepentingan</dt><dd className="num font-bold">{a.kepentingan} / 5</dd></div>
                </dl>
                {a.catatan && <p>{a.catatan}</p>}
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Hubungan ({relasiA.length})</p>
                  <ul className="space-y-1.5">
                    {relasiA.map((r) => {
                      const lain = byId.get(r.dari === a.id ? r.ke : r.dari)!;
                      return (
                        <li key={r.id} className="flex items-start gap-2">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: WARNA_RELASI[r.status] }} />
                          <button onClick={() => setPilih(lain.id)} className="text-left hover:underline"><b className="font-medium">{lain.nama}</b><span className="block text-xs text-muted">{r.keterangan}</span></button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div><p className="mb-1 font-semibold">Warna isi = kategori</p>
                  <ul className="grid grid-cols-2 gap-1">{Object.entries(WARNA_KATEGORI_AKTOR).map(([k, w]) => <li key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: w }} />{k}</li>)}</ul></div>
                <div><p className="mb-1 font-semibold">Warna tepi = sikap terhadap perusahaan</p>
                  <ul className="flex gap-3">{Object.entries(WARNA_SIKAP).map(([k, w]) => <li key={k} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-[3px]" style={{ borderColor: w }} />{k}</li>)}</ul></div>
                <div><p className="mb-1 font-semibold">Garis = status hubungan</p>
                  <ul className="flex gap-3">{Object.entries(WARNA_RELASI).map(([k, w]) => <li key={k} className="flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: w }} />{k}</li>)}</ul></div>
                <p className="text-muted">Bentuk: kotak = perusahaan, segi enam = kabupaten, belah ketupat = kecamatan, lingkaran = desa. Ukuran = tingkat pengaruh.</p>
              </div>
            )}
          </Kartu>
          <Komposisi aktor={aktor} rel={rel} setPilih={setPilih} />
        </div>
        <Matriks aktor={aktor.filter((x) => x.level !== "perusahaan")} pilih={pilih} setPilih={setPilih} className="xl:col-span-2 3xl:order-1 3xl:col-span-1" />
      </div>

      <Kartu judul={`Daftar aktor (${aktor.length})`} rapat>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="text-left">{["Aktor", "Wilayah", "Kategori", "Pengaruh", "Kepentingan", "Sikap"].map((h) => <th key={h} className="eyebrow bg-bg px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {[...aktor].sort((x, y) => y.pengaruh * 10 + y.kepentingan - (x.pengaruh * 10 + x.kepentingan)).map((x) => (
                <tr key={x.id} onClick={() => setPilih(x.id)} className={`cursor-pointer border-t border-line hover:bg-accent-soft/40 ${pilih === x.id ? "bg-amber-50" : ""}`}>
                  <td className="px-4 py-2 font-medium">{x.nama}</td>
                  <td className="px-4 py-2 text-muted">{x.level === "perusahaan" ? "–" : namaWilayah(x.wilayahId)}{getWilayah(x.wilayahId)?.level === "kecamatan" ? " (kec.)" : getWilayah(x.wilayahId)?.level === "kabupaten" ? " (kab.)" : ""}</td>
                  <td className="px-4 py-2">{x.kategori}</td>
                  <td className="num px-4 py-2">{x.pengaruh}</td>
                  <td className="num px-4 py-2">{x.kepentingan}</td>
                  <td className="px-4 py-2"><Chip warna={WARNA_SIKAP[x.sikap]}>{x.sikap}</Chip></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Kartu>
    </div>
  );
}

/** Ringkasan cepat: sebaran sikap, kondisi hubungan, dan aktor paling berpengaruh. */
function Komposisi({ aktor, rel, setPilih }: { aktor: Aktor[]; rel: Relasi[]; setPilih: (id: string) => void }) {
  const lokal = aktor.filter((x) => x.level !== "perusahaan");
  const bagian = <T extends string>(daftar: T[], kunci: T[]) => kunci.map((k) => ({ k, n: daftar.filter((d) => d === k).length }));
  const sikap = bagian(lokal.map((x) => x.sikap), Object.keys(WARNA_SIKAP) as Aktor["sikap"][]);
  const status = bagian(rel.map((r) => r.status), Object.keys(WARNA_RELASI) as Relasi["status"][]);
  const utama = [...lokal].sort((x, y) => y.pengaruh * 10 + y.kepentingan - (x.pengaruh * 10 + x.kepentingan)).slice(0, 5);
  const Batang = ({ data, warna, total }: { data: { k: string; n: number }[]; warna: Record<string, string>; total: number }) => (
    <>
      <span className="flex h-2.5 overflow-hidden rounded-full bg-bg">
        {data.map((d) => <span key={d.k} title={`${d.k}: ${d.n}`} style={{ width: `${(d.n / Math.max(1, total)) * 100}%`, background: warna[d.k] }} />)}
      </span>
      <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-muted">
        {data.map((d) => <span key={d.k} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: warna[d.k] }} />{d.k} <b className="num text-ink">{d.n}</b></span>)}
      </span>
    </>
  );
  return (
    <Kartu judul="Komposisi aktor">
      <div className="space-y-4 text-sm">
        <div><p className="mb-1.5 text-xs font-semibold">Sikap terhadap perusahaan · {lokal.length} aktor</p><Batang data={sikap} warna={WARNA_SIKAP} total={lokal.length} /></div>
        <div><p className="mb-1.5 text-xs font-semibold">Kondisi hubungan · {rel.length} relasi</p><Batang data={status} warna={WARNA_RELASI} total={rel.length} /></div>
        <div>
          <p className="mb-1 text-xs font-semibold">Paling berpengaruh</p>
          <ol className="divide-y divide-line">
            {utama.map((x, i) => (
              <li key={x.id}>
                <button onClick={() => setPilih(x.id)} className="flex w-full items-center gap-2.5 py-1.5 text-left hover:text-accent">
                  <span className="num w-4 text-xs text-muted">{i + 1}</span>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2" style={{ background: warnaKategori(x.kategori), ["--tw-ring-color" as string]: WARNA_SIKAP[x.sikap] }} />
                  <span className="min-w-0 flex-1 truncate text-[13px]">{x.nama}<span className="block truncate text-[11px] text-muted">{namaWilayah(x.wilayahId)}</span></span>
                  <span className="num shrink-0 text-xs text-muted">P{x.pengaruh}·K{x.kepentingan}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Kartu>
  );
}

const KUADRAN = [
  { k: "Kelola dekat", d: "Pengaruh tinggi, kepentingan tinggi", x: [3.5, 5.5], y: [3.5, 5.5] },
  { k: "Jaga kepuasan", d: "Pengaruh tinggi, kepentingan rendah", x: [0.5, 3.5], y: [3.5, 5.5] },
  { k: "Beri informasi", d: "Pengaruh rendah, kepentingan tinggi", x: [3.5, 5.5], y: [0.5, 3.5] },
  { k: "Pantau", d: "Pengaruh rendah, kepentingan rendah", x: [0.5, 3.5], y: [0.5, 3.5] },
];

function Matriks({ aktor, pilih, setPilih, className = "" }: { aktor: Aktor[]; pilih: string | null; setPilih: (id: string) => void; className?: string }) {
  const W = 520, H = 420, pad = { l: 46, r: 14, t: 14, b: 40 };
  const sx = (v: number) => pad.l + ((v - 0.5) / 5) * (W - pad.l - pad.r);
  const sy = (v: number) => H - pad.b - ((v - 0.5) / 5) * (H - pad.t - pad.b);
  // titik dengan skor sama disebar melingkar supaya tidak bertumpuk
  const grup = new Map<string, Aktor[]>();
  for (const a of aktor) grup.set(`${a.kepentingan},${a.pengaruh}`, [...(grup.get(`${a.kepentingan},${a.pengaruh}`) ?? []), a]);
  const titik = [...grup.values()].flatMap((g) => g.map((a, i) => {
    const sudut = (i / g.length) * Math.PI * 2, r = g.length > 1 ? 13 + g.length * 1.5 : 0;
    return { a, x: sx(a.kepentingan) + Math.cos(sudut) * r, y: sy(a.pengaruh) + Math.sin(sudut) * r };
  }));
  const isi = (k: (typeof KUADRAN)[number]) => aktor.filter((a) => (a.kepentingan > 3.5) === (k.x[0] === 3.5) && (a.pengaruh > 3.5) === (k.y[0] === 3.5));

  return (
    <Kartu judul="Matriks pengaruh–kepentingan" sub="Posisi tiap aktor menurut seberapa besar pengaruh dan kepentingannya." className={className}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,520px)_1fr] 3xl:grid-cols-1">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Matriks pengaruh dan kepentingan aktor">
          {KUADRAN.map((k) => (
            <g key={k.k}>
              <rect x={sx(k.x[0])} y={sy(k.y[1])} width={sx(k.x[1]) - sx(k.x[0])} height={sy(k.y[0]) - sy(k.y[1])} fill={k.k === "Kelola dekat" ? "#fff4e6" : "#f8f9fa"} stroke="#dde3ea" />
              <text x={sx(k.x[0]) + 8} y={sy(k.y[1]) + 18} fontSize="12" fontWeight="700" fill="#5a6b7a">{k.k}</text>
            </g>
          ))}
          {[1, 2, 3, 4, 5].map((v) => (
            <g key={v}>
              <text x={sx(v)} y={H - pad.b + 16} fontSize="11" textAnchor="middle" fill="#5a6b7a">{v}</text>
              <text x={pad.l - 10} y={sy(v) + 4} fontSize="11" textAnchor="end" fill="#5a6b7a">{v}</text>
            </g>
          ))}
          <text x={(W + pad.l) / 2} y={H - 6} fontSize="12" textAnchor="middle" fill="#1c2b38" fontWeight="600">Kepentingan →</text>
          <text x={14} y={(H - pad.b) / 2} fontSize="12" textAnchor="middle" fill="#1c2b38" fontWeight="600" transform={`rotate(-90 14 ${(H - pad.b) / 2})`}>Pengaruh →</text>
          {titik.map(({ a, x, y }) => (
            <circle key={a.id} cx={x} cy={y} r={pilih === a.id ? 9 : 7} fill={warnaKategori(a.kategori)} stroke={WARNA_SIKAP[a.sikap]} strokeWidth={3}
              className="cursor-pointer" onClick={() => setPilih(a.id)}>
              <title>{`${a.nama} (${namaWilayah(a.wilayahId)}) · pengaruh ${a.pengaruh}, kepentingan ${a.kepentingan}, ${a.sikap}`}</title>
            </circle>
          ))}
        </svg>
        <div className="grid content-start gap-4 sm:grid-cols-2">
          {KUADRAN.map((k) => (
            <div key={k.k} className="min-w-0">
              <p className="text-sm font-semibold">{k.k} <span className="num text-muted">({isi(k).length})</span></p>
              <p className="mb-1.5 text-xs text-muted">{k.d}</p>
              <ul className="space-y-0.5 text-sm">
                {isi(k).map((a) => (
                  <li key={a.id}><button onClick={() => setPilih(a.id)} className="flex items-center gap-1.5 text-left hover:underline">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: WARNA_SIKAP[a.sikap] }} />{a.nama}
                    {a.level === "desa" && <span className="text-xs text-muted">· {namaWilayah(a.wilayahId)}</span>}
                  </button></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Kartu>
  );
}
