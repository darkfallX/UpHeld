"use client";

import { deployContract, waitForTransactionReceipt, writeContract } from "@wagmi/core";
import { Check, CircleCheck, Copy, ExternalLink, Loader2, OctagonX, Rocket, ShieldAlert, Unplug } from "lucide-react";
import { useEffect, useState } from "react";
import { BaseError, keccak256, toHex, type Hash } from "viem";
import { useAccount, useReadContracts, useSwitchChain } from "wagmi";
import { BASE_SEPOLIA, explorerAddress, explorerTx, shortHex } from "@/lib/chain";
import { decodeServiceTuple, mockUsdcAbi, mockUsdcBytecode, upHealthSlaAbi, upHealthSlaBytecode } from "@/lib/contracts";
import { ENV_DEPLOYMENT, isEnvDeployment, txOnDeployment, useLiveDeployment } from "@/lib/live-deployment";
import { calculateUptimeBps, formatBps, formatUsdc, usdc } from "@/lib/sla-engine";
import { toast, useToasts } from "@/lib/toast";
import type { Address, Receipt } from "@/lib/types";
import { wagmiConfig } from "@/lib/wagmi";
import { cn } from "@/lib/utils";
import { ConnectWallet } from "../layout/wallet-controls";
import { Button } from "../ui/button";
import { Panel, PanelBody, PanelFooter, PanelHeader, fieldClass } from "../ui/card";

const CHAIN = BASE_SEPOLIA.chainId;

function errMsg(e: unknown) {
  if (e instanceof BaseError) return e.shortMessage;
  if (e instanceof Error) return e.message.split("\n")[0];
  return "Transaction failed";
}

export function LiveConsole() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const dep = useLiveDeployment();
  const [busy, setBusy] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState(1);
  const [outageMins, setOutageMins] = useState(480);
  const [form, setForm] = useState({ name: "CloudBox Live", price: "10", sla: "9995", reserve: "50" });
  const [mounted, setMounted] = useState(false);
  const [copiedClaim, setCopiedClaim] = useState(false);
  useEffect(() => setMounted(true), []);

  const sla = dep.sla;
  const usdcAddr = dep.usdc;
  const ready = !!(sla && usdcAddr && address);

  const reads = useReadContracts({
    allowFailure: true,
    query: { enabled: ready, refetchInterval: 8000 },
    contracts: ready
      ? [
          { address: usdcAddr!, abi: mockUsdcAbi, functionName: "balanceOf", args: [address!], chainId: CHAIN },
          { address: usdcAddr!, abi: mockUsdcAbi, functionName: "allowance", args: [address!, sla!], chainId: CHAIN },
          { address: sla!, abi: upHealthSlaAbi, functionName: "nextServiceId", chainId: CHAIN },
          { address: sla!, abi: upHealthSlaAbi, functionName: "services", args: [BigInt(serviceId)], chainId: CHAIN },
          { address: sla!, abi: upHealthSlaAbi, functionName: "claimableCompensation", args: [address!, BigInt(serviceId)], chainId: CHAIN },
          { address: sla!, abi: upHealthSlaAbi, functionName: "isSubscribed", args: [address!, BigInt(serviceId)], chainId: CHAIN },
          { address: sla!, abi: upHealthSlaAbi, functionName: "isAttestor", args: [address!], chainId: CHAIN },
          { address: sla!, abi: upHealthSlaAbi, functionName: "availableReserve", args: [BigInt(serviceId)], chainId: CHAIN },
          { address: sla!, abi: upHealthSlaAbi, functionName: "seatCoverRequired", args: [BigInt(serviceId)], chainId: CHAIN },
        ]
      : [],
  });
  const r = reads.data;
  const balance = r?.[0]?.result as bigint | undefined;
  const allowance = r?.[1]?.result as bigint | undefined;
  const nextId = r?.[2]?.result as bigint | undefined;
  const svcTuple = r?.[3]?.result as Parameters<typeof decodeServiceTuple>[0] | undefined;
  const svc = svcTuple ? decodeServiceTuple(svcTuple) : undefined;
  const claimable = r?.[4]?.result as bigint | undefined;
  const subscribed = r?.[5]?.result as boolean | undefined;
  // undefined means unknown (for example, an older deployment without attestor roles); rely on the transaction result
  const attestor = r?.[6]?.status === "success" ? (r[6].result as boolean) : undefined;
  // seat backing: subscribing locks seatCoverRequired out of availableReserve
  const freeReserve = r?.[7]?.status === "success" ? (r[7].result as bigint) : undefined;
  const seatCover = r?.[8]?.status === "success" ? (r[8].result as bigint) : undefined;
  const seatBacked = freeReserve === undefined || seatCover === undefined ? undefined : freeReserve >= seatCover;
  const svcExists = !!svc && svc.active;

  async function run(label: string, method: string, send: () => Promise<Hash>, amount?: bigint): Promise<{ receipt: Receipt; contractAddress: Address | null } | undefined> {
    if (!address) return;
    setBusy(label);
    try {
      const hash = await send();
      dep.pushTx({ hash, label, at: new Date().toISOString(), status: "pending", sla: dep.sla });
      const rc = await waitForTransactionReceipt(wagmiConfig, { hash, chainId: CHAIN });
      dep.updateTx(hash, rc.status === "success" ? "success" : "reverted");
      if (rc.status !== "success") throw new Error(`${label} reverted on-chain`);
      const receipt: Receipt = {
        txHash: hash,
        blockNumber: Number(rc.blockNumber),
        method,
        from: address,
        to: (rc.to ?? rc.contractAddress ?? "0x") as Address,
        args: {},
        events: [],
        amountUsdc: amount !== undefined ? Number(amount) : undefined,
        gasUsed: Number(rc.gasUsed),
        timestamp: new Date().toISOString(),
        mode: "live",
      };
      toast.success(`${label} confirmed on Base Sepolia`, `Block #${rc.blockNumber.toLocaleString()}`, receipt);
      void reads.refetch();
      return { receipt, contractAddress: (rc.contractAddress ?? null) as Address | null };
    } catch (e) {
      toast.error(`${label} failed`, errMsg(e));
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  /** Deploys MockUSDC then UpHealthSLA from the connected wallet (which becomes owner + attestor).
   *  If MockUSDC already went out from this browser, resumes with the UpHealthSLA transaction only. */
  async function deploy() {
    if (!address) return;
    let usdcAddress = dep.pendingUsdc;
    if (!usdcAddress) {
      const u = await run("Deploy MockUSDC", "constructor", () => deployContract(wagmiConfig, { abi: mockUsdcAbi, bytecode: mockUsdcBytecode, chainId: CHAIN }));
      if (!u?.contractAddress) return;
      usdcAddress = u.contractAddress;
      dep.setPendingUsdc(usdcAddress);
    }
    const token = usdcAddress;
    const s = await run("Deploy UpHealthSLA", "constructor", () => deployContract(wagmiConfig, { abi: upHealthSlaAbi, bytecode: upHealthSlaBytecode, args: [token], chainId: CHAIN }));
    if (!s?.contractAddress) return;
    dep.setDeployment({ sla: s.contractAddress, usdc: token, deployer: address });
    setServiceId(1);
  }

  if (!mounted) return null;

  const wrongChain = isConnected && chainId !== CHAIN;
  const fromEnv = isEnvDeployment(dep);
  // Shared (env) deployment and this wallet can't attest: offer a private copy so step 6 still works.
  const offerOwnCopy = fromEnv && attestor === false;
  // newest confirmed claim on the active deployment
  const lastClaim = dep.txs.find((t) => t.label === "Claim compensation" && t.status === "success" && txOnDeployment(t, dep.sla));
  const deployLabel = dep.pendingUsdc ? "Deploy UpHealthSLA (1 transaction left)" : "Deploy your own copy (2 transactions)";
  // Exact-amount approval (never unlimited): enough for this flow's reserve top-up plus one subscription.
  const approvalAmount = BigInt(usdc(Number(form.reserve) || 0)) + (svc ? svc.monthlyPriceUsdc : BigInt(usdc(Number(form.price) || 0)));
  const needsApproval = allowance !== undefined && allowance < approvalAmount;
  const steps: Array<{ key: string; title: string; detail: string; done: boolean; action: React.ReactNode }> = ready
    ? [
        {
          key: "mint",
          title: "1 · Mint 100 MockUSDC",
          detail: `faucet(you, 100_000_000) · balance ${balance !== undefined ? formatUsdc(Number(balance)) : "…"}`,
          done: (balance ?? 0n) > 0n,
          action: (
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run("Mint 100 USDC", "faucet", () => writeContract(wagmiConfig, { address: usdcAddr!, abi: mockUsdcAbi, functionName: "faucet", args: [address!, BigInt(usdc(100))], chainId: CHAIN }), BigInt(usdc(100)))}>
              Mint
            </Button>
          ),
        },
        {
          key: "approve",
          title: "2 · Approve UpHealthSLA",
          detail: `approve(UpHealthSLA, ${formatUsdc(Number(approvalAmount))}) · exact amount · allowance ${allowance === undefined ? "…" : allowance > 10n ** 30n ? "unlimited" : formatUsdc(Number(allowance))}`,
          done: !needsApproval && allowance !== undefined,
          action: (
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run("Approve USDC", "approve", () => writeContract(wagmiConfig, { address: usdcAddr!, abi: mockUsdcAbi, functionName: "approve", args: [sla!, approvalAmount], chainId: CHAIN }))}>
              Approve
            </Button>
          ),
        },
        {
          key: "register",
          title: "3 · Register a service",
          detail: `registerService("${form.name}", $${form.price}, ${formatBps(Number(form.sla))}, 10/25/50%) · next id ${nextId ?? "…"}`,
          done: (nextId ?? 1n) > 1n,
          action: (
            <Button
              size="sm"
              variant="outline"
              disabled={!!busy || !form.name.trim()}
              onClick={async () => {
                const id = nextId ?? 1n;
                const ok = await run("Register service", "registerService", () =>
                  writeContract(wagmiConfig, { address: sla!, abi: upHealthSlaAbi, functionName: "registerService", args: [form.name.trim(), BigInt(usdc(Number(form.price) || 0)), Number(form.sla), 1000, 2500, 5000], chainId: CHAIN }),
                );
                if (ok !== undefined) setServiceId(Number(id));
              }}
            >
              Register
            </Button>
          ),
        },
        {
          key: "fund",
          title: "4 · Fund reserve",
          detail: `fundReserve(${serviceId}, ${form.reserve} USDC) · reserve ${svc ? formatUsdc(Number(svc.reserveBalanceUsdc)) : "…"}`,
          done: !!svc && svc.reserveBalanceUsdc > 0n,
          action: (
            <Button size="sm" variant="outline" disabled={!!busy || !svcExists} onClick={() => run("Fund reserve", "fundReserve", () => writeContract(wagmiConfig, { address: sla!, abi: upHealthSlaAbi, functionName: "fundReserve", args: [BigInt(serviceId), BigInt(usdc(Number(form.reserve) || 0))], chainId: CHAIN }), BigInt(usdc(Number(form.reserve) || 0)))}>
              Fund
            </Button>
          ),
        },
        {
          key: "subscribe",
          title: "5 · Subscribe",
          detail: `subscribe(${serviceId}) · pays ${svc ? formatUsdc(Number(svc.monthlyPriceUsdc)) : "…"} to the provider · locks ${seatCover !== undefined ? formatUsdc(Number(seatCover)) : "…"} of reserve for your seat${seatBacked === false ? " · reserve too low, fund it first" : ""}`,
          done: !!subscribed,
          action: (
            <Button size="sm" variant="outline" disabled={!!busy || !svcExists || !!subscribed || seatBacked === false} onClick={() => run("Subscribe", "subscribe", () => writeContract(wagmiConfig, { address: sla!, abi: upHealthSlaAbi, functionName: "subscribe", args: [BigInt(serviceId)], chainId: CHAIN }), svc?.monthlyPriceUsdc)}>
              Subscribe
            </Button>
          ),
        },
        {
          key: "outage",
          title: "6 · Record an outage",
          detail: `${attestor === false ? "Your wallet is not an attestor. Deploy your own copy to record outages · " : ""}recordOutage(${serviceId}, ${outageMins}, keccak256) · uptime ${svc ? formatBps(svc.currentUptimeBps) : "…"} → ${svc ? formatBps(calculateUptimeBps(Number(svc.downtimeMinutes) + outageMins)) : "…"}`,
          done: !!svc && svc.downtimeMinutes > 0n,
          action: (
            <div className="flex gap-2">
              <select aria-label="Outage minutes" className={cn(fieldClass, "h-8 w-auto rounded-full pl-3 pr-2 font-mono text-[13px]")} value={outageMins} onChange={(e) => setOutageMins(Number(e.target.value))}>
                <option value={35}>35m</option>
                <option value={480}>480m</option>
                <option value={1200}>1200m</option>
              </select>
              <Button
                size="sm"
                variant="danger"
                disabled={!!busy || !svcExists || attestor === false}
                title={attestor === false ? "Your wallet is not an approved attestor on this deployment" : undefined}
                onClick={() =>
                  run("Record outage", "recordOutage", () =>
                    writeContract(wagmiConfig, {
                      address: sla!,
                      abi: upHealthSlaAbi,
                      functionName: "recordOutage",
                      args: [BigInt(serviceId), BigInt(outageMins), keccak256(toHex(`upheld:live:${serviceId}:${outageMins}:${Date.now()}`))],
                      chainId: CHAIN,
                    }),
                  )
                }
              >
                Record
              </Button>
            </div>
          ),
        },
        {
          key: "claim",
          title: "7 · Claim compensation",
          detail: `claimCompensation(${serviceId}) · claimable ${claimable !== undefined ? formatUsdc(Number(claimable)) : "…"}`,
          done: !!lastClaim,
          action: (
            <Button
              size="sm"
              variant="signal"
              disabled={!!busy || !claimable}
              onClick={async () => {
                const res = await run("Claim compensation", "claimCompensation", () => writeContract(wagmiConfig, { address: sla!, abi: upHealthSlaAbi, functionName: "claimCompensation", args: [BigInt(serviceId)], chainId: CHAIN }), claimable);
                if (res) useToasts.getState().openReceipt(res.receipt);
              }}
            >
              Claim {claimable ? formatUsdc(Number(claimable)) : ""}
            </Button>
          ),
        },
      ]
    : [];

  // On the shared env deployment "forget" would change nothing, so only offer it for a browser-owned deployment.
  const forgetBtn =
    isConnected && dep.sla && !fromEnv ? (
      <Button size="sm" variant="ghost" onClick={() => dep.forget()} title="Forget this deployment and its transaction list in this browser">
        <Unplug /> {ENV_DEPLOYMENT ? "Back to shared deployment" : "Use a different deployment"}
      </Button>
    ) : null;

  const ownCopyCallout = offerOwnCopy ? (
    <div className="flex flex-col gap-3 border-b border-line bg-subtle px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex min-w-0 gap-3">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn" />
        <p className="text-[13.5px] leading-[1.55] text-slate">
          Your wallet is not an attestor on the shared deployment, so it cannot record outages. Deploy your own copy to make your wallet its attestor and complete step 6. You
          can switch back at any time.
        </p>
      </div>
      <Button
        size="sm"
        variant="primary"
        className="h-auto min-h-8 max-w-full shrink-0 self-start whitespace-normal py-1.5 text-left sm:h-8 sm:self-auto sm:whitespace-nowrap sm:py-0"
        disabled={!!busy}
        onClick={deploy}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Rocket />} {deployLabel}
      </Button>
    </div>
  ) : null;

  const claimProof = lastClaim ? (
    <div className="border-t border-line px-5 py-4 sm:px-6">
      <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
        <CircleCheck className="size-4" /> Claim transaction
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <a
          href={explorerTx(lastClaim.hash)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-w-0 items-center gap-1 font-mono text-[12px] text-ink underline decoration-ink/30 underline-offset-4 [overflow-wrap:anywhere] hover:decoration-ink"
        >
          {shortHex(lastClaim.hash, 12, 10)} <ExternalLink className="size-3 shrink-0" />
        </a>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            void navigator.clipboard?.writeText(lastClaim.hash);
            setCopiedClaim(true);
            setTimeout(() => setCopiedClaim(false), 1500);
          }}
        >
          {copiedClaim ? <Check /> : <Copy />} {copiedClaim ? "Copied" : "Copy hash"}
        </Button>
      </div>
      <p className="mt-2 text-[12.5px] leading-[1.55] text-dim">
        To list it under Deployment proof, set <span className="font-mono text-slate">NEXT_PUBLIC_PROOF_CLAIM_TX</span> to this hash and redeploy the site.
        {!fromEnv && (
          <>
            {" "}
            This claim ran on your own copy, so also set <span className="font-mono text-slate">NEXT_PUBLIC_UPHELD_SLA_ADDRESS</span> and{" "}
            <span className="font-mono text-slate">NEXT_PUBLIC_MOCK_USDC_ADDRESS</span> to its contract addresses.
          </>
        )}
      </p>
    </div>
  ) : null;

  const consoleHeader = (
    <PanelHeader
      title={<span id="live-console-h">Live console</span>}
      description="Transactions on Base Sepolia (chainId 84532), signed by your wallet."
    />
  );

  const txPanel =
    dep.txs.length > 0 ? (
      <Panel>
        <PanelHeader title="Your Base Sepolia transactions" description="Sent from this browser, newest first." />
        <ul className="divide-y divide-line">
          {dep.txs.slice(0, 10).map((t) => (
            <li key={t.hash} className="flex items-center gap-3 px-5 py-3.5 text-[13px] sm:px-6">
              {t.status === "success" ? (
                <CircleCheck className="size-3.5 shrink-0 text-ink" />
              ) : t.status === "reverted" ? (
                <OctagonX className="size-3.5 shrink-0 text-down" />
              ) : (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-ink" />
              )}
              <span className="min-w-0 flex-1 truncate text-slate">{t.label}</span>
              <a
                href={explorerTx(t.hash)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 font-mono text-[12px] text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
              >
                {shortHex(t.hash, 8, 6)} <ExternalLink className="size-3" />
              </a>
            </li>
          ))}
        </ul>
      </Panel>
    ) : null;

  // Setup state: one card with the next required action in its footer.
  if (!isConnected || wrongChain || !dep.sla || !dep.usdc) {
    let body: React.ReactNode;
    let hint: React.ReactNode;
    let action: React.ReactNode;
    if (!isConnected) {
      body = (
        <>
          Connect MetaMask, Rabby, Coinbase Wallet or a Coinbase Smart Wallet to deploy <span className="font-mono text-ink">MockUSDC</span> and{" "}
          <span className="font-mono text-ink">UpHealthSLA</span> and call each function on Base Sepolia.
        </>
      );
      hint = <>Requires Base Sepolia ETH for gas.</>;
      action = (
        <div className="ml-auto">
          <ConnectWallet />
        </div>
      );
    } else if (wrongChain) {
      body = <>Your wallet is on chain {chainId}. UpHeld runs on Base Sepolia (84532).</>;
      hint = "Approve the network switch in your wallet.";
      action = (
        <Button variant="primary" onClick={() => switchChain({ chainId: CHAIN })}>
          Switch to Base Sepolia
        </Button>
      );
    } else {
      body = (
        <>
          No deployment found in this browser. Deploy both contracts from <span className="font-mono text-ink">{shortHex(address!)}</span> (2 transactions). Your wallet becomes the owner and outage attestor.
          {dep.pendingUsdc && (
            <>
              {" "}
              MockUSDC is already deployed at <span className="font-mono text-ink">{shortHex(dep.pendingUsdc)}</span>, so only UpHealthSLA remains.
            </>
          )}{" "}
          To use an existing deployment, set <span className="font-mono text-dim">NEXT_PUBLIC_UPHELD_SLA_ADDRESS</span> and{" "}
          <span className="font-mono text-dim">NEXT_PUBLIC_MOCK_USDC_ADDRESS</span>.
        </>
      );
      hint = busy ? (
        <span className="inline-flex items-center gap-2 text-ink">
          <Loader2 className="size-3.5 animate-spin" /> {busy}: confirm in your wallet, then wait for Base Sepolia…
        </span>
      ) : dep.pendingUsdc ? (
        "One transaction left: UpHealthSLA."
      ) : (
        "Two transactions: MockUSDC first, then UpHealthSLA."
      );
      action = (
        <Button variant="primary" disabled={!!busy} onClick={deploy}>
          {busy ? <Loader2 className="animate-spin" /> : <Rocket />} {busy ?? (dep.pendingUsdc ? "Deploy UpHealthSLA" : "Deploy to Base Sepolia")}
        </Button>
      );
    }

    return (
      <div className="space-y-4">
        {/* overflow-visible so the wallet dropdown is never clipped by the card */}
        <Panel role="region" aria-labelledby="live-console-h" className="overflow-visible">
          {consoleHeader}
          <PanelBody>
            <p className="max-w-2xl text-[14px] leading-[1.6] text-slate">{body}</p>
          </PanelBody>
          <PanelFooter hint={hint} className="rounded-b-[12px]">
            {forgetBtn}
            {action}
          </PanelFooter>
        </Panel>
        {txPanel}
      </div>
    );
  }

  // Ready: the step list is the main column; parameters, deployment and history sit beside it.
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Panel role="region" aria-labelledby="live-console-h" className="self-start">
        {consoleHeader}
        {ownCopyCallout}
        <ol className="divide-y divide-line">
          {steps.map((s) => (
            <li key={s.key} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-6">
              <span className={cn("inline-flex size-6 shrink-0 items-center justify-center rounded-full border", s.done ? "border-ink/50 text-ink" : "border-line text-dim")}>
                {s.done ? <CircleCheck className="size-4" /> : <span className="size-1.5 rounded-full bg-current" />}
              </span>
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-ink">{s.title}</div>
                <div className="mt-1 font-mono text-[12px] text-dim [overflow-wrap:anywhere] sm:truncate">{s.detail}</div>
              </div>
              {/* mobile: action drops under the text (column 2); sm+: right-hand column */}
              <div className="col-start-2 sm:col-start-3">{s.action}</div>
            </li>
          ))}
        </ol>
        {claimProof}
        <PanelFooter
          hint={
            busy ? (
              <span className="inline-flex items-center gap-2 text-ink">
                <Loader2 className="size-3.5 animate-spin" /> {busy}: confirm in your wallet, then wait for Base Sepolia…
              </span>
            ) : (
              <>
                Signing as <span className="font-mono text-ink">{shortHex(address!)}</span>. Each step sends one transaction.
              </>
            )
          }
        />
      </Panel>

      <div className="flex min-w-0 flex-col gap-4">
        <Panel>
          <PanelHeader title="Parameters" description="Values used by steps 2 to 7." />
          <PanelBody className="grid grid-cols-2 gap-4">
            <label className="col-span-2 block">
              <span className="mb-2 block text-[13px] font-medium text-slate">Service name</span>
              <input className={fieldClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-2 block text-[13px] font-medium text-slate">Price USDC</span>
              <input type="number" min="0" className={cn(fieldClass, "font-mono")} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-2 block text-[13px] font-medium text-slate">Reserve USDC</span>
              <input type="number" min="0" className={cn(fieldClass, "font-mono")} value={form.reserve} onChange={(e) => setForm({ ...form, reserve: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-2 block text-[13px] font-medium text-slate">SLA bps</span>
              <input type="number" min="9900" max="9999" className={cn(fieldClass, "font-mono")} value={form.sla} onChange={(e) => setForm({ ...form, sla: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-2 block text-[13px] font-medium text-slate">Active service id</span>
              <input type="number" min="1" className={cn(fieldClass, "font-mono")} value={serviceId} onChange={(e) => setServiceId(Math.max(1, Number(e.target.value) || 1))} />
            </label>
          </PanelBody>
          <PanelFooter
            hint={
              svc && svc.active
                ? `#${serviceId} ${svc.name} · ${formatUsdc(Number(svc.monthlyPriceUsdc))}/mo · SLA ${formatBps(svc.slaTargetBps)} · down ${svc.downtimeMinutes}m`
                : `Service #${serviceId} is not registered yet.`
            }
          />
        </Panel>

        <Panel>
          <PanelHeader
            title={fromEnv ? "Shared deployment" : "Your deployment"}
            description={fromEnv ? "Configured for this site." : "Deployed from this browser."}
          />
          <div className="divide-y divide-line">
            <a href={explorerAddress(dep.sla)} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-subtle sm:px-6">
              <span className="text-[13.5px] text-slate">UpHealthSLA</span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[13px] text-ink">
                {shortHex(dep.sla, 8, 6)} <ExternalLink className="size-3.5" />
              </span>
            </a>
            <a href={explorerAddress(dep.usdc)} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-subtle sm:px-6">
              <span className="text-[13.5px] text-slate">MockUSDC</span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[13px] text-ink">
                {shortHex(dep.usdc, 8, 6)} <ExternalLink className="size-3.5" />
              </span>
            </a>
          </div>
          {forgetBtn && <PanelFooter hint="Stored in this browser only.">{forgetBtn}</PanelFooter>}
          {/* attestor unknown (still loading, or an older contract without the role): offer the copy quietly */}
          {fromEnv && attestor === undefined && (
            <PanelFooter hint="Deploy a private copy to make your wallet the attestor.">
              <Button size="sm" variant="ghost" disabled={!!busy} onClick={deploy}>
                <Rocket /> {dep.pendingUsdc ? "Finish copy" : "Deploy a copy"}
              </Button>
            </PanelFooter>
          )}
        </Panel>

        {txPanel}
      </div>
    </div>
  );
}
