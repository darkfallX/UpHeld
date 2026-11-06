import { lookup } from "node:dns/promises";
import net from "node:net";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 6000;

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("::ffff:");
}

/**
 * Real HTTP health probe used by /monitor. Public http(s) endpoints only. Private and loopback
 * targets are refused so this route can't be used to reach internal networks.
 * A probe is "up" when the server answers with a status < 500 within the timeout.
 */
export async function GET(req: Request) {
  const target = new URL(req.url).searchParams.get("url") ?? "";
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return NextResponse.json({ ok: false, status: null, statusText: "INVALID_URL", latencyMs: 0, error: "Enter a full URL, e.g. https://sepolia.base.org" }, { status: 400 });
  }
  if (!["https:", "http:"].includes(url.protocol)) {
    return NextResponse.json({ ok: false, status: null, statusText: "UNSUPPORTED_PROTOCOL", latencyMs: 0, error: "Only http(s) endpoints can be probed." }, { status: 400 });
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (/\.(demo|local|internal|localhost)$/i.test(host) || host === "localhost") {
    return NextResponse.json({ ok: false, status: null, statusText: "SYNTHETIC_ENDPOINT", latencyMs: 0, error: "Demo host. Its heartbeat is simulated." });
  }
  try {
    const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (addrs.some((a) => isPrivateIp(a.address))) {
      return NextResponse.json({ ok: false, status: null, statusText: "BLOCKED_PRIVATE_NETWORK", latencyMs: 0, error: "Private or loopback addresses can't be probed." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ ok: false, status: null, statusText: "DNS_FAILURE", latencyMs: 0, error: `Could not resolve ${host}.` });
  }

  const started = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: ctrl.signal,
      cache: "no-store",
      headers: { "user-agent": "UpHeld-Monitor/1.0 (+uptime probe)", accept: "*/*" },
    });
    const latencyMs = Math.round(performance.now() - started);
    void res.body?.cancel();
    return NextResponse.json({ ok: res.status < 500, status: res.status, statusText: res.statusText || String(res.status), latencyMs });
  } catch (e) {
    const latencyMs = Math.round(performance.now() - started);
    const aborted = e instanceof Error && e.name === "AbortError";
    return NextResponse.json({
      ok: false,
      status: null,
      statusText: aborted ? "TIMEOUT" : "CONNECTION_FAILED",
      latencyMs,
      error: aborted ? `No response within ${TIMEOUT_MS / 1000}s.` : e instanceof Error ? e.message : "Request failed.",
    });
  } finally {
    clearTimeout(timer);
  }
}
