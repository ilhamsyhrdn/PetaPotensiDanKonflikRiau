"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";

export default function LoginForm({ lanjut }: { lanjut?: string }) {
  const [galat, setGalat] = useState("");
  const [proses, setProses] = useState(false);

  async function kirim(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGalat("");
    setProses(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
    });
    if (res.ok) {
      window.location.href = lanjut && lanjut.startsWith("/") ? lanjut : "/";
      return;
    }
    const data = await res.json().catch(() => ({}));
    setGalat(data.pesan ?? "Gagal masuk. Coba lagi.");
    setProses(false);
  }

  return (
    <form onSubmit={kirim} className="space-y-4">
      <label className="block space-y-1.5" htmlFor="username">
        <span className="text-sm font-medium">Username</span>
        <input id="username" name="username" autoComplete="username" required
          className="w-full rounded-md border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
      </label>
      <label className="block space-y-1.5" htmlFor="password">
        <span className="text-sm font-medium">Password</span>
        <input id="password" name="password" type="password" autoComplete="current-password" required
          className="w-full rounded-md border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
      </label>
      {galat && <p role="alert" className="rounded-md bg-neg/10 px-3 py-2 text-sm text-neg">{galat}</p>}
      <button type="submit" disabled={proses}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 font-semibold text-white transition hover:bg-[#25557a] disabled:opacity-60">
        <LogIn size={18} /> {proses ? "Memeriksa…" : "Masuk"}
      </button>
    </form>
  );
}
