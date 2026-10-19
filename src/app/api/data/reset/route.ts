import { NextResponse } from "next/server";
import { resetDb, ubahDb } from "@/lib/db";
import { cekPenyunting } from "@/lib/api";

export async function POST() {
  const cek = await cekPenyunting();
  if ("galat" in cek) return cek.galat;
  if (cek.sesi.peran !== "admin") return NextResponse.json({ pesan: "Hanya admin yang bisa mengembalikan data contoh." }, { status: 403 });
  await resetDb();
  await ubahDb((db) => { db.log.unshift({ waktu: new Date().toISOString(), oleh: cek.sesi.username, aksi: "Mengembalikan semua data contoh" }); });
  return NextResponse.json({ ok: true });
}
