export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id="eg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#eg)" />
      <path d="M10 9.5h12M10 16h9M10 22.5h12M10 9.5v13" stroke="white" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <circle cx="22" cy="16" r="2.2" fill="white" />
    </svg>
  );
}

export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <Mark size={size} />
      <span className="text-[15px] font-semibold tracking-tight text-zinc-100">Engram</span>
    </div>
  );
}
