import { NextResponse } from "next/server";
import { ubahDb } from "@/lib/db";
import { cekPenyunting } from "@/lib/api";
import { validasi } from "@/lib/validasi";
import { SKEMA } from "@/lib/skema";
import { dariTanahKita } from "@/lib/format";
import type { Koleksi, Rujukan } from "@/lib/types";

type Ctx = { params: Promise<{ koleksi: string; id: string }> };
type Item = { id: string; judul?: string; nama?: string; sumber?: Rujukan[] };

export async function PUT(req: Request, { params }: Ctx) {
  const { koleksi, id } = await params;
  const cek = await cekPenyunting(koleksi);
  if ("galat" in cek) return cek.galat;
  const k = koleksi as Koleksi;
  const v = validasi(k, await req.json().catch(() => ({})));
  if (!v.ok) return NextResponse.json({ pesan: v.pesan }, { status: 400 });

  const ketemu = await ubahDb((db) => {
    const list = db[k] as unknown as Item[];
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return false;
    // sumber TanahKita disembunyikan dari form, jadi pertahankan dari data lama
    const tersembunyi = Array.isArray(v.data.sumber) ? (list[i].sumber ?? []).filter(dariTanahKita) : [];
    const sumber = tersembunyi.length ? { sumber: [...(v.data.sumber as Rujukan[]).filter((r) => !dariTanahKita(r)), ...tersembunyi] } : {};
    list[i] = { ...list[i], ...v.data, ...sumber, id };
    db.log.unshift({ waktu: new Date().toISOString(), oleh: cek.sesi.username, aksi: `Mengubah ${SKEMA[k].tunggal}: ${String(v.data.judul ?? v.data.nama)}` });
    return true;
  });
  return ketemu ? NextResponse.json({ ok: true }) : NextResponse.json({ pesan: "Data tidak ditemukan. Mungkin sudah dihapus." }, { status: 404 });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { koleksi, id } = await params;
  const cek = await cekPenyunting(koleksi);
  if ("galat" in cek) return cek.galat;
  const k = koleksi as Koleksi;
  const ketemu = await ubahDb((db) => {
    const list = db[k] as unknown as Item[];
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return false;
    const [hapus] = list.splice(i, 1);
    if (k === "aktor") db.relasi = db.relasi.filter((r) => r.dari !== id && r.ke !== id);
    db.log.unshift({ waktu: new Date().toISOString(), oleh: cek.sesi.username, aksi: `Menghapus ${SKEMA[k].tunggal}: ${hapus.judul ?? hapus.nama ?? id}` });
    return true;
  });
  return ketemu ? NextResponse.json({ ok: true }) : NextResponse.json({ pesan: "Data tidak ditemukan. Mungkin sudah dihapus." }, { status: 404 });
}
