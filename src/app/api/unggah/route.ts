import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { cekPenyunting } from "@/lib/api";

const MAKS = 5 * 1024 * 1024;

/** Jenis gambar dari isi berkas, bukan dari tipe kiriman peramban yang bisa dipalsukan. */
function jenisGambar(b: Buffer) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (/^GIF8[79]a$/.test(b.toString("latin1", 0, 6))) return "gif";
  if (b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "webp";
  return null;
}

/** Unggah gambar berita. Disimpan di data/uploads, disajikan lewat /api/berkas/<nama> (wajib login). */
export async function POST(req: Request) {
  const cek = await cekPenyunting();
  if ("galat" in cek) return cek.galat;
  const form = await req.formData().catch(() => null);
  const berkas = form?.get("berkas");
  if (!(berkas instanceof File)) return NextResponse.json({ pesan: "Pilih berkas gambar dulu." }, { status: 400 });
  if (berkas.size > MAKS) return NextResponse.json({ pesan: "Ukuran gambar maksimal 5 MB." }, { status: 400 });
  const isi = Buffer.from(await berkas.arrayBuffer());
  const ext = jenisGambar(isi);
  if (!ext) return NextResponse.json({ pesan: "Format harus JPG, PNG, WebP, atau GIF." }, { status: 400 });
  const nama = `${crypto.createHash("sha1").update(isi).digest("hex").slice(0, 20)}.${ext}`;
  const dir = path.join(process.cwd(), "data", "uploads");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, nama), isi);
  return NextResponse.json({ url: `/api/berkas/${nama}` }, { status: 201 });
}
