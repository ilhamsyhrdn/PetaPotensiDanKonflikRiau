/** Logo: penanda lokasi bergaya kontur. */
export default function Logo({ ukuran = 32 }: { ukuran?: number }) {
  return (
    <svg width={ukuran} height={ukuran} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="9" fill="#2f6690" />
      <circle cx="16" cy="14" r="8.5" fill="none" stroke="#8fb8d8" strokeOpacity=".55" strokeWidth="1.2" />
      <circle cx="16" cy="14" r="5" fill="none" stroke="#8fb8d8" strokeOpacity=".8" strokeWidth="1.2" />
      <path d="M16 25s-6-6.2-6-10.6a6 6 0 1 1 12 0C22 18.8 16 25 16 25Z" fill="#ffd43b" />
      <circle cx="16" cy="14.4" r="2.2" fill="#13202c" />
    </svg>
  );
}
