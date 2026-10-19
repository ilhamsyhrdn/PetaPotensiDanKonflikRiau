import { NextResponse } from "next/server";
import { AKUN_DEMO, COOKIE, buatToken, opsiCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const { username, password } = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  const akun = AKUN_DEMO.find((a) => a.username === username?.trim().toLowerCase() && a.password === password);
  if (!akun) {
    return NextResponse.json({ pesan: "Username atau password salah. Periksa lagi lalu coba masuk." }, { status: 401 });
  }
  const token = await buatToken({ username: akun.username, nama: akun.nama, peran: akun.peran });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, token, opsiCookie);
  return res;
}
