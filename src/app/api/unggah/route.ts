import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { cekPenyunting } from "@/lib/api";

const JENIS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const MAKS = 5 * 1024 * 1024;

/** Unggah gambar berita. Disimpan di data/uploads, disajikan lewat /api/berkas/<nama> (wajib login). */
export async function POST(req: Request) {
  const cek = await cekPenyunting();
  if ("galat" in cek) return cek.galat;
  const form = await req.formData().catch(() => null);
  const berkas = form?.get("berkas");
  if (!(berkas instanceof File)) return NextResponse.json({ pesan: "Pilih berkas gambar dulu." }, { status: 400 });
  const ext = JENIS[berkas.type];
  if (!ext) return NextResponse.json({ pesan: "Format harus JPG, PNG, WebP, atau GIF." }, { status: 400 });
  if (berkas.size > MAKS) return NextResponse.json({ pesan: "Ukuran gambar maksimal 5 MB." }, { status: 400 });
  const isi = Buffer.from(await berkas.arrayBuffer());
  const nama = `${crypto.createHash("sha1").update(isi).digest("hex").slice(0, 20)}.${ext}`;
  const dir = path.join(process.cwd(), "data", "uploads");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, nama), isi);
  return NextResponse.json({ url: `/api/berkas/${nama}` }, { status: 201 });
}
