"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatBps, formatMinutes, formatUsdc } from "@/lib/sla-engine";
import { useUpHeld } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { ProbeResult, ServicePlan } from "@/lib/types";

/**
 * Watchdog timing for the demo. A production monitor checks every 5 minutes. The demo checks
 * every 5 seconds and counts each failed check as 5 minutes of downtime.
 */
export const WATCHDOG_POLICY = {
  intervalMs: 5_000,
  minutesPerCheck: 5,
  failuresToAttest: 3,
} as const;

/** Keep the service badge in its incident state while an incident is open (several batches long). */
const STATUS_HOLD_MS = WATCHDOG_POLICY.intervalMs * WATCHDOG_POLICY.failuresToAttest * 3;

export interface WatchState {
  serviceId: string;
  checks: number;
  lastCheckAt: string | null;
  lastOk: boolean | null;
  /** Short result label, e.g. "200 · 84ms", "503", "TIMEOUT", "simulated outage". */
  lastLabel: string | null;
  consecutiveFailures: number;
  /** Failed checks not yet recorded as downtime. */
  unattestedFailures: number;
  incidentOpen: boolean;
  incidentStartedAt: string | null;
  /** Minutes recorded in the open (or most recently closed) incident. */
  minutesAttested: number;
  /** Records written in the open (or most recently closed) incident. */
  attestations: number;
  /** Why the last check failed, e.g. "status 503". Used in the closing incident title. */
  lastFailureReason: string | null;
  /** Description of the last watchdog action for this service. */
  lastEvent: string | null;
  /** True when the last check could not determine whether the service is up (bad URL, blocked host, probe API down). */
  lastInconclusive: boolean;
}

type Run = { alive: boolean };

function blank(serviceId: string): WatchState {
  return {
    serviceId,
    checks: 0,
    lastCheckAt: null,
    lastOk: null,
    lastLabel: null,
    consecutiveFailures: 0,
    unattestedFailures: 0,
    incidentOpen: false,
    incidentStartedAt: null,
    minutesAttested: 0,
    attestations: 0,
    lastFailureReason: null,
    lastEvent: null,
    lastInconclusive: false,
  };
}

/**
 * Probe results that say nothing about the service itself: the URL cannot be probed (invalid, not http(s),
 * a sample or private host) or /api/monitor/ping did not respond. These never count as downtime.
 */
const INCONCLUSIVE = new Set(["INVALID_URL", "UNSUPPORTED_PROTOCOL", "SYNTHETIC_ENDPOINT", "BLOCKED_PRIVATE_NETWORK", "PROBE_API_UNREACHABLE"]);
const isInconclusive = (p: ProbeResult) => !p.ok && p.status === null && INCONCLUSIVE.has(p.statusText);

/** Real HTTP probe through GET /api/monitor/ping (ok=false means the check failed). */
export async function runProbe(url: string, serviceId?: string): Promise<ProbeResult> {
  const at = new Date().toISOString();
  try {
    const res = await fetch(`/api/monitor/ping?url=${encodeURIComponent(url)}`, { cache: "no-store" });
    const j = (await res.json()) as { ok: boolean; status: number | null; statusText: string; latencyMs: number; error?: string };
    return { id: `${at}_${Math.random().toString(36).slice(2, 7)}`, url, serviceId, at, ...j };
  } catch (e) {
    return {
      id: `${at}_err_${Math.random().toString(36).slice(2, 7)}`,
      url,
      serviceId,
      at,
      ok: false,
      status: null,
      statusText: "PROBE_API_UNREACHABLE",
      latencyMs: 0,
      error: e instanceof Error ? e.message : "fetch failed",
    };
  }
}

/** Simulated check for sample *.demo hosts. Healthy unless an outage is simulated in the watchdog panel. */
function syntheticProbe(svc: ServicePlan, unplugged: boolean, n: number): ProbeResult {
  const at = new Date().toISOString();
  const last = svc.heartbeatHistory[svc.heartbeatHistory.length - 1];
  const base = last && last.latencyMs > 0 ? last.latencyMs : 40;
  return {
    id: `${at}_syn_${svc.id}_${Math.random().toString(36).slice(2, 7)}`,
    url: svc.endpointUrl || `https://${svc.slug}.demo/health`,
    serviceId: svc.id,
    at,
    ok: !unplugged,
    status: null,
    statusText: unplugged ? "SYNTHETIC_PLUG_PULLED" : "SYNTHETIC_OK",
    latencyMs: unplugged ? 0 : base + ((n * 7) % 9),
    error: unplugged ? "simulated outage" : undefined,
  };
}

function probeLabel(p: ProbeResult): string {
  if (p.statusText === "SYNTHETIC_PLUG_PULLED") return "simulated outage";
  if (p.statusText === "SYNTHETIC_OK") return `ok · ${p.latencyMs}ms`;
  if (p.status !== null) return p.latencyMs > 0 ? `${p.status} · ${p.latencyMs}ms` : String(p.status);
  return p.statusText;
}

/** Reason shown in the incident title, e.g. "status 503", "timeout", "simulated outage". */
function failureReason(p: ProbeResult): string {
  if (p.statusText === "SYNTHETIC_PLUG_PULLED") return "simulated outage";
  if (p.status !== null) return `status ${p.status}`;
  return p.statusText.toLowerCase().replace(/_/g, " ");
}

/**
 * Browser-side watchdog for /monitor. Checks every service on a fixed interval and, after
 * WATCHDOG_POLICY.failuresToAttest consecutive failed checks, records the outage with
 * store.injectOutage(..., { source: "watchdog" }). Runs only while the page is open.
 */
export function useWatchdog() {
  const [enabled, setEnabled] = useState(false);
  const [unplugged, setUnplugged] = useState<Record<string, boolean>>({});
  const [watch, setWatch] = useState<Record<string, WatchState>>({});

  const unpluggedRef = useRef<Record<string, boolean>>({});
  const watchRef = useRef<Record<string, WatchState>>({});
  const inflight = useRef(new Set<string>());
  const seqRef = useRef(0);

  /** "Reset demo" clears the incident log and lowers incidentSeq, so drop open incidents from before the reset. */
  const syncAfterReset = useCallback(() => {
    const seq = useUpHeld.getState().incidentSeq;
    if (seq < seqRef.current) {
      watchRef.current = {};
      setWatch({});
    }
    seqRef.current = seq;
  }, []);

  const commit = useCallback((id: string, next: WatchState) => {
    watchRef.current = { ...watchRef.current, [id]: next };
    setWatch(watchRef.current);
  }, []);

  /** Records `failedChecks` × 5 min for a service. Returns the minutes recorded (0 on failure). */
  const attest = useCallback((svc: ServicePlan, failedChecks: number, reason: string, closing: boolean): number => {
    const minutes = failedChecks * WATCHDOG_POLICY.minutesPerCheck;
    if (minutes <= 0) return 0; // never record zero minutes
    const title = `Watchdog · ${failedChecks} failed check${failedChecks === 1 ? "" : "s"} · ${reason}${closing ? " · recovered" : ""}`;
    const r = useUpHeld.getState().injectOutage(svc.id, minutes, title, { source: "watchdog", statusHoldMs: closing ? 0 : STATUS_HOLD_MS });
    if (!r.ok) {
      toast.error(`Could not record the outage for ${svc.name}`, r.error);
      return 0;
    }
    const inc = r.receipt.incident;
    const move = `${formatBps(inc.previousUptimeBps)} → ${formatBps(inc.newUptimeBps)}`;
    if (inc.totalCompensationTriggeredUsdc > 0) {
      toast.success(
        `Outage recorded · ${svc.name} · +${formatMinutes(minutes)}`,
        `${move} · ${formatUsdc(inc.totalCompensationTriggeredUsdc)} USDC unlocked for ${inc.subscribersCompensated} subscriber${inc.subscribersCompensated === 1 ? "" : "s"}`,
        r.receipt.receipt,
      );
    } else {
      toast.info(
        `Outage recorded · ${svc.name} · +${formatMinutes(minutes)}`,
        inc.slaBreached ? `${move} · no new refund owed (tier already paid or no subscribers)` : `${move} · within SLA, no refund owed`,
      );
    }
    return minutes;
  }, []);

  const apply = useCallback(
    (svc: ServicePlan, p: ProbeResult) => {
      syncAfterReset();
      const prev = watchRef.current[svc.id] ?? blank(svc.id);
      const need = WATCHDOG_POLICY.failuresToAttest;
      if (isInconclusive(p)) {
        // service state unknown: keep every counter as it was
        commit(svc.id, {
          ...prev,
          checks: prev.checks + 1,
          lastCheckAt: p.at,
          lastLabel: `not checked · ${failureReason(p)}`,
          lastInconclusive: true,
          lastEvent:
            p.statusText === "PROBE_API_UNREACHABLE"
              ? "The probe service did not respond. This check was not counted."
              : "This URL cannot be checked (sample, private or invalid host). No downtime was recorded.",
        });
        return;
      }
      const next: WatchState = { ...prev, checks: prev.checks + 1, lastCheckAt: p.at, lastOk: p.ok, lastLabel: probeLabel(p), lastInconclusive: false };

      if (!p.ok) {
        const reason = failureReason(p);
        next.lastFailureReason = reason;
        next.consecutiveFailures = prev.consecutiveFailures + 1;
        next.unattestedFailures = prev.unattestedFailures + 1;
        if (next.unattestedFailures >= need) {
          const opening = !prev.incidentOpen;
          const mins = attest(svc, next.unattestedFailures, reason, false);
          if (mins > 0) {
            next.incidentOpen = true;
            next.incidentStartedAt = opening ? p.at : prev.incidentStartedAt;
            next.minutesAttested = (opening ? 0 : prev.minutesAttested) + mins;
            next.attestations = (opening ? 0 : prev.attestations) + 1;
            next.lastEvent = opening
              ? `Incident opened · ${formatMinutes(mins)} recorded after ${next.unattestedFailures} failed checks`
              : `Still down · ${formatMinutes(mins)} more recorded`;
          } else {
            next.lastEvent = "Could not record the outage · counters reset";
          }
          next.unattestedFailures = 0;
        } else {
          next.lastEvent = prev.incidentOpen
            ? `Still down · ${next.unattestedFailures} of ${need} failed checks before the next record`
            : `Failed check ${next.unattestedFailures} of ${need} · not recorded yet`;
        }
      } else {
        if (prev.incidentOpen) {
          const extra = prev.unattestedFailures > 0 ? attest(svc, prev.unattestedFailures, prev.lastFailureReason ?? "failed checks", true) : 0;
          next.minutesAttested = prev.minutesAttested + extra;
          next.attestations = prev.attestations + (extra > 0 ? 1 : 0);
          next.incidentOpen = false;
          next.lastEvent = `Recovered · incident closed, ${formatMinutes(next.minutesAttested)} recorded in total`;
          useUpHeld.getState().recoverService(svc.id);
        } else if (prev.unattestedFailures > 0) {
          next.lastEvent = `Recovered after ${prev.unattestedFailures} failed check${prev.unattestedFailures === 1 ? "" : "s"} · below the ${need}-check threshold, nothing recorded`;
        } else if (!prev.lastEvent) {
          next.lastEvent = "Healthy";
        }
        next.consecutiveFailures = 0;
        next.unattestedFailures = 0;
      }
      commit(svc.id, next);
      seqRef.current = useUpHeld.getState().incidentSeq;
    },
    [attest, commit, syncAfterReset],
  );

  const checkOne = useCallback(
    async (svc: ServicePlan, run: Run) => {
      if (inflight.current.has(svc.id)) return; // a slow probe is still running, so skip this tick
      inflight.current.add(svc.id);
      try {
        const n = (watchRef.current[svc.id]?.checks ?? 0) + 1;
        const p = svc.synthetic ? syntheticProbe(svc, !!unpluggedRef.current[svc.id], n) : await runProbe(svc.endpointUrl, svc.id);
        if (!run.alive) return; // stopped or unmounted while the probe was in flight
        useUpHeld.getState().recordProbe(p);
        // re-read the service, since an earlier record in this tick may have changed it
        const fresh = useUpHeld.getState().services.find((s) => s.id === svc.id);
        if (fresh) apply(fresh, p);
      } finally {
        inflight.current.delete(svc.id);
      }
    },
    [apply],
  );

  const tick = useCallback(
    (run: Run) => {
      if (!run.alive) return;
      syncAfterReset();
      for (const svc of useUpHeld.getState().services) void checkOne(svc, run);
    },
    [checkOne, syncAfterReset],
  );

  useEffect(() => {
    if (!enabled) return;
    // one run per effect. Results that arrive after it ends (stop, unmount, StrictMode re-run) are ignored.
    const run: Run = { alive: true };
    // first check runs on the next task so StrictMode's mount, unmount, mount sequence does not fire twice
    const first = setTimeout(() => tick(run), 0);
    const every = setInterval(() => tick(run), WATCHDOG_POLICY.intervalMs);
    return () => {
      run.alive = false;
      clearTimeout(first);
      clearInterval(every);
    };
  }, [enabled, tick]);

  const toggle = useCallback(() => {
    if (enabled) {
      // stopping drops failed checks that were not recorded
      watchRef.current = {};
      setWatch({});
    }
    setEnabled(!enabled);
  }, [enabled]);

  const togglePlug = useCallback((serviceId: string) => {
    const next = { ...unpluggedRef.current, [serviceId]: !unpluggedRef.current[serviceId] };
    unpluggedRef.current = next;
    setUnplugged(next);
  }, []);

  return { enabled, toggle, unplugged, togglePlug, watch };
}
