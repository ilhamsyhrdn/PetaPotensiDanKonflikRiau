"use client";

import { useState } from "react";
import { ArrowRight, CircleAlert, Eye, EyeOff, Loader2, Lock, UserRound } from "lucide-react";

const INPUT =
  "h-12 w-full rounded-xl border border-line bg-[#f7f9fc] pl-11 text-[15px] text-ink outline-none transition placeholder:text-muted/60 hover:border-[#cfd9e3] focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/15";
const IKON = "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/70 transition group-focus-within:text-accent";

export default function LoginForm({ lanjut }: { lanjut?: string }) {
  const [galat, setGalat] = useState("");
  const [proses, setProses] = useState(false);
  const [lihat, setLihat] = useState(false);

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
      // hanya alamat di situs ini; "//situs-lain.com" atau "/\situs-lain.com" akan dibuka peramban sebagai situs luar
      window.location.href = lanjut && /^\/(?![/\\])/.test(lanjut) ? lanjut : "/";
      return;
    }
    const data = await res.json().catch(() => ({}));
    setGalat(data.pesan ?? "Gagal masuk. Coba lagi.");
    setProses(false);
  }

  return (
    <form onSubmit={kirim} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="username" className="block text-[13px] font-semibold">Username</label>
        <div className="group relative">
          <UserRound size={18} className={IKON} />
          <input id="username" name="username" autoComplete="username" required placeholder="Masukkan username"
            className={`${INPUT} pr-4`} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-[13px] font-semibold">Password</label>
        <div className="group relative">
          <Lock size={18} className={IKON} />
          <input id="password" name="password" type={lihat ? "text" : "password"} autoComplete="current-password" required placeholder="Masukkan password"
            className={`${INPUT} pr-12`} />
          <button type="button" onClick={() => setLihat((v) => !v)} aria-pressed={lihat}
            aria-label={lihat ? "Sembunyikan password" : "Tampilkan password"}
            className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-accent-soft hover:text-accent">
            {lihat ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {galat && (
        <p role="alert" className="anim-turun flex items-start gap-2 rounded-xl border border-neg/20 bg-neg/[0.06] px-3.5 py-2.5 text-sm text-neg">
          <CircleAlert size={16} className="mt-0.5 shrink-0" /> {galat}
        </p>
      )}

      <button type="submit" disabled={proses}
        className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#3a78a8] to-accent font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_10px_24px_-10px_rgb(47_102_144/0.75)] transition hover:-translate-y-px hover:from-[#326d99] hover:to-[#25557a] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_14px_28px_-10px_rgb(47_102_144/0.85)] active:translate-y-0 disabled:pointer-events-none disabled:opacity-70">
        {proses ? (
          <><Loader2 size={18} className="animate-spin" /> Memeriksa…</>
        ) : (
          <>Masuk <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" /></>
        )}
      </button>
    </form>
  );
}
