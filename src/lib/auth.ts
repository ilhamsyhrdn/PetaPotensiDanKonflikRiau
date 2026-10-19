import { SignJWT, jwtVerify } from "jose";
import type { Peran, Sesi } from "./types";

export const COOKIE = "sesi";
const MASA_BERLAKU = 8 * 60 * 60; // 8 jam

// Nilai bawaan ada di repo; isi AUTH_SECRET dan PASSWORD_* di env hosting untuk menggantinya.
const rahasia = () => new TextEncoder().encode(process.env.AUTH_SECRET || "prototipe-ganti-rahasia-ini-lewat-env");

const pw = (env: string | undefined, bawaan: string) => env || bawaan;

const AKUN: { username: string; password: string; nama: string; peran: Peran }[] = [
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
