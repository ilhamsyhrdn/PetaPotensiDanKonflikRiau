import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, bacaToken } from "./auth";

export async function ambilSesi() {
  return bacaToken((await cookies()).get(COOKIE)?.value);
}

export async function wajibSesi() {
  const s = await ambilSesi();
  if (!s) redirect("/login");
  return s;
}
