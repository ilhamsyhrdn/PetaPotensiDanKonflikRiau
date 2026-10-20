import { NextResponse } from "next/server";
import { COOKIE, adaAkun, cariAkun, buatToken, opsiCookie } from "@/lib/auth";

// Batas percobaan gagal per alamat IP, supaya password tidak bisa ditebak beruntun.
const MAKS_GAGAL = 8;
const JENDELA = 15 * 60e3;
const gagal = new Map<string, { n: number; sejak: number }>();

// Entri terakhir X-Forwarded-For ditambahkan proxy hosting, jadi tidak bisa dipalsukan dari peramban.
const alamat = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || req.headers.get("x-real-ip") || "lokal";

export async function POST(req: Request) {
  if (!adaAkun()) {
    return NextResponse.json({ pesan: "Akun belum diatur di server. Admin perlu mengisi PASSWORD_ADMIN di pengaturan hosting." }, { status: 503 });
  }
  const ip = alamat(req);
  const kini = Date.now();
  const catatan = gagal.get(ip);
  if (catatan && kini - catatan.sejak > JENDELA) gagal.delete(ip);
  else if (catatan && catatan.n >= MAKS_GAGAL) {
    const menit = Math.ceil((catatan.sejak + JENDELA - kini) / 60e3);
    return NextResponse.json({ pesan: `Terlalu banyak percobaan gagal. Coba lagi ${menit} menit lagi.` }, { status: 429 });
  }

  const { username, password } = (await req.json().catch(() => ({}))) as { username?: unknown; password?: unknown };
  const akun = cariAkun(username, password);
  if (!akun) {
    if (gagal.size > 5000) for (const [k, v] of gagal) if (kini - v.sejak > JENDELA) gagal.delete(k);
    const c = gagal.get(ip) ?? { n: 0, sejak: kini };
    gagal.set(ip, { ...c, n: c.n + 1 });
    return NextResponse.json({ pesan: "Username atau password salah. Periksa lagi lalu coba masuk." }, { status: 401 });
  }
  gagal.delete(ip);
  const token = await buatToken({ username: akun.username, nama: akun.nama, peran: akun.peran });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, token, opsiCookie);
  return res;
}
