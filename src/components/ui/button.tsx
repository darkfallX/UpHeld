import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Pill buttons, monochrome. Primary is solid ink; secondary is a white surface with a
 * 1px ring. Hovers are subtle (a small tone shift) and trailing icons nudge 3px.
 */
export const buttonVariants = cva(
  [
    "group/btn relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium tracking-[-0.01em]",
    "transition-[transform,background-color,color,box-shadow,opacity] duration-200 ease-[cubic-bezier(0.39,0.18,0.17,0.99)]",
    "active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:size-[15px] [&_svg]:shrink-0",
    "[&>svg:last-child:not(:first-child)]:transition-transform [&>svg:last-child:not(:first-child)]:duration-300",
    "hover:[&>svg:last-child:not(:first-child)]:translate-x-[3px]",
  ].join(" "),
  {
    variants: {
      variant: {
        /** solid ink: the one primary action per view */
        primary: "bg-ink text-ink-inverse hover:bg-ink/85",
        signal: "bg-ink text-ink-inverse hover:bg-ink/85",
        ink: "bg-ink text-ink-inverse hover:bg-ink/85",
        /** secondary: surface + hairline ring */
        solid: "bg-panel text-ink shadow-card hover:bg-raised",
        paper: "bg-panel text-ink shadow-card hover:bg-raised",
        outline: "bg-panel text-ink shadow-card hover:bg-raised",
        ghost: "text-slate hover:bg-raised hover:text-ink",
        danger: "bg-panel text-down shadow-[0_0_0_1px_color-mix(in_srgb,var(--down)_35%,transparent)] hover:bg-down/[0.06]",
        warn: "bg-panel text-warn shadow-[0_0_0_1px_color-mix(in_srgb,var(--warn)_35%,transparent)] hover:bg-warn/[0.06]",
      },
      size: {
        sm: "h-8 px-3.5 text-[13px]",
        md: "h-9 px-4 text-[14px]",
        lg: "h-11 px-5 text-[14px]",
        icon: "size-8",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = "button", ...props }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = "Button";
