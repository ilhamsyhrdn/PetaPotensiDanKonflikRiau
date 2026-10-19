import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, bacaToken } from "@/lib/auth";

// Semua halaman wajib login, kecuali halaman login dan aset statis.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sesi = await bacaToken(req.cookies.get(COOKIE)?.value);

  if (pathname === "/login") {
    return sesi ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  }
  if (!sesi) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ pesan: "Sesi habis. Silakan login lagi." }, { status: 401 });
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("lanjut", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|geo/).*)"],
};
