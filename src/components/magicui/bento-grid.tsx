import { type ComponentPropsWithoutRef, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BentoGridProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode;
  className?: string;
}

interface BentoCardProps extends ComponentPropsWithoutRef<"div"> {
  name: string;
  className?: string;
  background?: ReactNode;
  Icon: React.ComponentType<{ className?: string }>;
  description: string;
  href?: string;
  cta?: string;
  badge?: string;
}

export const BentoGrid = ({ children, className, ...props }: BentoGridProps) => {
  return (
    <div className={cn("grid w-full auto-rows-[20rem] grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)} {...props}>
      {children}
    </div>
  );
};

export const BentoCard = ({
  name,
  className,
  background,
  Icon,
  description,
  href,
  cta,
  badge,
  ...props
}: BentoCardProps) => (
  <div
    key={name}
    className={cn(
      "group relative col-span-1 flex flex-col justify-between overflow-hidden rounded-xl border border-line bg-surface p-6 transition-all duration-300 hover:border-brand/50 ",
      className
    )}
    {...props}
  >
    <div className="pointer-events-none absolute inset-0 z-0">{background}</div>

    <div className="relative z-10 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex size-11 items-center justify-center rounded-xl border border-line bg-ob/80 text-brand-ink transition-transform duration-300 group-hover:scale-105 group-hover:border-brand/40">
          <Icon className="size-5" />
        </div>
        {badge && (
          <span className="rounded-full border border-line bg-ob px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-3">
            {badge}
          </span>
        )}
      </div>
      <h3 className="mt-3 font-display text-xl font-semibold text-ink group-hover:text-brand-ink transition-colors">
        {name}
      </h3>
      <p className="max-w-md text-sm text-ink-2 leading-relaxed">{description}</p>
    </div>

    {cta && href && (
      <div className="relative z-10 pt-4">
        <a
          href={href}
          className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-brand-ink transition-all duration-200 group-hover:translate-x-1 hover:underline"
        >
          {cta}
          <ArrowRight className="size-3.5" />
        </a>
      </div>
    )}

    {/* Subtle gradient overlay on hover */}
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand/[0.04] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
  </div>
);
