import { ambilSesi } from "@/lib/sesi";
import { infoPembaruan, mulaiPembaruan } from "@/lib/pembaruan";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(infoPembaruan());
}

/** Semua peran boleh memicu pembaruan: datanya digabung, bukan ditimpa. */
export async function POST() {
  const sesi = await ambilSesi();
  if (!sesi) return Response.json({ pesan: "Sesi habis. Silakan login lagi." }, { status: 401 });
  const r = mulaiPembaruan(sesi.username);
  return r.ok ? Response.json(infoPembaruan(), { status: 202 }) : Response.json({ ...infoPembaruan(), pesan: r.pesan }, { status: 409 });
}
