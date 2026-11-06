"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, FlaskConical, LogOut, PlugZap, RefreshCw, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatEther } from "viem";
import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { useHydrated } from "@/hooks/use-hydrated";
import { BASE_SEPOLIA, JUDGE_WALLET, shortHex } from "@/lib/chain";
import { formatUsdc } from "@/lib/sla-engine";
import { useUpHeld } from "@/lib/store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { CB_OPT_IN_KEY } from "@/lib/wagmi";
import { NumberTicker } from "../magicui/number-ticker";
import { Button } from "../ui/button";

export function SandboxWalletChip({ className }: { className?: string }) {
  const bal = useUpHeld((s) => s.balances[JUDGE_WALLET] ?? 0);
  const hydrated = useHydrated();
  return (
    <div
      className={cn("inline-flex h-8 items-center gap-2 rounded-full border border-line-strong px-3", className)}
      title={`Judge Sandbox wallet ${JUDGE_WALLET}`}
    >
      <FlaskConical className="size-3.5 text-slate" strokeWidth={1.6} aria-hidden />
      <span className="hidden font-mono text-[11px] text-dim xl:inline">{shortHex(JUDGE_WALLET)}</span>
      <span className="font-mono text-[12px] font-medium text-ink">
        {hydrated ? <NumberTicker value={bal} format={(v) => formatUsdc(Math.round(v))} /> : formatUsdc(bal)}
      </span>
      <span className="hidden font-mono text-[10px] text-dim sm:inline">USDC</span>
    </div>
  );
}

/** Turn wallet / wagmi errors into a sentence a person can act on. */
function walletErrorMessage(e: unknown, walletName = "your wallet"): string {
  const err = e as { code?: number; name?: string; shortMessage?: string; message?: string; cause?: { code?: number } } | undefined;
  const code = err?.code ?? err?.cause?.code;
  const msg = `${err?.name ?? ""} ${err?.shortMessage ?? ""} ${err?.message ?? ""}`;
  if (code === 4001 || /UserRejected|rejected|denied/i.test(msg)) return "You cancelled the request in your wallet. Nothing was shared.";
  if (code === -32002 || /already pending|ResourceUnavailable/i.test(msg)) return `A request is already waiting in ${walletName}. Open the extension, approve or reject it, then try again.`;
  if (/ProviderNotFound|Provider not found/i.test(msg)) return "No wallet extension was found in this browser.";
  return (err?.shortMessage ?? err?.message ?? "Unknown error").split("\n")[0];
}

const PENDING_HINT_MS = 6000;

/**
 * Real wallet connection (optional: the Judge Sandbox never needs it).
 * Safety model: connecting only requests account access. No signature is requested to connect,
 * every write in the app is pinned to Base Sepolia (84532) so nothing can be signed on mainnet,
 * and the app never asks for or stores a private key or seed phrase.
 */
export function ConnectWallet({ className }: { className?: string }) {
  const { address, chainId, isConnected, connector } = useAccount();
  const { connectors, connect, isPending, variables, reset } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching, reset: resetSwitch } = useSwitchChain();
  const { data: eth } = useBalance({ address, chainId: BASE_SEPOLIA.chainId, query: { enabled: !!address } });
  const [open, setOpen] = useState(false);
  const [slow, setSlow] = useState(false);
  const [env, setEnv] = useState<{ hasInjected: boolean; mobile: boolean; dappPath: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEnv({
      hasInjected: !!(window as unknown as { ethereum?: unknown }).ethereum,
      mobile: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
      dappPath: `${window.location.host}${window.location.pathname}`,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  // A wallet popup that opened behind the browser looks like "nothing happened".
  // After a few seconds, say where to look and offer a way out.
  const waiting = isPending || switching;
  useEffect(() => {
    if (!waiting) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), PENDING_HINT_MS);
    return () => clearTimeout(t);
  }, [waiting]);

  if (!env) {
    return (
      <Button size="sm" variant="outline" className={className} disabled>
        <Wallet /> Connect wallet
      </Button>
    );
  }

  const wrongChain = isConnected && chainId !== BASE_SEPOLIA.chainId;
  const discovered = connectors.some((c) => c.id !== "injected" && c.id !== "coinbaseSmartWallet");
  // The generic "injected" entry only helps when a legacy wallet exposes window.ethereum without EIP-6963.
  const list = connectors.filter((c) => (c.id === "injected" ? !discovered && env.hasInjected : true));
  const hasBrowserWallet = list.some((c) => c.id !== "coinbaseSmartWallet");
  const pendingName = (isPending && variables?.connector && "name" in variables.connector ? variables.connector.name : undefined) ?? "your wallet";

  const doSwitch = () =>
    switchChain(
      { chainId: BASE_SEPOLIA.chainId },
      {
        onSuccess: () => toast.success("Switched to Base Sepolia", "Your wallet is on the Base Sepolia testnet."),
        onError: (e) => toast.error("Network switch failed", walletErrorMessage(e, connector?.name)),
      },
    );

  return (
    <div ref={ref} className={cn("relative", className)}>
      {isConnected && address ? (
        <Button size="sm" variant={wrongChain ? "warn" : "outline"} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog">
          <span className={cn("size-1.5 rounded-full", wrongChain ? "bg-warn" : "bg-accent")} />
          <span className="font-mono">{wrongChain ? "Wrong network" : shortHex(address)}</span>
          <ChevronDown className="opacity-60" />
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog">
          <Wallet />
          {isPending ? (
            "Connecting…"
          ) : (
            <>
              Connect<span className="hidden sm:inline"> wallet</span>
            </>
          )}
        </Button>
      )}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.35 }}
            role="dialog"
            aria-label="Wallet"
            className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(320px,calc(100vw-24px))] rounded-[12px] bg-panel p-4 shadow-raised"
          >
            {isConnected && address ? (
              <div className="space-y-3">
                <div>
                  <div className="label">Live wallet · {connector?.name}</div>
                  <div className="mt-1 break-all font-mono text-xs text-ink">{address}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  <div className="rounded-[8px] border border-line p-2.5">
                    <div className="text-[11px] text-dim">Network</div>
                    <div className={wrongChain ? "text-warn" : "text-ink"}>{wrongChain ? `Chain ${chainId}` : "Base Sepolia"}</div>
                  </div>
                  <div className="rounded-[8px] border border-line p-2.5">
                    <div className="text-[11px] text-dim">ETH for gas</div>
                    <div className="text-ink">{eth ? Number(formatEther(eth.value)).toFixed(4) : "-"}</div>
                  </div>
                </div>
                {wrongChain && (
                  <div className="space-y-2 rounded-[8px] border border-warn/40 p-3">
                    <p className="text-[12.5px] leading-relaxed text-slate">
                      UpHeld runs on <span className="text-ink">Base Sepolia testnet</span>. Switch networks to use live actions.
                    </p>
                    <Button size="sm" variant="primary" className="w-full" disabled={switching} onClick={doSwitch}>
                      <RefreshCw className={switching ? "animate-spin" : ""} /> {switching ? "Approve in your wallet…" : "Switch to Base Sepolia"}
                    </Button>
                    {switching && slow && (
                      <button type="button" className="w-full text-center text-[12px] text-dim underline-offset-4 hover:text-ink hover:underline" onClick={() => resetSwitch()}>
                        If no prompt appears, open your wallet extension or cancel here.
                      </button>
                    )}
                  </div>
                )}
                {!wrongChain && eth && eth.value === 0n && (
                  <a href="https://docs.base.org/base-chain/tools/network-faucets" target="_blank" rel="noopener noreferrer" className="block text-[12px] text-slate underline-offset-4 hover:text-ink hover:underline">
                    Get Base Sepolia ETH for gas from a faucet →
                  </a>
                )}
                <a href="/contracts#live" className="block rounded-[8px] border border-line-strong px-3 py-2 text-xs text-ink transition-colors hover:border-ink/40" onClick={() => setOpen(false)}>
                  <span className="font-medium">Open the live console →</span>
                  <span className="mt-0.5 block text-slate">Deploy, mint, subscribe, record outages and claim on Base Sepolia.</span>
                </a>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    disconnect();
                    setOpen(false);
                  }}
                >
                  <LogOut /> Disconnect
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="label">Connect a Base Sepolia wallet</div>
                {isPending ? (
                  <div className="space-y-2 rounded-[8px] border border-line p-3" aria-live="polite">
                    <div className="flex items-center gap-2 text-[13px] text-ink">
                      <RefreshCw className="size-3.5 animate-spin" /> Waiting for {pendingName}…
                    </div>
                    <p className="text-[12.5px] leading-relaxed text-slate">
                      Approve the connection in the {pendingName} popup.
                      {slow && " If you don't see it, click the wallet icon in your browser toolbar. It may be behind this window."}
                    </p>
                    <Button size="sm" variant="ghost" className="w-full" onClick={() => reset()}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  list.map((c) => (
                    <Button
                      key={c.uid}
                      size="sm"
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        if (c.id === "coinbaseSmartWallet") {
                          try {
                            localStorage.setItem(CB_OPT_IN_KEY, "1");
                          } catch {}
                        }
                        // Connect first (one popup). The network switch is a separate, explicit step,
                        // so cancelling or missing the switch prompt never blocks the connection itself.
                        connect(
                          { connector: c },
                          {
                            onSuccess: (data) => {
                              if (data.chainId !== BASE_SEPOLIA.chainId) {
                                toast.info("Wallet connected", "Switch to Base Sepolia to use live mode.");
                              } else {
                                setOpen(false);
                                toast.success("Wallet connected", "Live mode is available on /contracts.");
                              }
                            },
                            onError: (e) => toast.error("Wallet connection failed", walletErrorMessage(e, c.name)),
                          },
                        );
                      }}
                    >
                      {c.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.icon} alt="" className="size-4 rounded-[3px]" />
                      ) : (
                        <PlugZap />
                      )}
                      {c.id === "injected" ? "Browser wallet" : c.name}
                    </Button>
                  ))
                )}
                {!hasBrowserWallet && !isPending && (
                  <div className="rounded-[8px] border border-dashed border-line-strong p-3 text-[12.5px] leading-relaxed text-slate">
                    No wallet extension found in this browser.{" "}
                    {env.mobile ? (
                      <a className="text-ink underline underline-offset-4" href={`https://metamask.app.link/dapp/${env.dappPath}`} rel="noopener noreferrer">
                        Open UpHeld in the MetaMask app
                      </a>
                    ) : (
                      <a className="text-ink underline underline-offset-4" href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer">
                        Install MetaMask
                      </a>
                    )}{" "}
                    or use Coinbase Smart Wallet (passkey, no extension).
                  </div>
                )}
                <p className="pt-1 text-[12px] leading-relaxed text-dim">
                  Connecting shares your address only. UpHeld never asks for your seed phrase or private key, and connecting does not require a signature. Without a wallet, use the pre-funded Judge Sandbox.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ResetDemoButton({ className, compact = false }: { className?: string; compact?: boolean }) {
  const reset = useUpHeld((s) => s.resetDemo);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      size="sm"
      variant={armed ? "danger" : "ghost"}
      className={className}
      onClick={() => {
        if (!armed) return setArmed(true);
        reset();
        setArmed(false);
        toast.info("Demo state reset", `Judge wallet balance is ${formatUsdc(100_000_000)} USDC. All services are at 100.00% uptime.`);
      }}
      title="Restore initial balances, reserves and 100% uptime"
    >
      <RefreshCw /> {armed ? "Click to confirm" : compact ? "Reset" : "Reset demo state"}
    </Button>
  );
}
