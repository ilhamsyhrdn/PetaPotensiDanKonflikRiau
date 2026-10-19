import { SignJWT, jwtVerify } from "jose";
import type { Peran, Sesi } from "./types";

export const COOKIE = "sesi";
const MASA_BERLAKU = 8 * 60 * 60; // 8 jam

const DEV = process.env.NODE_ENV !== "production";

// Di produksi rahasia dan password wajib dari env; nilai cadangan hanya untuk dev lokal.
const rahasia = () => {
  const r = process.env.AUTH_SECRET ?? (DEV ? "rahasia-dev-lokal" : undefined);
  if (!r) throw new Error("AUTH_SECRET belum diisi");
  return new TextEncoder().encode(r);
};

const pw = (env: string | undefined, dev: string) => env || (DEV ? dev : undefined);

const AKUN: { username: string; password: string | undefined; nama: string; peran: Peran }[] = [
  { username: "admin", password: pw(process.env.PASSWORD_ADMIN, "admin123"), nama: "Admin Tim Studi", peran: "admin" },
  { username: "editor", password: pw(process.env.PASSWORD_EDITOR, "editor123"), nama: "Analis Lapangan", peran: "editor" },
  { username: "viewer", password: pw(process.env.PASSWORD_VIEWER, "viewer123"), nama: "Manajemen PHR", peran: "viewer" },
];

export const cariAkun = (username: string | undefined, password: string | undefined) =>
  AKUN.find((a) => a.password && a.username === username?.trim().toLowerCase() && a.password === password);

export async function buatToken(s: Sesi) {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MASA_BERLAKU}s`)
    .sign(rahasia());
}

export async function bacaToken(token: string | undefined): Promise<Sesi | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, rahasia());
    return { username: String(payload.username), nama: String(payload.nama), peran: payload.peran as Peran };
  } catch {
    return null;
  }
}

export const opsiCookie = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: MASA_BERLAKU, secure: process.env.NODE_ENV === "production" };

export const bolehUbah = (s: Sesi | null) => s?.peran === "admin" || s?.peran === "editor";

export const LABEL_PERAN: Record<Peran, string> = { admin: "Admin", editor: "Editor", viewer: "Viewer" };
