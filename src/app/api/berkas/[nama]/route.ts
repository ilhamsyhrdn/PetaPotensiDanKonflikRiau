import fs from "node:fs/promises";
import path from "node:path";

const TIPE: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

export async function GET(_req: Request, { params }: { params: Promise<{ nama: string }> }) {
  const { nama } = await params;
  const m = /^([a-f0-9]{20})\.(jpg|png|webp|gif)$/.exec(nama);
  if (!m) return new Response("Tidak ditemukan", { status: 404 });
  try {
    const isi = await fs.readFile(path.join(process.cwd(), "data", "uploads", nama));
    return new Response(isi, { headers: { "Content-Type": TIPE[m[2]], "Cache-Control": "private, max-age=31536000, immutable" } });
  } catch {
    return new Response("Tidak ditemukan", { status: 404 });
  }
}
