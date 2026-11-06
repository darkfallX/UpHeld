"use client";

import { Activity, CircleCheck, Hash, OctagonX, Play, Radar, Sigma, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BASE_SEPOLIA, computeAttestationHash, shortHex } from "@/lib/chain";
import {
  BILLING_WINDOW_MINUTES,
  calculateSubscriberRefundUsdc,
  evaluateSlaBreach,
  formatBps,
  formatMinutes,
  formatUsdc,
  SEVERITY_LABEL,
} from "@/lib/sla-engine";
import { runProbe } from "@/hooks/use-watchdog";
import { useUpHeld } from "@/lib/store";
import type { OutageIncident } from "@/lib/types";
import { cn } from "@/lib/utils";
import { NightShiftReport } from "../monitor/night-shift-report";
import { SourceBadge } from "../monitor/source-badge";
import { WatchdogPanel } from "../monitor/watchdog-panel";
import { ServiceMark } from "../telemetry/service-mark";
import { SeverityBadge, StatusBadge } from "../telemetry/status-badge";
import { UptimeStrip } from "../telemetry/uptime-strip";
import { Button } from "../ui/button";
import { fieldClass, PageShell, Panel, PanelBody, PanelFooter, PanelHeader, Section, Stat, StatGrid } from "../ui/card";

function ProbeConsole() {
  const services = useUpHeld((s) => s.services);
  const probes = useUpHeld((s) => s.probes);
  const record = useUpHeld((s) => s.recordProbe);
  const [url, setUrl] = useState<string>(BASE_SEPOLIA.rpcUrl);
  const [busy, setBusy] = useState(false);
  const [watching, setWatching] = useState(false);
  const watchRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const realTargets = useMemo(() => services.filter((s) => !s.synthetic && s.endpointUrl), [services]);
  const presets = useMemo(
    () => [
      { label: "Base Sepolia RPC", url: BASE_SEPOLIA.rpcUrl },
      { label: "BaseScan Sepolia", url: BASE_SEPOLIA.explorer },
      ...services.filter((s) => s.endpointUrl && s.endpointUrl !== BASE_SEPOLIA.rpcUrl).map((s) => ({ label: s.name, url: s.endpointUrl })),
    ],
    [services],
  );

  const probe = useCallback(
    async (target: string, serviceId?: string) => {
      setBusy(true);
      const r = await runProbe(target, serviceId);
      record(r);
      setBusy(false);
    },
    [record],
  );

  const sweep = useCallback(async () => {
    for (const s of realTargets) {
      record(await runProbe(s.endpointUrl, s.id));
    }
  }, [realTargets, record]);

  useEffect(() => {
    if (!watching) return;
    void sweep();
    watchRef.current = setInterval(() => void sweep(), 15_000);
    return () => {
      if (watchRef.current) clearInterval(watchRef.current);
    };
  }, [watching, sweep]);

  return (
    <Section
      id="probe"
      title="Endpoint probes"
      description="Send an HTTP request to one endpoint, or check all live endpoints every 15 seconds."
      actions={
        <Button size="sm" variant={watching ? "danger" : "outline"} onClick={() => setWatching((w) => !w)} disabled={!realTargets.length}>
          {watching ? <Square /> : <Radar />}
          {watching ? "Stop checks" : `Check ${realTargets.length} endpoint${realTargets.length === 1 ? "" : "s"} · 15s`}
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader kicker="GET /api/monitor/ping" title="Probe an endpoint" description="Choose a preset or enter an https URL." />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void probe(url.trim(), services.find((s) => s.endpointUrl === url.trim())?.id);
            }}
          >
            <PanelBody className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="probe-url" className="block text-[13px] font-medium text-ink">
                  Endpoint URL
                </label>
                <input
                  id="probe-url"
                  className={cn(fieldClass, "font-mono text-[13px]")}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://your-service.com/health"
                />
              </div>
              <div className="space-y-2">
                <div className="text-[13px] font-medium text-ink">Presets</div>
                <div className="flex flex-wrap gap-2">
                  {presets.map((p) => (
                    <button
                      key={p.url + p.label}
                      type="button"
                      onClick={() => setUrl(p.url)}
                      aria-pressed={url === p.url}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                        url === p.url ? "bg-ink text-ink-inverse" : "bg-panel text-slate shadow-card hover:bg-raised hover:text-ink",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </PanelBody>
            <PanelFooter
              hint={
                <>
                  Streamly and CloudBox run on sample <span className="font-mono">.demo</span> hosts, so their checks are simulated. HyperNode RPC and any public https
                  endpoint registered by a provider receive real requests.
                </>
              }
            >
              <Button type="submit" variant="primary" disabled={busy}>
                <Play /> {busy ? "Probing…" : "Probe now"}
              </Button>
            </PanelFooter>
          </form>
        </Panel>

        <Panel className="flex flex-col">
          <PanelHeader
            title={
              <span className="flex items-center gap-2">
                <Activity className="size-4 text-slate" /> Probe log
              </span>
            }
            description="Status and latency for every probe in this session."
            right={<span className="font-mono text-[12px] tabular text-dim">{probes.length}</span>}
          />
          <ol className="scroll-thin max-h-[360px] flex-1 overflow-y-auto font-mono text-[12px]" aria-label="Probe results">
            {probes.length === 0 && <li className="px-5 py-8 text-center text-dim sm:px-6">No probes yet. Select Probe now to send a request.</li>}
            {probes.map((p) => (
              <li key={p.id} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-4 border-b border-line/60 px-5 py-2.5 last:border-0 sm:px-6">
                <span className="text-dim">{new Date(p.at).toLocaleTimeString([], { hour12: false })}</span>
                <span className="truncate text-slate" title={p.url}>
                  {p.url.replace(/^https?:\/\//, "")}
                  {p.error && <span className="text-dim"> · {p.error}</span>}
                </span>
                <span className={cn("inline-flex items-center gap-1.5", p.ok ? "text-ink" : p.statusText === "SYNTHETIC_ENDPOINT" ? "text-dim" : "text-down")}>
                  {p.ok ? <CircleCheck className="size-3.5" /> : <OctagonX className="size-3.5" />}
                  {p.status ?? p.statusText} {p.latencyMs > 0 && `· ${p.latencyMs}ms`}
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </Section>
  );
}

function UptimeMath() {
  const services = useUpHeld((s) => s.services);
  const [id, setId] = useState("svc_cloudbox");
  const svc = services.find((s) => s.id === id) ?? services[0];
  if (!svc) return null;
  const D = svc.totalDowntimeMinutes;
  const raw = ((BILLING_WINDOW_MINUTES - D) / BILLING_WINDOW_MINUTES) * 10000;
  const ev = evaluateSlaBreach(svc.currentUptimeBps, svc.slaTargetBps, svc.compensationTiers);
  const refund = calculateSubscriberRefundUsdc(svc.monthlyPriceUsdc, ev.refundBps);
  return (
    <Section
      id="math"
      title="SLA breach calculator"
      description="Converts recorded downtime into uptime in basis points, then into a refund tier and a USDC amount."
      actions={
        <>
          <label htmlFor="math-service" className="text-[13px] text-slate">
            Service
          </label>
          <select id="math-service" className={cn(fieldClass, "h-9 w-auto min-w-[180px]")} value={svc.id} onChange={(e) => setId(e.target.value)}>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </>
      }
    >
      <Panel>
        <PanelHeader
          title={
            <span className="flex items-center gap-2">
              <Sigma className="size-4 text-slate" /> Calculation for {svc.name}
            </span>
          }
          description="Based on downtime recorded in the current 30-day billing window."
          right={<span className={cn("text-[13px] font-medium", ev.breached ? "text-down" : "text-ink")}>{ev.breached ? "Breached" : "Within SLA"}</span>}
        />
        <PanelBody className="space-y-6">
          <div className="space-y-2.5">
            <div className="text-[13px] font-medium text-ink">Formula</div>
            <div className="font-mono text-[13px] leading-relaxed text-slate">uptimeBps = floor((43200 − downtime) / 43200 × 10000)</div>
            <div className="break-words rounded-[8px] bg-subtle px-4 py-3.5 font-mono text-[13px] leading-relaxed text-ink">
              floor((43200 − <span className="text-warn">{D}</span>) / 43200 × 10000) = floor({raw.toFixed(4)}) ={" "}
              <span className={ev.breached ? "text-down" : "text-ink"}>
                {svc.currentUptimeBps} bps ({formatBps(svc.currentUptimeBps)})
              </span>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[10px] border border-line px-4 py-3.5">
              <div className="text-[12px] text-dim">SLA check</div>
              <div className="mt-1.5 font-mono text-[13px] text-ink">
                {svc.currentUptimeBps} {ev.breached ? "<" : "≥"} {svc.slaTargetBps} → {ev.breached ? "BREACHED" : "OK"}
              </div>
            </div>
            <div className="rounded-[10px] border border-line px-4 py-3.5">
              <div className="text-[12px] text-dim">Tier</div>
              <div className="mt-1.5 font-mono text-[13px] text-ink">
                {SEVERITY_LABEL[ev.severity]} · {ev.refundBps} bps
              </div>
            </div>
            <div className="rounded-[10px] border border-line px-4 py-3.5 md:col-span-2">
              <div className="text-[12px] text-dim">Refund per subscriber at current uptime</div>
              <div className="mt-1.5 break-words font-mono text-[13px] text-slate">
                ({svc.monthlyPriceUsdc.toLocaleString("en-US")} × {ev.refundBps}) / 10000 = <span className="text-ink">{refund.toLocaleString("en-US")}</span> minor units ={" "}
                <span className="text-ink">{formatUsdc(refund)} USDC</span>
              </div>
            </div>
          </div>
        </PanelBody>
        <PanelFooter
          hint={
            <>
              Tier thresholds: Tier 1 below {formatBps(svc.slaTargetBps)} · Tier 2 below 99.00% · Tier 3 below 98.00%. Downtime budget:{" "}
              {((43200 * (10000 - svc.slaTargetBps)) / 10000).toFixed(1)} min.
            </>
          }
        />
      </Panel>
    </Section>
  );
}

function HashVerify({ incident, onChainId }: { incident: OutageIncident; onChainId: number }) {
  const [result, setResult] = useState<boolean | null>(null);
  return (
    <button
      type="button"
      onClick={() => setResult(computeAttestationHash(onChainId, incident.seq, incident.downtimeMinutes, incident.newUptimeBps) === incident.attestationHash)}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[12px] transition-colors",
        result === null ? "border-line text-slate hover:text-ink" : result ? "border-ink/40 text-ink" : "border-down/40 text-down",
      )}
      title="Recompute keccak256(abi.encodePacked(serviceId, incidentSeq, downtimeMinutes, uptimeBps))"
    >
      <Hash className="size-3" />
      {result === null ? "Verify" : result ? "Match" : "Mismatch"}
    </button>
  );
}

export function MonitorDashboard() {
  const services = useUpHeld((s) => s.services);
  const incidents = useUpHeld((s) => s.incidents);
  const totalDown = services.reduce((a, s) => a + s.totalDowntimeMinutes, 0);
  const breaches = incidents.filter((i) => i.slaBreached).length;
  const autoCount = incidents.filter((i) => i.source === "watchdog").length;

  return (
    <PageShell
      kicker="Monitoring"
      title="Uptime and incidents"
      description="Health checks, uptime calculations and outage records for every service."
    >
      <StatGrid>
        <Stat label="Services monitored" value={String(services.length)} />
        <Stat label="Incidents recorded" value={String(incidents.length)} sub={`${autoCount} automatic · ${incidents.length - autoCount} manual`} />
        <Stat label="SLA breaches" value={String(breaches)} />
        <Stat label="Downtime this window" value={formatMinutes(totalDown)} />
      </StatGrid>

      <WatchdogPanel />

      <Section id="status" title="Service availability" description="Check history and current uptime against each SLA target.">
        {/* overflow-visible: the UptimeStrip hover tooltip renders above the bars and must not be clipped */}
        <Panel className="overflow-visible">
          <ul className="divide-y divide-line">
            {services.map((s) => (
              <li key={s.id} className="grid items-center gap-4 px-5 py-4 sm:px-6 md:grid-cols-[240px_minmax(0,1fr)_170px] md:gap-6">
                <div className="flex min-w-0 items-center gap-3">
                  <ServiceMark category={s.category} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium text-ink">{s.name}</div>
                    <div className="mt-0.5 truncate font-mono text-[12px] text-dim">
                      {s.endpointUrl.replace(/^https?:\/\//, "") || "no endpoint"}
                      {s.synthetic ? " · simulated" : " · live"}
                    </div>
                  </div>
                </div>
                <UptimeStrip bars={s.heartbeatHistory} height={24} />
                <div className="flex items-center justify-between gap-2 md:flex-col md:items-end md:gap-1.5">
                  <StatusBadge status={s.status} />
                  <span className={cn("font-mono text-[13px] tabular", s.currentUptimeBps < s.slaTargetBps ? "text-down" : "text-ink")}>
                    {formatBps(s.currentUptimeBps)} <span className="text-dim">/ {formatBps(s.slaTargetBps)}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </Section>

      <NightShiftReport />

      <ProbeConsole />

      <UptimeMath />

      <Section
        id="inc"
        title="Incident log"
        description={
          <>
            Each incident is hashed as <span className="break-all font-mono text-[13px]">keccak256(serviceId, incidentId, downtimeMinutes, resultingUptimeBps)</span>.
            Select Verify to recompute the hash in your browser. Auto incidents come from the watchdog and Manual incidents from the Chaos Theater.
          </>
        }
      >
        <Panel>
          <div className="scroll-thin relative overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-[14px]">
              <thead className="bg-subtle text-[12px] text-dim">
                <tr className="border-b border-line">
                  <th className="px-6 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Service · incident</th>
                  <th className="px-4 py-3 text-right font-medium">Downtime</th>
                  <th className="px-4 py-3 text-right font-medium">Uptime</th>
                  <th className="px-4 py-3 font-medium">Tier</th>
                  <th className="px-4 py-3 text-right font-medium">Payout</th>
                  <th className="px-6 py-3 font-medium">Attestation hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {incidents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-[14px] text-dim">
                      No incidents yet. Start the watchdog, or record an outage in the Chaos Theater.
                    </td>
                  </tr>
                )}
                {incidents.map((i) => {
                  const s = services.find((x) => x.id === i.serviceId);
                  return (
                    <tr key={i.id} className="align-top">
                      <td className="px-6 py-3.5 font-mono text-[13px] text-dim">{i.seq}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-ink">{s?.name}</span>
                          <SourceBadge source={i.source} />
                        </div>
                        <div className="mt-0.5 text-[13px] text-slate">
                          {i.title} · {new Date(i.createdAt).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-[13px]">
                        {i.downtimeMinutes}m<div className="mt-0.5 text-[12px] text-dim">Σ {i.totalDowntimeAfter}m</div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-[13px]">
                        {formatBps(i.previousUptimeBps)} → <span className={i.slaBreached ? "text-down" : "text-ink"}>{formatBps(i.newUptimeBps)}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <SeverityBadge severity={i.severity} />
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-[13px]">
                        {formatUsdc(i.totalCompensationTriggeredUsdc)}
                        <div className="mt-0.5 text-[12px] text-dim">
                          {i.subscribersCompensated} sub · {i.refundPercentageBps / 100}%
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-[12px] text-slate" title={i.attestationHash}>
                            {shortHex(i.attestationHash, 10, 8)}
                          </span>
                          <HashVerify incident={i} onChainId={s?.onChainId ?? 0} />
                        </div>
                        <div className="mt-1 font-mono text-[12px] text-dim">
                          tx {shortHex(i.txHash, 8, 6)} · #{i.blockNumber.toLocaleString("en-US")}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </Section>
    </PageShell>
  );
}
