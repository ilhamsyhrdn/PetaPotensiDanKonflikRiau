import { NextResponse } from "next/server";
import { ubahDb } from "@/lib/db";
import { cekPenyunting } from "@/lib/api";
import { validasi } from "@/lib/validasi";
import { SKEMA } from "@/lib/skema";
import type { Koleksi } from "@/lib/types";

const AWALAN: Record<Koleksi, string> = { konflik: "k-in", potensi: "p-in", aktor: "a", media: "m-in", dokumen: "d-in" };

export async function POST(req: Request, { params }: { params: Promise<{ koleksi: string }> }) {
  const { koleksi } = await params;
  const cek = await cekPenyunting(koleksi);
  if ("galat" in cek) return cek.galat;
  const k = koleksi as Koleksi;
  const v = validasi(k, await req.json().catch(() => ({})));
  if (!v.ok) return NextResponse.json({ pesan: v.pesan }, { status: 400 });

  const id = `${AWALAN[k]}-${Date.now().toString(36)}`;
  const item = await ubahDb((db) => {
    // nilai bawaan untuk data yang diinput manual
    const bawaan: Record<Koleksi, Record<string, unknown>> = {
      konflik: { asal: "Input", nomor: `IN-${String(db.konflik.filter((x) => x.asal === "Input").length + 1).padStart(3, "0")}` },
      potensi: { asal: "Input", atribut: {}, tanggal: new Date().toISOString().slice(0, 10) },
      aktor: {},
      media: { asal: "Input" },
      dokumen: {},
    };
    const baru: Record<string, unknown> = { ...bawaan[k], ...v.data, id };
    if (k === "konflik" && !v.data.nomor) baru.nomor = bawaan.konflik.nomor;
    (db[k] as unknown[]).unshift(baru);
    db.log.unshift({ waktu: new Date().toISOString(), oleh: cek.sesi.username, aksi: `Menambah ${SKEMA[k].tunggal}: ${String(v.data.judul ?? v.data.nama)}` });
    return baru;
  });
  return NextResponse.json(item, { status: 201 });
}
