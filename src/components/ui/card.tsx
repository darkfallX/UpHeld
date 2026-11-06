import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * Layout system for the app pages (everything except the landing page).
 * Modelled on the Vercel dashboard: one content width, a header band, generous
 * section rhythm, and cards separated by real gaps (never glued together).
 *
 *   page gutter ........ 16px mobile · 24px sm · 32px lg
 *   content width ...... 1200px (wide: 1440px for the Chaos Theater)
 *   section rhythm ..... 48px between sections (space-y-12)
 *   card grid gap ...... 16px between cards (gap-4); 24px between page columns (gap-6)
 *   card padding ....... 20px mobile · 24px sm+ (px-5 sm:px-6)
 *   card header/footer . 16-20px vertical, hairline divider, footer on the subtle surface
 */

/** Width + gutter wrapper. Use for the header band and the body so edges line up. */
export function Container({ className, wide, ...props }: React.HTMLAttributes<HTMLDivElement> & { wide?: boolean }) {
  return <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", wide ? "max-w-[1440px]" : "max-w-[1200px]", className)} {...props} />;
}

/**
 * Full-bleed page header band (title, one-line description, actions on the right),
 * followed by the page body. `children` is the body.
 */
export function PageShell({
  kicker,
  title,
  description,
  actions,
  wide,
  children,
  className,
}: {
  kicker?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("pb-24", className)}>
      <header className="border-b border-line bg-subtle/60">
        <Container wide={wide} className="flex flex-col gap-6 py-10 sm:py-12 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-2xl">
            {kicker && <div className="label">{kicker}</div>}
            <h1 className={cn("text-[32px] font-semibold leading-[1.08] tracking-[-0.045em] sm:text-[40px]", kicker && "mt-3")}>{title}</h1>
            {description && <p className="mt-3 text-[15px] leading-[1.6] text-slate">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
        </Container>
      </header>
      <Container wide={wide} className="space-y-12 pt-10">
        {children}
      </Container>
    </div>
  );
}

/** Legacy header (kept for compatibility). Prefer PageShell. */
export function PageHead({ kicker, title, children, right }: { kicker: string; title: React.ReactNode; children?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="label">{kicker}</div>
        <h1 className="mt-3 text-[32px] font-semibold leading-[1.08] tracking-[-0.045em] sm:text-[40px]">{title}</h1>
        {children && <p className="mt-3 max-w-2xl text-[15px] leading-[1.6] text-slate">{children}</p>}
      </div>
      {right}
    </div>
  );
}

/** A titled page section: heading + description on the left, actions on the right, content below. */
export function Section({
  title,
  description,
  actions,
  id,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const headingId = id ? `${id}-h` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("min-w-0", className)}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 id={headingId} className="text-[20px] font-semibold leading-tight tracking-[-0.03em] text-ink">
            {title}
          </h2>
          {description && <p className="mt-1.5 max-w-2xl text-[14px] leading-[1.55] text-slate">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Card surface. Separate cards with gap-4 / gap-6, not with 1px hairline grids. */
export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0 overflow-hidden rounded-[12px] bg-panel shadow-card", className)} {...props} />;
}

/** Card header: title + optional description and kicker; actions on the right. */
export function PanelHeader({
  className,
  title,
  description,
  kicker,
  right,
  index,
}: {
  className?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  kicker?: React.ReactNode;
  right?: React.ReactNode;
  index?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6 sm:py-5", className)}>
      <div className="min-w-0">
        {(kicker || index) && (
          <div className="label mb-1.5 flex items-center gap-2">
            {index && <span className="font-pixel text-[11px] tracking-normal text-slate">{index}</span>}
            {kicker}
          </div>
        )}
        <div className="text-[16px] font-semibold leading-snug tracking-[-0.02em] text-ink">{title}</div>
        {description && <p className="mt-1 text-[13.5px] leading-[1.5] text-slate">{description}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

/** Card body with the standard 20/24px padding. */
export function PanelBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-5 sm:px-6 sm:py-6", className)} {...props} />;
}

/** Vercel-style card footer: subtle surface, hint text on the left, actions on the right. */
export function PanelFooter({ className, hint, children }: { className?: string; hint?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-3 border-t border-line bg-subtle px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6", className)}>
      {hint ? <div className="min-w-0 text-[13px] leading-[1.5] text-slate">{hint}</div> : <span />}
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{children}</div>}
    </div>
  );
}

export function Kicker({ children, className, index }: { children: React.ReactNode; className?: string; index?: string }) {
  return (
    <div className={cn("label flex items-center gap-2", className)}>
      {index && <span className="font-pixel text-[11px] tracking-normal text-slate">{index}</span>}
      {children}
    </div>
  );
}

/** Grid of separate metric cards (replaces glued hairline stat rows). */
export function StatGrid({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)} {...props} />;
}

/** One metric card. */
export function Stat({ label, value, sub, className }: { label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-[12px] bg-panel p-5 shadow-card sm:p-6", className)}>
      <div className="text-[13px] font-medium text-slate">{label}</div>
      <div className="mt-3 truncate font-mono text-[28px] font-medium leading-none tracking-[-0.03em] tabular text-ink">{value}</div>
      {sub && <div className="mt-3 text-[13px] leading-[1.5] text-dim">{sub}</div>}
    </div>
  );
}

export const fieldClass =
  "h-10 w-full rounded-[8px] bg-panel px-3 text-[14px] text-ink shadow-card placeholder:text-dim transition-shadow outline-none hover:shadow-[0_0_0_1px_var(--line-strong)] focus-visible:outline-none focus:shadow-[0_0_0_1px_var(--accent),0_0_0_4px_color-mix(in_srgb,var(--accent)_22%,transparent)]";
