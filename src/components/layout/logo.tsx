import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-[26px]", className)} aria-hidden>
      <rect x="0.5" y="0.5" width="31" height="31" rx="6" className="fill-ink transition-[fill] duration-700" />
      <path d="M5 18h5l2.5-6 4 11 3-8 1.8 3H25" fill="none" className="stroke-ink-inverse transition-[stroke] duration-700" strokeWidth="2.2" strokeLinecap="square" strokeLinejoin="miter" />
      <rect x="24.5" y="15.5" width="5" height="5" className="fill-ink-inverse transition-[fill] duration-700" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-[-0.045em] text-ink">UpHeld</span>
    </span>
  );
}
