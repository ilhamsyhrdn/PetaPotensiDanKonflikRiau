import "server-only";
import { NextResponse } from "next/server";
import { ambilSesi } from "./sesi";
import { bolehUbah } from "./auth";
import { KOLEKSI } from "./db";
import type { Koleksi, Sesi } from "./types";

/** Pastikan pemanggil boleh mengubah data; kembalikan sesi atau respons galat. */
export async function cekPenyunting(koleksi?: string): Promise<{ sesi: Sesi } | { galat: NextResponse }> {
  const sesi = await ambilSesi();
  if (!sesi) return { galat: NextResponse.json({ pesan: "Sesi habis. Silakan login lagi." }, { status: 401 }) };
  if (!bolehUbah(sesi)) return { galat: NextResponse.json({ pesan: "Akun viewer hanya bisa melihat data." }, { status: 403 }) };
  if (koleksi !== undefined && !KOLEKSI.includes(koleksi as Koleksi)) return { galat: NextResponse.json({ pesan: "Jenis data tidak dikenal." }, { status: 404 }) };
  return { sesi };
}
