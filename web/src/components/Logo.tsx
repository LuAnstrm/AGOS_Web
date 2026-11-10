/** AGOS mark: water lines under a downward "level" arrow. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <rect width="64" height="64" rx="14" fill="var(--brand)" />
      <path
        d="M10 38c5.5 0 5.5-5 11-5s5.5 5 11 5 5.5-5 11-5 5.5 5 11 5"
        fill="none"
        stroke="var(--brand-ink)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M10 48c5.5 0 5.5-5 11-5s5.5 5 11 5 5.5-5 11-5 5.5 5 11 5"
        fill="none"
        stroke="var(--brand-ink)"
        strokeOpacity=".55"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path d="M32 12v14" stroke="var(--brand-ink)" strokeWidth="4.5" strokeLinecap="round" />
      <path
        d="M26 20l6 6 6-6"
        fill="none"
        stroke="var(--brand-ink)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ sub }: { sub?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={30} />
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight">AGOS</span>
        {sub && <span className="block text-[11px] font-medium text-muted">{sub}</span>}
      </span>
    </span>
  );
}
