"use client";

import { useState } from "react";
import { Check, Link2, MessageCircle } from "lucide-react";

export default function Bagikan({ judul }: { judul: string }) {
  const [tersalin, setTersalin] = useState(false);
  const salin = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setTersalin(true); setTimeout(() => setTersalin(false), 1800); } catch { /* abaikan */ }
  };
  return (
    <div className="flex items-center gap-1.5">
      <span className="eyebrow mr-1">Bagikan</span>
      <button onClick={salin} className="flex h-8 items-center gap-1.5 rounded-md bg-navy px-2.5 text-xs font-semibold text-white hover:bg-navy-2">
        {tersalin ? <Check size={14} /> : <Link2 size={14} />}{tersalin ? "Tersalin" : "Salin tautan"}
      </button>
      <a href={`https://wa.me/?text=${encodeURIComponent(judul)}`} target="_blank" rel="noopener noreferrer"
        onClick={(e) => { (e.currentTarget as HTMLAnchorElement).href = `https://wa.me/?text=${encodeURIComponent(judul + " " + window.location.href)}`; }}
        className="flex h-8 items-center gap-1.5 rounded-md bg-[#25a244] px-2.5 text-xs font-semibold text-white hover:opacity-90">
        <MessageCircle size={14} /> WhatsApp
      </a>
    </div>
  );
}
