"use client";

import { LayoutGroup, motion, useMotionValueEvent, useScroll } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BASE_SEPOLIA } from "@/lib/chain";
import { motionTokens } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { BaseStatusPill } from "./base-status";
import { Wordmark } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { ConnectWallet, ResetDemoButton, SandboxWalletChip } from "./wallet-controls";

export const NAV = [
  { href: "/demo", label: "Chaos Theater", idx: "01" },
  { href: "/consumer", label: "Consumer", idx: "02" },
  { href: "/provider", label: "Provider", idx: "03" },
  { href: "/monitor", label: "Monitor", idx: "04" },
  { href: "/contracts", label: "Contracts", idx: "05" },
];

/**
 * Morphing navigation island: a full-bleed hairline bar at rest that contracts into a
 * floating pill once the page scrolls. Layout bounds animate with the house spring.
 */
export function SiteHeader() {
  const path = usePathname();
  const { scrollY } = useScroll();
  const [compact, setCompact] = useState(false);
  const [onHero, setOnHero] = useState(path === "/");
  const update = (v: number) => {
    const next = v > 28;
    if (next !== compact) setCompact(next);
    const hero = document.querySelector<HTMLElement>("[data-hero]");
    const h = hero ? hero.offsetTop + hero.offsetHeight - 64 : 0;
    const over = !!hero && v < h;
    if (over !== onHero) setOnHero(over);
  };
  useMotionValueEvent(scrollY, "change", update);
  useEffect(() => {
    update(window.scrollY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return (
    // over the hero the bar is transparent; once past it, it gains its surface and hairline
    <header className="sticky top-0 z-40">
      <LayoutGroup>
        <motion.div
          layout
          transition={motionTokens.spring}
          className={cn(
            "mx-auto flex items-center gap-3 border-line transition-[background-color,border-color] duration-500",
            onHero && !compact ? "border-transparent bg-transparent" : "bg-canvas/[0.94]",
            compact
              ? "mt-2 h-12 w-[calc(100%-16px)] max-w-[1240px] rounded-full border px-2 pl-4 lg:w-[calc(100%-48px)]"
              : "h-14 max-w-none border-b px-4 sm:px-6 lg:px-8 xl:px-16",
          )}
          style={{ borderRadius: compact ? 999 : 0 }}
        >
          <motion.div layout="position" transition={motionTokens.spring}>
            <Link href="/" aria-label="UpHeld home" className="block">
              <Wordmark />
            </Link>
          </motion.div>
          <motion.nav layout="position" transition={motionTokens.spring} className="ml-3 hidden items-center lg:flex" aria-label="Primary">
            {NAV.map((n) => {
              const active = path?.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn("relative whitespace-nowrap px-3 py-1.5 text-[13px] transition-colors", active ? "text-ink" : "text-slate hover:text-ink")}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-full bg-raised"
                      transition={motionTokens.spring}
                    />
                  )}
                  <span className="relative">{n.label}</span>
                </Link>
              );
            })}
          </motion.nav>
          <motion.div layout="position" transition={motionTokens.spring} className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {!compact && !onHero && <BaseStatusPill className="hidden 2xl:inline-flex" />}
            <ResetDemoButton compact className="hidden lg:inline-flex xl:hidden" />
            <ResetDemoButton compact={compact} className="hidden xl:inline-flex" />
            <SandboxWalletChip />
            <ThemeToggle />
            <ConnectWallet />
          </motion.div>
        </motion.div>
      </LayoutGroup>
      <nav
        className={cn(
          "scroll-thin flex h-[38px] items-center gap-1 overflow-x-auto border-b px-4 transition-[background-color,border-color] duration-500 lg:hidden",
          onHero && !compact ? "border-transparent bg-transparent" : "border-line bg-canvas",
          compact && "mt-2",
        )}
        aria-label="Primary mobile"
      >
        {NAV.map((n) => {
          const active = path?.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn("shrink-0 rounded-full border px-3 py-1 text-xs", active ? "border-transparent bg-raised text-ink" : "border-transparent text-slate")}
            >
              {n.label}
            </Link>
          );
        })}
        <ResetDemoButton compact className="ml-auto shrink-0" />
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid w-full max-w-[1760px] gap-10 px-6 py-14 sm:grid-cols-2 sm:px-10 lg:grid-cols-[2fr_1fr_1fr] lg:px-16">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-sm text-[14px] leading-[1.6] text-slate">Performance-backed subscriptions in USDC. Subscribers are refunded automatically when a service misses its uptime guarantee.</p>
        </div>
        <div>
          <div className="label">Product</div>
          <ul className="mt-4 space-y-2 text-[14px]">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="text-slate transition-colors hover:text-ink">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="label">Network</div>
          <ul className="mt-4 space-y-2 text-[14px] text-slate">
            <li>Base Sepolia · {BASE_SEPOLIA.chainId}</li>
            <li>Vibestarter Vibeathon 02</li>
            <li>Testnet USDC only, no real funds</li>
          </ul>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-2 px-6 pb-10 text-[13px] text-dim sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-16">
        <span>© 2026 UpHeld · Uptime, Upheld on Base</span>
        <span>
          Built by <span className="font-medium text-ink">Darkfall_x</span>
        </span>
      </div>
    </footer>
  );
}
