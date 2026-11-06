"use client";

import { ArrowDown, BadgeCheck, Check, Coins, Copy, ExternalLink, FileCode2, FileSearch, Gavel, Radar, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { BASE_MAINNET, BASE_SEPOLIA, JUDGE_WALLET, MONITOR_ATTESTOR, PROVIDER_TREASURY, SANDBOX_SLA_ADDRESS, SANDBOX_USDC_ADDRESS, explorerAddress, explorerTx, shortHex } from "@/lib/chain";
import { SOLC_VERSION, contractSources, mockUsdcAbi, upHealthSlaAbi } from "@/lib/contracts";
import { formatUsdc } from "@/lib/sla-engine";
import { ENV_PROOF } from "@/lib/live-deployment";
import { contractUsdcHoldings, useUpHeld } from "@/lib/store";
import { useActions } from "@/hooks/use-actions";
import { cn } from "@/lib/utils";
import { NumberTicker } from "../magicui/number-ticker";
import { Button, buttonVariants } from "../ui/button";
import { PageShell, Panel, PanelBody, PanelFooter, PanelHeader, Section, Stat, StatGrid } from "../ui/card";
import { LiveConsole } from "./live-console";

type AbiItem = { type: string; name?: string; stateMutability?: string; inputs?: readonly { name: string; type: string; indexed?: boolean }[]; outputs?: readonly { name: string; type: string }[] };

function highlight(src: string) {
  // tiny, dependency-free Solidity highlighter (keywords / types / comments / numbers)
  const esc = src.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc
    .split("\n")
    .map((line) => {
      const ci = line.indexOf("//");
      const code = ci >= 0 ? line.slice(0, ci) : line;
      const comment = ci >= 0 ? line.slice(ci) : "";
      const c = code
        .replace(/\b(\d[\d_]*(?:e\d+)?)\b/g, '<span class="text-slate">$1</span>')
        .replace(/\b(pragma|solidity|contract|interface|function|event|struct|mapping|returns|return|require|emit|if|else|for|external|public|view|immutable|constant|storage|calldata|memory|constructor|indexed)\b/g, '<span class="text-ink">$1</span>')
        .replace(/\b(uint256|uint16|uint8|address|bool|string|bytes32|IERC20)\b/g, '<span class="text-slate">$1</span>');
      return c + (comment ? `<span class="text-dim">${comment}</span>` : "");
    })
    .join("\n");
}

function sig(i: AbiItem) {
  return `${i.name}(${(i.inputs ?? []).map((x) => `${x.type}${x.indexed ? " indexed" : ""} ${x.name}`.trim()).join(", ")})`;
}

/** Small pill tab used for the file and ABI switchers. */
function TabPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[12px] transition-colors",
        active ? "bg-raised text-ink shadow-card" : "text-slate hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/** Function name shown next to the rule it refers to. */
function Fn({ children }: { children: React.ReactNode }) {
  return <code className="rounded-[5px] bg-subtle px-1.5 py-0.5 font-mono text-[11.5px] text-slate">{children}</code>;
}

type TrustPoint = { text: React.ReactNode; fns: string[] };

const TRUST_COLUMNS: { key: string; icon: typeof Gavel; title: string; description: string; points: TrustPoint[] }[] = [
  {
    key: "who",
    icon: Gavel,
    title: "Who records outages",
    description: "An attestation is a signed record of how many minutes a service was down, identified by a unique hash.",
    points: [
      { text: "Only approved attestors can record an outage. Providers and subscribers cannot.", fns: ["recordOutage", "isAttestor"] },
      { text: "The wallet that deploys the contract is the first attestor. The owner can add or remove others.", fns: ["setAttestor"] },
      { text: "Transferring ownership moves the attestor role to the new owner and removes it from the old one.", fns: ["transferOwnership"] },
      { text: "In the Judge Sandbox, a simulated monitor address records outages in your browser.", fns: ["MONITOR_ATTESTOR"] },
    ],
  },
  {
    key: "guarantees",
    icon: ShieldCheck,
    title: "Contract rules",
    description: "Enforced in Solidity. Transactions that break a rule revert.",
    points: [
      { text: "Each subscriber receives the refund for the highest tier reached. A tier is paid once, and subscribers who join during an outage start at the current tier.", fns: ["recordOutage"] },
      { text: "Subscribing locks the maximum refund for that seat from the provider\u2019s reserve. When the reserve cannot cover another seat, the plan shows \u201cSold out\u201d.", fns: ["subscribe", "availableReserve", "seatCoverRequired"] },
      { text: "Zero-minute outages and reused attestation hashes are rejected.", fns: ["recordOutage"] },
      { text: "Subscribers withdraw refunds themselves. The balance is set to zero before the transfer.", fns: ["claimCompensation", "claimableCompensation"] },
      { text: "Live mode approves the exact USDC amount each step needs.", fns: ["approve"] },
    ],
  },
  {
    key: "real",
    icon: Radar,
    title: "Production roadmap",
    description: "Planned work. This testnet build uses trusted attestors.",
    points: [
      { text: "Independent probes in several regions, with a quorum of attestors required to record an outage.", fns: ["setAttestor"] },
      { text: "A rolling 30-day uptime window. Downtime currently accumulates for the life of a deployment.", fns: ["downtimeMinutes"] },
      { text: "A notice period on reserve withdrawals, so providers cannot remove cover shortly before an outage.", fns: ["fundReserve"] },
      { text: "An external security audit before mainnet. Seat cover released when a plan ends.", fns: ["UpHealthSLA.sol"] },
    ],
  },
];

/** Deployment proof rows, built from NEXT_PUBLIC_* env values that passed format checks. */
function proofRows() {
  const rows: { key: string; label: string; what: string; value: string; href: string }[] = [];
  if (ENV_PROOF.sla) rows.push({ key: "sla", label: "Verified source", what: "UpHealthSLA", value: ENV_PROOF.sla, href: `${explorerAddress(ENV_PROOF.sla)}#code` });
  if (ENV_PROOF.usdc) rows.push({ key: "usdc", label: "Verified source", what: "MockUSDC", value: ENV_PROOF.usdc, href: `${explorerAddress(ENV_PROOF.usdc)}#code` });
  if (ENV_PROOF.outageTx) rows.push({ key: "outage", label: "Outage transaction", what: "recordOutage", value: ENV_PROOF.outageTx, href: explorerTx(ENV_PROOF.outageTx) });
  if (ENV_PROOF.claimTx) rows.push({ key: "claim", label: "Claim transaction", what: "claimCompensation", value: ENV_PROOF.claimTx, href: explorerTx(ENV_PROOF.claimTx) });
  return rows;
}

export function ContractsExplorer() {
  const [file, setFile] = useState<keyof typeof contractSources>("UpHealthSLA.sol");
  const [abiTab, setAbiTab] = useState<"UpHealthSLA" | "MockUSDC">("UpHealthSLA");
  const [copied, setCopied] = useState(false);
  const services = useUpHeld((s) => s.services);
  const subs = useUpHeld((s) => s.subscriptions);
  const balances = useUpHeld((s) => s.balances);
  const holdings = useUpHeld((s) => contractUsdcHoldings(s));
  const { mint } = useActions();

  const abi = (abiTab === "UpHealthSLA" ? upHealthSlaAbi : mockUsdcAbi) as readonly AbiItem[];
  const fns = abi.filter((x) => x.type === "function");
  const events = abi.filter((x) => x.type === "event");
  const html = useMemo(() => highlight(contractSources[file]), [file]);

  const reserves = services.reduce((a, s) => a + s.reserveBalanceUsdc, 0);
  const claimable = subs.reduce((a, s) => a + s.accruedCompensationUsdc, 0);
  const solc = SOLC_VERSION.split("+")[0];
  const proof = proofRows();

  const addresses: [string, string][] = [
    ["Network", `${BASE_SEPOLIA.name} · chainId ${BASE_SEPOLIA.chainId} (${BASE_SEPOLIA.chainIdHex})`],
    ["RPC", BASE_SEPOLIA.rpcUrl],
    ["Explorer", BASE_SEPOLIA.explorer.replace("https://", "")],
    ["Circle USDC (Sepolia)", shortHex(BASE_SEPOLIA.circleUsdc, 10, 6)],
    ["UpHealthSLA · sandbox mirror", shortHex(SANDBOX_SLA_ADDRESS, 10, 6)],
    ["MockUSDC · sandbox mirror", shortHex(SANDBOX_USDC_ADDRESS, 10, 6)],
    ["Judge Sandbox wallet", shortHex(JUDGE_WALLET, 10, 6)],
    ["Base mainnet USDC", shortHex(BASE_MAINNET.circleUsdc, 10, 6)],
  ];

  return (
    <PageShell
      kicker="Contracts"
      title="Smart contracts and faucet"
      description={
        <>
          UpHeld uses two contracts: <span className="font-mono text-ink">MockUSDC</span>, a 6-decimal testnet USDC with a public faucet, and{" "}
          <span className="font-mono text-ink">UpHealthSLA</span>, which handles subscriptions, reserves, outage records and payouts. Compiled with solc {solc}.
        </>
      }
      actions={
        <>
          <a href="#live" className={buttonVariants({ variant: "outline" })}>
            Live console <ArrowDown />
          </a>
          <a href="#trust" className={buttonVariants({ variant: "ghost" })}>
            <ShieldCheck /> Trust model
          </a>
          <a href="#source" className={buttonVariants({ variant: "ghost" })}>
            <FileCode2 /> Source & ABI
          </a>
        </>
      }
    >
      {/* 1. Deployments and faucet */}
      <Section title="Deployments & faucet" description="Contract addresses and a testnet USDC faucet for the Judge Sandbox wallet.">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Panel>
            <PanelHeader title="Network & addresses" description="Base Sepolia endpoints and the addresses the app uses." />
            <dl className="divide-y divide-line">
              {addresses.map(([k, v]) => (
                <div key={k} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
                  <dt className="shrink-0 text-[13.5px] text-slate">{k}</dt>
                  <dd className="min-w-0 truncate font-mono text-[13px] text-ink sm:text-right">{v}</dd>
                </div>
              ))}
            </dl>
            <PanelFooter
              hint={
                <>
                  Sandbox mirror addresses are fixed labels for the in-browser contract mirror. No private key exists for them.{" "}
                  <a href={explorerAddress(BASE_SEPOLIA.circleUsdc)} target="_blank" rel="noreferrer" className="text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
                    Circle USDC on BaseScan
                  </a>
                  .
                </>
              }
            />
          </Panel>

          <Panel className="flex flex-col">
            <PanelHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Coins className="size-4 text-slate" /> Sandbox faucet
                </span>
              }
              description="Mint MockUSDC to the Judge Sandbox wallet."
            />
            <PanelBody className="flex flex-1 flex-col justify-center">
              <div className="text-[13px] font-medium text-slate">Judge wallet balance</div>
              <NumberTicker value={balances[JUDGE_WALLET] ?? 0} format={(v) => formatUsdc(Math.round(v))} className="mt-3 block text-[36px] font-medium leading-none tracking-[-0.05em]" />
              <div className="mt-3 truncate font-mono text-[12px] text-dim">{shortHex(JUDGE_WALLET, 10, 6)}</div>
            </PanelBody>
            <PanelFooter hint="Sandbox balance. No wallet required.">
              <Button variant="outline" onClick={() => mint(1_000_000_000)}>Mint 1,000</Button>
              <Button variant="primary" onClick={() => mint(100_000_000)}>Mint 100</Button>
            </PanelFooter>
          </Panel>
        </div>
      </Section>

      {/* 1b. Public deployment proof (env-driven) */}
      <Section
        id="proof"
        className="scroll-mt-28"
        title="Deployment proof"
        description="Verified contracts and transactions on BaseScan, the block explorer for Base."
      >
        <Panel>
          <PanelHeader
            title={
              <span className="inline-flex items-center gap-2">
                <BadgeCheck className="size-4 text-slate" /> On BaseScan
              </span>
            }
            description={proof.length ? "Links open on BaseScan in a new tab." : "Not configured for this site."}
          />
          {proof.length ? (
            <ul className="divide-y divide-line">
              {proof.map((row) => (
                <li key={row.key}>
                  <a
                    href={row.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col gap-1 px-5 py-3.5 transition-colors hover:bg-subtle sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6"
                  >
                    <span className="min-w-0 text-[13.5px] text-slate">
                      <span className="text-ink">{row.label}</span> <span className="font-mono text-[12px] text-dim">· {row.what}</span>
                    </span>
                    <span className="inline-flex min-w-0 items-center gap-1.5 font-mono text-[13px] text-ink">
                      <span className="truncate">{shortHex(row.value, 10, 8)}</span> <ExternalLink className="size-3.5 shrink-0" />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <PanelBody className="flex items-start gap-3">
              <FileSearch className="mt-0.5 size-4 shrink-0 text-dim" />
              <p className="text-[14px] leading-[1.6] text-slate">
                No public deployment yet. Deploy your own copy from your wallet in the{" "}
                <a href="#live" className="text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
                  live console
                </a>{" "}
                below.
              </p>
            </PanelBody>
          )}
          <PanelFooter
            hint={
              <>
                Set by <span className="font-mono">NEXT_PUBLIC_UPHELD_SLA_ADDRESS</span>, <span className="font-mono">NEXT_PUBLIC_MOCK_USDC_ADDRESS</span>,{" "}
                <span className="font-mono">NEXT_PUBLIC_PROOF_OUTAGE_TX</span> and <span className="font-mono">NEXT_PUBLIC_PROOF_CLAIM_TX</span>. Malformed values are ignored. If
                BaseScan shows no source, run <span className="font-mono">npm run verify:input</span>.
              </>
            }
          />
        </Panel>
      </Section>

      {/* 2. Escrow reserves */}
      <Section title="Escrow reserves" description="USDC held by UpHealthSLA, split between provider reserves and claimable compensation.">
        <div className="space-y-6">
          <StatGrid className="lg:grid-cols-3">
            <Stat label="Provider reserves" value={formatUsdc(reserves)} sub="Locked by providers to back their SLA." />
            <Stat label="Claimable compensation" value={formatUsdc(claimable)} sub="Owed to subscribers after outages." />
            <Stat
              label="USDC held by UpHealthSLA"
              value={formatUsdc(holdings)}
              sub={
                <span className="inline-flex items-center gap-1.5 text-ink">
                  <Check className="size-3.5" /> Reserves + claimable = holdings
                </span>
              }
              className="bg-raised ring-1 ring-ink/25 sm:col-span-2 lg:col-span-1"
            />
          </StatGrid>

          <Panel>
            <PanelHeader title="Reserves by service" description="Mirror of the on-chain services(id) struct for each registered plan." />
            <div className="scroll-thin relative overflow-x-auto">
              <table className="w-full min-w-[640px] font-mono text-[13px]">
                <thead className="text-[12px] text-dim">
                  <tr className="border-b border-line text-left">
                    <th className="px-5 py-3 font-medium sm:px-6">services(id)</th>
                    <th className="px-5 py-3 text-right font-medium sm:px-6">reserveBalanceUsdc</th>
                    <th className="px-5 py-3 text-right font-medium sm:px-6">downtimeMinutes</th>
                    <th className="px-5 py-3 text-right font-medium sm:px-6">currentUptimeBps</th>
                    <th className="px-5 py-3 text-right font-medium sm:px-6">provider</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {services.map((s) => (
                    <tr key={s.id}>
                      <td className="px-5 py-3.5 text-ink sm:px-6">#{s.onChainId} {s.name}</td>
                      <td className="px-5 py-3.5 text-right sm:px-6">{s.reserveBalanceUsdc.toLocaleString("en-US")}</td>
                      <td className="px-5 py-3.5 text-right sm:px-6">{s.totalDowntimeMinutes}</td>
                      <td className="px-5 py-3.5 text-right sm:px-6">{s.currentUptimeBps}</td>
                      <td className="px-5 py-3.5 text-right text-dim sm:px-6">{s.providerAddress === PROVIDER_TREASURY ? "treasury" : shortHex(s.providerAddress)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </Section>

      {/* 2b. Trust model */}
      <Section
        id="trust"
        className="scroll-mt-28"
        title="Trust model"
        description="Who can record outages, the rules the contract enforces, and planned production changes."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {TRUST_COLUMNS.map((col) => (
            <Panel key={col.key} className="flex flex-col">
              <PanelHeader
                title={
                  <span className="inline-flex items-center gap-2">
                    <col.icon className="size-4 text-slate" /> {col.title}
                  </span>
                }
                description={col.description}
              />
              <ul className="flex-1 divide-y divide-line">
                {col.points.map((pt, i) => (
                  <li key={i} className="px-5 py-3.5 sm:px-6">
                    <p className="text-[13.5px] leading-[1.55] text-ink">{pt.text}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {pt.fns.map((f) => (
                        <Fn key={f}>{f === "MONITOR_ATTESTOR" ? shortHex(MONITOR_ATTESTOR) : f}</Fn>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      </Section>

      {/* 3. Live console */}
      <Section
        id="live"
        className="scroll-mt-28"
        title="Live on Base Sepolia"
        description="Deploy both contracts from your wallet and call each function."
      >
        <LiveConsole />
      </Section>

      {/* 4. Source and ABI */}
      <Section id="source" className="scroll-mt-28" title="Source & ABI" description={`Solidity source compiled with solc ${solc}, and the functions and events in each ABI.`}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Panel role="region" aria-label="Contract source" className="flex flex-col">
            <PanelHeader
              title="Contract source"
              description={<span className="font-mono text-[13px]">contracts/{file}</span>}
              right={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard?.writeText(contractSources[file]);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy source"}
                </Button>
              }
            />
            <div className="border-b border-line bg-subtle px-5 py-3 sm:px-6">
              <div className="scroll-thin relative flex min-w-0 max-w-full gap-2 overflow-x-auto" role="tablist" aria-label="Source files">
                {(Object.keys(contractSources) as (keyof typeof contractSources)[]).map((f) => (
                  <TabPill key={f} active={file === f} onClick={() => setFile(f)}>
                    <FileCode2 className="size-3.5" /> {f}
                  </TabPill>
                ))}
              </div>
            </div>
            <pre className="scroll-thin max-h-[680px] flex-1 overflow-auto px-5 py-5 font-mono text-[12.5px] leading-relaxed text-slate sm:px-6 sm:py-6">
              <code dangerouslySetInnerHTML={{ __html: html }} />
            </pre>
          </Panel>

          <Panel role="region" aria-label="ABI explorer" className="flex flex-col">
            <PanelHeader title="ABI explorer" description={`${fns.length} functions · ${events.length} events`} />
            <div className="border-b border-line bg-subtle px-5 py-3 sm:px-6">
              <div className="flex gap-2" role="tablist" aria-label="Contract ABI">
                {(["UpHealthSLA", "MockUSDC"] as const).map((t) => (
                  <TabPill key={t} active={abiTab === t} onClick={() => setAbiTab(t)}>
                    {t}
                  </TabPill>
                ))}
              </div>
            </div>
            <div className="scroll-thin max-h-[680px] flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              <div>
                <div className="text-[13px] font-medium text-slate">Functions · {fns.length}</div>
                <ul className="mt-3 space-y-2">
                  {fns.map((f) => (
                    <li key={sig(f)} className="rounded-[8px] border border-line px-3.5 py-3 font-mono text-[12px]">
                      <div className="flex items-start justify-between gap-3">
                        <span className="break-all text-ink">{sig(f)}</span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[11px]",
                            f.stateMutability === "view" || f.stateMutability === "pure" ? "bg-ink/10 text-slate" : "border border-ink/30 text-ink",
                          )}
                        >
                          {f.stateMutability}
                        </span>
                      </div>
                      {f.outputs && f.outputs.length > 0 && <div className="mt-1.5 text-dim">→ {f.outputs.map((o) => o.type).join(", ")}</div>}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[13px] font-medium text-slate">Events · {events.length}</div>
                <ul className="mt-3 space-y-2">
                  {events.map((e) => (
                    <li key={sig(e)} className="break-all rounded-[8px] border border-line px-3.5 py-3 font-mono text-[12px] text-warn/90">
                      {sig(e)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Panel>
        </div>
      </Section>
    </PageShell>
  );
}
