import { NextResponse } from "next/server";
import { COOKIE } from "@/lib/auth";

// Location sengaja relatif: di balik proxy hosting, req.url berisi alamat internal server
// (mis. https://0.0.0.0:3000), sehingga redirect absolut dari situ tidak bisa dibuka peramban.
export async function POST() {
  const res = new NextResponse(null, { status: 303, headers: { Location: "/login" } });
  res.cookies.delete(COOKIE);
  return res;
}
