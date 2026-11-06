"use client";

import { Moon, MoonStar, ShieldCheck } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { formatBps, formatMinutes, formatUsdc } from "@/lib/sla-engine";
import { useUpHeld } from "@/lib/store";
import type { OutageIncident } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Panel, PanelBody, PanelFooter, PanelHeader, Section } from "../ui/card";
import { SourceBadge } from "./source-badge";

const WINDOW_HOURS = 12;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** 22:00 to 06:00 UTC */
function isNightUtc(ms: number): boolean {
  const h = new Date(ms).getUTCHours();
  return h >= 22 || h < 6;
}

/** Overnight periods (22:00 to 06:00 UTC) that overlap [start, end]. */
function nightSegments(start: number, end: number): { from: number; to: number }[] {
  const segs: { from: number; to: number }[] = [];
  const firstDay = Math.floor(start / DAY_MS) * DAY_MS - DAY_MS;
  for (let day = firstDay; day < end; day += DAY_MS) {
    const from = Math.max(day + 22 * HOUR_MS, start);
    const to = Math.min(day + 30 * HOUR_MS, end);
    if (to > from) segs.push({ from, to });
  }
  return segs;
}

const utcTime = (ms: number) => `${new Date(ms).toISOString().slice(11, 16)} UTC`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

interface Summary {
  list: OutageIncident[];
  auto: number;
  manual: number;
  downtime: number;
  unlocked: number;
  breaches: number;
  night: { count: number; downtime: number; unlocked: number };
  worst: { serviceId: string; downtime: number; lowestUptimeBps: number } | null;
}

function summarize(incidents: OutageIncident[], start: number): Summary {
  const list = incidents.filter((i) => Date.parse(i.createdAt) >= start);
  const nightList = list.filter((i) => isNightUtc(Date.parse(i.createdAt)));
  const per = new Map<string, { serviceId: string; downtime: number; lowestUptimeBps: number }>();
  for (const i of list) {
    const p = per.get(i.serviceId) ?? { serviceId: i.serviceId, downtime: 0, lowestUptimeBps: 10000 };
    p.downtime += i.downtimeMinutes;
    p.lowestUptimeBps = Math.min(p.lowestUptimeBps, i.newUptimeBps);
    per.set(i.serviceId, p);
  }
  const worst = [...per.values()].sort((a, b) => b.downtime - a.downtime || a.lowestUptimeBps - b.lowestUptimeBps)[0] ?? null;
  const sum = (xs: OutageIncident[], f: (i: OutageIncident) => number) => xs.reduce((a, i) => a + f(i), 0);
  return {
    list,
    auto: list.filter((i) => i.source === "watchdog").length,
    manual: list.filter((i) => i.source !== "watchdog").length,
    downtime: sum(list, (i) => i.downtimeMinutes),
    unlocked: sum(list, (i) => i.totalCompensationTriggeredUsdc),
    breaches: list.filter((i) => i.slaBreached).length,
    night: { count: nightList.length, downtime: sum(nightList, (i) => i.downtimeMinutes), unlocked: sum(nightList, (i) => i.totalCompensationTriggeredUsdc) },
    worst,
  };
}

function verdict(s: Summary): string {
  if (s.list.length === 0) return `No incidents in the last ${WINDOW_HOURS} hours.`;
  const head = `${plural(s.list.length, "incident")} in the last ${WINDOW_HOURS} hours.`;
  // count each payout under the source that triggered it
  const autoUnlocked = s.list.filter((i) => i.source === "watchdog").reduce((a, i) => a + i.totalCompensationTriggeredUsdc, 0);
  if (s.auto > 0) {
    const paid = autoUnlocked > 0 ? `, ${formatUsdc(autoUnlocked)} in refunds unlocked` : "";
    return `${head} ${s.auto} recorded by the watchdog${paid}.`;
  }
  const paid = s.unlocked > 0 ? `, ${formatUsdc(s.unlocked)} in refunds unlocked` : "";
  return `${head} All recorded manually${paid}.`;
}

function Cell({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-[10px] border border-line px-4 py-3.5">
      <div className="text-[12px] text-dim">{label}</div>
      <div className="mt-1.5 truncate font-mono text-[18px] font-medium tabular text-ink">{value}</div>
      {sub && <div className="mt-1 truncate text-[12px] text-slate">{sub}</div>}
    </div>
  );
}

export function NightShiftReport() {
  const incidents = useUpHeld((s) => s.incidents);
  const services = useUpHeld((s) => s.services);
  // the clock starts on the client so the server and first client render match
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // the window is empty until the clock starts (start = +Infinity)
  const start = now === null ? Number.POSITIVE_INFINITY : now - WINDOW_HOURS * HOUR_MS;
  const s = useMemo(() => summarize(incidents, start), [incidents, start]);
  const nameOf = (id: string) => services.find((x) => x.id === id)?.name ?? "Removed service";
  const ready = now !== null;
  // the newest incidents can be a few seconds newer than the 30s clock, so extend the axis to include them
  const end = ready ? Math.max(now, ...s.list.map((i) => Date.parse(i.createdAt))) : 0;
  const span = Math.max(1, end - start);
  const pos = (ms: number) => `${Math.min(100, Math.max(0, ((ms - start) / span) * 100))}%`;
  const quiet = s.list.length === 0;

  return (
    <Section
      id="night"
      title="Night shift report"
      description={`Incidents from the last ${WINDOW_HOURS} hours, with overnight hours (22:00 to 06:00 UTC) highlighted.`}
    >
      <Panel>
        <PanelHeader
          title={
            <span className="flex items-center gap-2">
              {quiet ? <ShieldCheck className="size-4 shrink-0 text-slate" /> : <MoonStar className="size-4 shrink-0 text-slate" />}
              {ready ? verdict(s) : "Loading report…"}
            </span>
          }
          description={ready ? `${utcTime(start)} to ${utcTime(now)}` : undefined}
        />
        <PanelBody className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Cell label="Incidents" value={s.list.length} sub={`${s.auto} auto · ${s.manual} manual`} />
            <Cell label="Downtime" value={formatMinutes(s.downtime)} sub={`${s.breaches} SLA breach${s.breaches === 1 ? "" : "es"}`} />
            <Cell label="Refunds unlocked" value={formatUsdc(s.unlocked)} sub="Claimable by subscribers" />
            <Cell
              label="Most affected"
              value={s.worst ? nameOf(s.worst.serviceId) : "None"}
              sub={s.worst ? `${formatMinutes(s.worst.downtime)} down · lowest ${formatBps(s.worst.lowestUptimeBps)}` : "No downtime"}
            />
          </div>

          <div className="rounded-[10px] bg-subtle px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
              <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                <Moon className="size-3.5" aria-hidden /> Overnight · 22:00 to 06:00 UTC
              </span>
              <span className="text-slate">
                {s.night.count === 0
                  ? "No incidents overnight."
                  : `${plural(s.night.count, "incident")} · ${formatMinutes(s.night.downtime)} down · ${formatUsdc(s.night.unlocked)} in refunds unlocked`}
              </span>
            </div>

            {/* 12-hour timeline. Shaded areas are overnight (UTC), ticks are incidents, red ticks breached the SLA. */}
            <div className="relative mt-4 h-9 overflow-hidden rounded-[6px] bg-panel shadow-card" role="img" aria-label={`Timeline of ${plural(s.list.length, "incident")} in the last ${WINDOW_HOURS} hours`}>
              {ready &&
                nightSegments(start, end).map((g) => (
                  <div
                    key={g.from}
                    className="absolute inset-y-0 bg-ink/[0.06]"
                    style={{ left: pos(g.from), width: `calc(${pos(g.to)} - ${pos(g.from)})` }}
                    aria-hidden
                  />
                ))}
              {ready &&
                s.list.map((i) => (
                  <span
                    key={i.id}
                    className={cn("absolute inset-y-1.5 w-[3px] -translate-x-1/2 rounded-full", i.slaBreached ? "bg-down" : "bg-warn", i.source !== "watchdog" && "opacity-60")}
                    style={{ left: pos(Date.parse(i.createdAt)) }}
                    title={`${utcTime(Date.parse(i.createdAt))} · ${nameOf(i.serviceId)} · ${i.downtimeMinutes}m · ${i.source === "watchdog" ? "auto" : "manual"}`}
                  />
                ))}
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[11px] text-dim">
              <span>{ready ? utcTime(start) : "…"}</span>
              <span className="hidden sm:inline">Shaded: overnight · Red: SLA breached</span>
              <span>Now</span>
            </div>
          </div>

          {s.list.length > 0 && (
            <ol className="divide-y divide-line rounded-[10px] border border-line" aria-label="Incidents in the report window">
              {s.list.slice(0, 6).map((i) => {
                const t = Date.parse(i.createdAt);
                return (
                  <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-[13px]">
                    <span className="inline-flex w-[84px] items-center gap-1 font-mono text-[12px] text-dim">
                      {isNightUtc(t) && <Moon className="size-3" aria-label="overnight" />}
                      {utcTime(t).replace(" UTC", "")}
                    </span>
                    <span className="min-w-0 font-medium text-ink">{nameOf(i.serviceId)}</span>
                    <SourceBadge source={i.source} />
                    <span className="ml-auto font-mono text-[12px] text-slate">
                      +{i.downtimeMinutes}m
                      {i.totalCompensationTriggeredUsdc > 0 && <span className="text-ink"> · {formatUsdc(i.totalCompensationTriggeredUsdc)} USDC</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </PanelBody>
        <PanelFooter
          hint={
            s.list.length > 6
              ? `Showing the 6 most recent of ${s.list.length}. See the incident log for the full list.`
              : "Times are in UTC."
          }
        />
      </Panel>
    </Section>
  );
}
