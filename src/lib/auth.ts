import { SignJWT, jwtVerify } from "jose";
import type { Peran, Sesi } from "./types";

export const COOKIE = "sesi";
const MASA_BERLAKU = 8 * 60 * 60; // 8 jam

// Repo ini publik, jadi password bawaan hanya berlaku di `npm run dev`. Di produksi, akun yang
// PASSWORD_*-nya belum diisi di env hosting tidak bisa dipakai masuk.
const pw = (env: string | undefined, bawaan: string) => env || (process.env.NODE_ENV === "production" ? "" : bawaan);

const AKUN: { username: string; password: string; nama: string; peran: Peran }[] = [
  { username: "admin", password: pw(process.env.PASSWORD_ADMIN, "admin123"), nama: "Admin Tim Studi", peran: "admin" },
  { username: "editor", password: pw(process.env.PASSWORD_EDITOR, "editor123"), nama: "Analis Lapangan", peran: "editor" },
  { username: "viewer", password: pw(process.env.PASSWORD_VIEWER, "viewer123"), nama: "Manajemen PHR", peran: "viewer" },
];

// Tanpa AUTH_SECRET dipakai kunci acak yang dibuat saat build (next.config.ts): tidak ada di repo,
// tapi berganti tiap deploy sehingga semua pengguna perlu masuk lagi.
const rahasia = () => new TextEncoder().encode(process.env.AUTH_SECRET || process.env.KUNCI_SESI_BUILD);

export const adaAkun = () => AKUN.some((a) => a.password);

/** Bandingkan tanpa berhenti di karakter pertama yang beda, supaya waktu respons tidak membocorkan password. */
function sama(a: string, b: string) {
  let beda = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i % (b.length || 1));
  return beda === 0;
}

export const cariAkun = (username: unknown, password: unknown) =>
  typeof username === "string" && typeof password === "string"
    ? AKUN.find((a) => a.password && a.username === username.trim().toLowerCase() && sama(password, a.password))
    : undefined;

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
