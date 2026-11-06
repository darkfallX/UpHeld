# MOTION.md: UpHealth Visual System, Anti-AI Aesthetic & Motion Choreography

> **Core Rule:** UpHealth must **NEVER** look like a generic AI-generated crypto template.
> **Strictly Forbidden:** Purple/violet/magenta neon gradients, floating meaningless 3D blobs, emoji icons inside buttons (`🚀`, `💰`, `⚡`), and low-contrast glassmorphism.

---

## 1. Creative Direction: "Architectural Telemetry & Programmable Trust"

UpHealth blends the crisp editorial precision of **Linear / Stripe / Vercel** with the tactile reliability of a **mission-critical status page (Datadog / BetterStack)** and **Base's signature electric blue**.

- **Mood:** High-trust, surgical, kinetic, transparent, financial-grade.
- **Visual Metaphor:** The **Live Heartbeat-to-Escrow Bridge**: when the green service pulse drops into a crimson outage trough, locked Base blue USDC reserves visibly flow into the customer's wallet.

---

## 2. Color System (Tested via RealtimeColors Principles)

We use a **High-Craft Dark Telemetry + Crisp Light Surface Hybrid** (dark obsidian command surfaces paired with ultra-clean alabaster cards and sharp 1px hairlines):

| CSS Variable | Hex | Role |
| :--- | :--- | :--- |
| `--bg-obsidian` | `#090D10` | Primary dark command background / Chaos Theater canvas |
| `--bg-surface` | `#11171D` | Elevated dark bento card surface |
| `--bg-elevated` | `#172029` | Hover & interactive panel surface |
| `--paper-light` | `#F7F8F5` | Optional contrasting editorial light section background |
| `--text-primary` | `#F3F6F8` | Primary crisp headline & value text |
| `--text-secondary` | `#94A3B8` | Supporting descriptions & labels |
| `--text-muted` | `#64748B` | Technical metadata, timestamps, tx hashes |
| `--border-subtle` | `#1E293B` | Crisp 1px architectural card borders |
| `--accent-emerald` | `#10B981` | **99.99% Operational Pulse** & Claimable USDC Ready |
| `--accent-base` | `#0052FF` | **Base Network Identity**, USDC Reserve Pool, Primary Brand Accent |
| `--accent-cyan` | `#06B6D4` | Active telemetry probe & on-chain verification beam |
| `--status-warning` | `#F59E0B` | **Degraded Latency / Minor SLA Breach** |
| `--status-outage` | `#EF4444` | **Major Outage / SLA Threshold Violated** |

### Contrast & Usage Rules
1. Never put neon green text on a white background or low-contrast gray text on dark gray.
2. Every status indicator (`OPERATIONAL`, `DEGRADED`, `OUTAGE`) must pair **color + icon (`lucide-react`) + monospace text label** so colorblind users can read it effortlessly.
3. No purple (`#8B5CF6`, `#A855F7`, `#6366F1`) anywhere in the app.

---

## 3. Typography (Fontjoy Curated Pairing)

| Role | Font Family | Weights | Tracking / Details |
| :--- | :--- | :--- | :--- |
| **Display & Headlines** | `Space Grotesk` (or `Plus Jakarta Sans`) | `600`, `700` | `-0.03em` tight tracking, crisp geometric forms |
| **UI & Body Copy** | `Inter` | `400`, `500`, `600` | Normal tracking, `1.5` line height for readability |
| **Telemetry, SLA %, & USDC Amounts** | `JetBrains Mono` (or `IBM Plex Mono`) | `500`, `600` | `font-variant-numeric: tabular-nums` (mandatory so numbers never jitter when animating!) |

---

## 4. Motion Tokens (`src/lib/motion.ts`)

Export and reuse these exact `framer-motion` tokens across all components:

```ts
export const motionTokens = {
  springSnappy: { type: "spring" as const, stiffness: 360, damping: 28, mass: 0.8 },
  springSmooth: { type: "spring" as const, stiffness: 220, damping: 26, mass: 1 },
  easeOutExpo: [0.16, 1, 0.3, 1] as const,
  enterTransition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const },
  staggerFast: 0.05,
};
```

---

## 5. Signature Motion Storyboards

### Signature Sequence A: The "Heartbeat-to-Payout" Outage Choreography (`/demo` & `/`)
- **Purpose:** Visually prove how an uptime failure triggers an automatic Base smart contract refund without human middlemen.
- **Trigger:** User clicks **"Trigger Simulated Outage"** in `/demo` (or toggles the interactive hero specimen on `/`).
- **Stage 1: Pulse Interruption (`0ms - 250ms`):**
  - The live SVG heartbeat wave shifts from `#10B981` (Signal Emerald) to `#EF4444` (Outage Crimson).
  - The latest segments of the 90-bar uptime sparkline morph downward and turn crimson.
- **Stage 2: SLA Threshold Breach (`250ms - 550ms`):**
  - The monospace uptime counter animates smoothly using tabular numerals (e.g., `100.00%` → `98.88%`).
  - A horizontal dashed SLA threshold line (`99.95% Guaranteed`) flashes amber/crimson as the bar crosses below it, revealing the badge: `SLA BREACHED • TIER 2 (25% REFUND)`.
- **Stage 3: Escrow Reserve Release (`550ms - 950ms`):**
  - An animated SVG connector path between the **Provider USDC Reserve Pool** card and the **Subscriber Compensation Vault** illuminates with a traveling Base Blue → Emerald particle pulse (`stroke-dashoffset` animation).
  - Provider Reserve counter ticks down (`$5,000.00` → `$4,997.50 USDC`), while Subscriber Claimable Balance ticks up (`$0.00` → `$2.50 USDC`).
- **Stage 4: Claim Settlement:**
  - When the user clicks **"Claim $2.50 USDC"**, the claim card compresses slightly (`scale: 0.98`), emits a subtle emerald border ring, moves the funds into the user's primary USDC wallet balance, and appends an immutable row to the On-Chain Event Log.

### Signature Sequence B: 90-Bar Uptime Telemetry Scrubbing
- Hovering or focusing any bar in a service's 90-bar availability strip smoothly elevates that bar (`scaleY: 1.18`, `120ms`) and displays a crisp monospace tooltip with the exact window timestamp, HTTP probe latency (`24ms` vs `503 Timeout`), and SLA impact.

### Reduced Motion Support (`prefers-reduced-motion: reduce`)
- Respect `useReducedMotion()` from `framer-motion`.
- When reduced motion is enabled: disable continuous waveform scrolling and particle path travel; update uptime numbers, status badges, and USDC balances instantaneously (`<= 100ms` opacity fade) while keeping all information and actions 100% accessible.
