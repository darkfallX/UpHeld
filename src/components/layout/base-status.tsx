"use client";

import { useBlockNumber } from "wagmi";
import { BASE_SEPOLIA } from "@/lib/chain";
import { cn } from "@/lib/utils";
import { LiveDot } from "../telemetry/status-badge";

/** Live Base Sepolia head block, polled from the public RPC (sepolia.base.org). */
export function BaseStatusPill({ className }: { className?: string }) {
  const { data, isError, isLoading } = useBlockNumber({ chainId: BASE_SEPOLIA.chainId, watch: true, query: { refetchInterval: 4000 } });
  return (
    <a
      href={BASE_SEPOLIA.explorer}
      target="_blank"
      rel="noreferrer"
      title="Latest block from sepolia.base.org"
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-line-strong px-2.5 font-mono text-[10.5px] text-slate transition-colors hover:border-ink/40 hover:text-ink",
        className,
      )}
    >
      <LiveDot color={isError ? "var(--warn)" : "var(--accent)"} />
      <span className="text-ink">Base Sepolia</span>
      <span className="tabular normal-case tracking-normal">{isError ? "RPC unreachable" : isLoading || !data ? "syncing…" : `#${data.toLocaleString("en-US")}`}</span>
    </a>
  );
}
