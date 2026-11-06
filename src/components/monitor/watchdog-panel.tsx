"use client";

import { CircleCheck, CircleDashed, OctagonX, Plug, Power, PowerOff, Radar, ShieldAlert, Unplug } from "lucide-react";
import Link from "next/link";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { WATCHDOG_POLICY, useWatchdog, type WatchState } from "@/hooks/use-watchdog";
import { formatMinutes } from "@/lib/sla-engine";
import { useUpHeld } from "@/lib/store";
import type { ServicePlan } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ServiceMark } from "../telemetry/service-mark";
import { Button } from "../ui/button";
import { Panel, PanelFooter, PanelHeader, Section } from "../ui/card";

const POLICY = [
  { k: `Every ${WATCHDOG_POLICY.intervalMs / 1000}s`, v: "Each service is checked once." },
  { k: `1 failed check = ${WATCHDOG_POLICY.minutesPerCheck} min`, v: "Demo timing. Production checks run every 5 minutes." },
  {
    k: `${WATCHDOG_POLICY.failuresToAttest} in a row → record`,
    v: `Records ${WATCHDOG_POLICY.failuresToAttest * WATCHDOG_POLICY.minutesPerCheck} min, then again after every ${WATCHDOG_POLICY.failuresToAttest} failed checks.`,
  },
  { k: "Recovery → close", v: "Records any remaining failed checks and closes the incident." },
];

function FailurePips({ count, open }: { count: number; open: boolean }) {
  const need = WATCHDOG_POLICY.failuresToAttest;
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${count} of ${need} failed checks before the next record`}>
      {Array.from({ length: need }, (_, i) => (
        <span
          key={i}
          className={cn(
            "size-2.5 rounded-[3px] transition-colors duration-300",
            i < count ? (open ? "bg-down" : "bg-warn") : "bg-subtle shadow-[inset_0_0_0_1px_var(--line)]",
          )}
        />
      ))}
    </span>
  );
}

function ServiceRow({
  svc,
  w,
  enabled,
  unplugged,
  onTogglePlug,
}: {
  svc: ServicePlan;
  w: WatchState | undefined;
  enabled: boolean;
  unplugged: boolean;
  onTogglePlug: () => void;
}) {
  const open = !!w?.incidentOpen;
  const idle = !enabled || !w || (w.lastOk === null && !w.lastInconclusive);
  const unsure = !idle && !open && !!w?.lastInconclusive;
  const state = !enabled
    ? "Off"
    : !w || (w.lastOk === null && !w.lastInconclusive)
      ? "Waiting for first check"
      : open
        ? "Incident open"
        : w.lastInconclusive
          ? "Can't check"
          : w.lastOk
            ? "Healthy"
            : "Failing";
  return (
    <li className="grid gap-4 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] lg:items-center lg:gap-6">
      <div className="flex min-w-0 items-center gap-3">
        <ServiceMark category={svc.category} size="sm" />
        <div className="min-w-0">
          <div className="truncate text-[14px] font-medium text-ink">{svc.name}</div>
          <div className="mt-0.5 truncate text-[12px] text-dim">
            {svc.synthetic ? "Simulated host" : "Real HTTP check"} ·{" "}
            <span className="font-mono">{(svc.endpointUrl || `${svc.slug}.demo`).replace(/^https?:\/\//, "")}</span>
          </div>
        </div>
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 font-medium",
              idle || unsure ? "text-dim" : open || !w?.lastOk ? "text-down" : "text-ink",
            )}
          >
            {idle || unsure ? (
              <CircleDashed className="size-3.5" aria-hidden />
            ) : open ? (
              <ShieldAlert className="size-3.5" aria-hidden />
            ) : w?.lastOk ? (
              <CircleCheck className="size-3.5" aria-hidden />
            ) : (
              <OctagonX className="size-3.5" aria-hidden />
            )}
            {state}
          </span>
          {w?.lastLabel && w.lastCheckAt && (
            <span className="font-mono text-[12px] text-slate">
              Last: {w.lastLabel} · {new Date(w.lastCheckAt).toLocaleTimeString([], { hour12: false })}
            </span>
          )}
          <span className="inline-flex items-center gap-2 text-[12px] text-slate">
            <FailurePips count={w?.unattestedFailures ?? 0} open={open} />
            {w?.consecutiveFailures ?? 0} failed in a row
          </span>
          {w && w.attestations > 0 && (
            <span className="font-mono text-[12px] text-ink">
              {formatMinutes(w.minutesAttested)} recorded{open ? " so far" : ""} · {w.attestations}×
            </span>
          )}
        </div>
        <p className="min-w-0 break-words text-[12px] leading-[1.5] text-dim">
          {enabled ? (w?.lastEvent ?? "Checking…") : svc.synthetic ? "Simulated host. Use Simulate outage to fail its checks." : "Checked over HTTP while the watchdog runs."}
        </p>
      </div>

      <div className="flex items-center lg:justify-end">
        {svc.synthetic ? (
          <Button size="sm" variant={unplugged ? "danger" : "outline"} onClick={onTogglePlug} aria-pressed={unplugged}>
            {unplugged ? <Plug /> : <Unplug />}
            {unplugged ? "Restore" : "Simulate outage"}
          </Button>
        ) : (
          <span className="text-[12px] text-dim">Real endpoint</span>
        )}
      </div>
    </li>
  );
}

export function WatchdogPanel() {
  const services = useUpHeld((s) => s.services);
  const { enabled, toggle, unplugged, togglePlug, watch } = useWatchdog();
  const reduced = useReducedMotion();
  const openCount = Object.values(watch).filter((w) => w.incidentOpen).length;
  const autoCount = useUpHeld((s) => s.incidents.filter((i) => i.source === "watchdog").length);

  return (
    <Section
      id="watchdog"
      title="Watchdog"
      description={`Checks every service on a fixed interval. After ${WATCHDOG_POLICY.failuresToAttest} failed checks in a row, it records the outage. If the SLA is breached, subscriber refunds become claimable.`}
      actions={
        <Button variant={enabled ? "danger" : "primary"} onClick={toggle} aria-pressed={enabled}>
          {enabled ? <PowerOff /> : <Power />}
          {enabled ? "Stop watchdog" : "Start watchdog"}
        </Button>
      }
    >
      <Panel>
        <PanelHeader
          title={
            <span className="flex items-center gap-2">
              <Radar className="size-4 shrink-0 text-slate" /> {enabled ? "Running" : "Stopped"} · {services.length} service{services.length === 1 ? "" : "s"}
            </span>
          }
          description={
            enabled
              ? `${openCount} open incident${openCount === 1 ? "" : "s"} · ${autoCount} recorded automatically`
              : `${autoCount} incident${autoCount === 1 ? "" : "s"} recorded automatically. Start the watchdog to resume checks.`
          }
          right={
            enabled && (
              <span className="inline-flex items-center gap-2 text-[12px] font-medium text-ink">
                <span className="relative inline-flex size-2" aria-hidden>
                  {!reduced && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />}
                  <span className="relative inline-flex size-2 rounded-full bg-accent" />
                </span>
                Live
              </span>
            )
          }
        />
        <dl className="grid gap-x-6 gap-y-4 border-b border-line bg-subtle px-5 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {POLICY.map((p) => (
            <div key={p.k} className="min-w-0">
              <dt className="font-mono text-[12px] font-medium text-ink">{p.k}</dt>
              <dd className="mt-1 text-[12px] leading-[1.45] text-slate">{p.v}</dd>
            </div>
          ))}
        </dl>
        <ul className="divide-y divide-line" aria-label="Watchdog status per service">
          {services.map((svc) => (
            <ServiceRow
              key={svc.id}
              svc={svc}
              w={watch[svc.id]}
              enabled={enabled}
              unplugged={!!unplugged[svc.id]}
              onTogglePlug={() => togglePlug(svc.id)}
            />
          ))}
        </ul>
        <PanelFooter
          hint={
            <>
              The watchdog runs in your browser while /monitor is open and records outages in the sandbox ledger. Nothing is sent to Base Sepolia.
              Failed checks that were not yet recorded are dropped when you stop it or leave the page. In production, these records would be signed by an
              independent probe network. To test a real failure, register a service on{" "}
              <Link href="/provider" className="font-medium text-ink underline underline-offset-2">
                /provider
              </Link>{" "}
              with the health endpoint <span className="break-all font-mono">https://httpbin.org/status/503</span>.
            </>
          }
        />
      </Panel>
    </Section>
  );
}
