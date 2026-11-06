import path from "node:path";
import type { NextConfig } from "next";

/**
 * Security headers for a wallet-connected app.
 * - frame-ancestors / X-Frame-Options: nobody can load UpHeld inside a hidden iframe and trick a
 *   visitor into clicking "approve" (clickjacking).
 * - COOP same-origin-allow-popups: isolates the window but still lets the Coinbase Smart Wallet popup work.
 * - nosniff, strict referrer, and no camera/mic/geolocation access.
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  // Pin the workspace root to this project so a stray lockfile in a parent folder
  // (e.g. C:\Users\<you>\package-lock.json) isn't picked up as the root.
  outputFileTracingRoot: path.join(__dirname),
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
