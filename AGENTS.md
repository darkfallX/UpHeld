# AGENTS.md: UpHealth Coding Agent Operating Contract

> **Read this first**, then `PRODUCT.md`, `SKILLS.md`, `MOTION.md`, and `BASE_AND_MCP_GUIDE.md`.
> **UpHealth** (tagline: *"Uptime, Upheld on Base"*) is a standalone project built for the **Vibestarter Vibeathon**. It has **zero connection** to any other project.

---

## 1. Mission

Build **UpHealth**: a **blockchain-powered subscription platform on Base that automatically compensates users in USDC when digital services experience outages.**

> **One-sentence pitch:**
> **UpHealth lets businesses sell performance-backed digital subscriptions on Base, while customers automatically receive USDC compensation when the service fails to meet its promised reliability.**

It is **both a subscription platform and an automated SLA compensation system**, built around five cohesive pillars:
1. **Consumer Dashboard (`/consumer`)**: Browse digital services, subscribe using USDC on Base, monitor live uptime & heartbeat telemetry, and view/claim automatic USDC compensation when qualifying outages occur.
2. **Provider Dashboard (`/provider`)**: Register digital services, create subscription plans (e.g., `$10/month` in USDC), set uptime guarantees (e.g., `99.9%`), define tiered compensation policies, and fund on-chain USDC compensation reserves.
3. **Service Monitoring & Outage Verification System (`/monitor` + backend engine)**: Continuously monitors registered service endpoints, records downtime incidents, computes rolling availability %, and determines subscriber compensation eligibility.
4. **Base Smart Contract System (`contracts/UpHealthSLA.sol` + `MockUSDC.sol` on Base Sepolia)**: Processes USDC subscription payments, holds locked provider reserve funds, enforces predefined SLA payout rules, and makes eligible USDC refunds immediately claimable (or auto-disbursed) to subscribers.
5. **Interactive Hackathon Demo & Chaos Theater (`/demo`)**: Pre-seeded with realistic fictional digital services (**Streamly**, **CloudBox**, and **HyperNode RPC**) so judges can subscribe in 1 click, **trigger simulated outages**, watch live availability drop below the SLA threshold, see the smart contract calculate exact pro-rata compensation, and receive actual testnet USDC on Base Sepolia (plus a zero-popup **Instant Judge Sandbox Wallet** fallback).

---

## 2. Priority Order

1. **End-to-end interactive demo loop that works on first click** (Subscribe → Trigger Outage → Uptime Drops → Compensation Calculated → Claim USDC).
2. **Real Base Sepolia smart contract + Dual Execution Mode** (Real Wallet Connect via Wagmi/Viem/OnchainKit on Base Sepolia `84532` **AND** a frictionless 1-click Judge Demo Wallet mode with pre-funded MockUSDC so no judge is ever blocked by a missing wallet or faucet).
3. **Distinctive, non-AI-generated visual craft** using the Free Web Design Toolkit (`shadcn` MCP with `@magicui` and `@react-bits` registries, `lucide-react`, `uiverse.io` patterns, `haikei.app` SVGs, and custom SVG heartbeat telemetry, **never generic purple AI gradients or emoji buttons**).
4. **Honest state persistence & deterministic math** (integer basis points for uptime `9990 = 99.90%`, integer 6-decimal minor units for USDC `10_000_000 = 10.00 USDC`).
5. **Expressive motion choreography** (`MOTION.md`) with full `prefers-reduced-motion` compliance.

---

## 3. Non-Negotiable Engineering Rules

- **Scope discipline: We are a Subscription Platform, NOT a Netflix/Spotify refund oracle.** Never claim to integrate with Netflix, Spotify, or X. UpHealth is a native platform where digital service businesses list performance-backed plans, showcased via seeded demo services (**Streamly**, **CloudBox**, **HyperNode RPC**) and custom provider registrations.
- **No generic "AI purple" UI.** Follow `MOTION.md` strictly: high-contrast architectural telemetry aesthetic (Obsidian `#090D10`, Warm Alabaster `#F7F8F5`, Signal Emerald `#10B981`, Base Electric Blue `#0052FF`, Amber Incident Warning `#F59E0B`, Outage Crimson `#EF4444`). Use `lucide-react` icons only-**never use emojis inside buttons, badges, or navigation**.
- **100% Free UI & Tooling Only.** Use only the free resources documented in `BASE_AND_MCP_GUIDE.md` (`shadcn`, `@magicui` free registry items, `@react-bits` free registry items, `lucide-react`, `framer-motion`, Tailwind CSS, Wagmi/Viem). Never add paid API dependencies or paid UI registries.
- **Monetary & SLA Precision.**
  - All USDC values must be stored and calculated in **6-decimal integer minor units** (`1 USDC = 1_000_000`).
  - All SLA percentages must use **basis points (bps)** (`100.00% = 10000 bps`, `99.90% = 9990 bps`, `99.00% = 9900 bps`).
- **Real Smart Contracts + Seamless Local/Testnet Fallback.**
  - Write clean, verified Solidity contracts (`contracts/UpHealthSLA.sol` and `contracts/MockUSDC.sol`) targeting **Base Sepolia (`chainId: 84532`)**.
  - Support live on-chain interaction when a Base Sepolia wallet is connected **and** keep a synchronized persistent database/state engine so judges testing without a browser wallet can still execute the full flow, see real contract math, and mint testnet USDC in one click.
- **Every visible button and control must work.** No dead links, no placeholder `"Coming soon"` modals, and no fake static charts that fail to update when an outage is triggered.

---

## 4. Required Routes & Surfaces

| Route | Purpose |
| :--- | :--- |
| `/` | **Editorial Landing Page**: Hero with live interactive Heartbeat-to-Payout specimen, value proposition, how it works, live Base Sepolia status pill, and CTAs (`Launch Interactive Demo`, `Consumer App`, `Provider Console`). |
| `/demo` | **Interactive Hackathon Chaos Theater (Split-Screen Demo)**: Side-by-side (or tabbed on mobile) view combining **Consumer Subscription View**, **Live Outage Simulator (Chaos Injector)**, and **Provider Reserve & Contract Ledger**. |
| `/consumer` | **Consumer Dashboard**: Browse performance-backed services (`Streamly`, `CloudBox`, `HyperNode RPC`, plus newly created ones), subscribe with USDC, monitor live uptime bars, and claim unlocked USDC compensation. |
| `/provider` | **Provider Dashboard**: Register a digital service, configure monthly USDC price, set SLA uptime guarantee (`99.9%`, `99.5%`, etc.) and tiered payout rules, and deposit/top-up the USDC compensation reserve pool. |
| `/monitor` | **Service Monitoring & Incident Log**: Real-time ping history, simulated & live HTTP probe logs, incident duration breakdowns, SLA breach calculations, and on-chain attestation payloads. |
| `/contracts` | **Smart Contract Inspector & Faucet**: View deployed Base Sepolia contract addresses, ABI explorer, 1-click **Mint 100 Testnet USDC** faucet, and live escrow reserve balances. |

---

## 5. Build Sequence (Vertical Slices)

1. **Slice 1, Scaffold, Theme & Design System:** Next.js (App Router) or Vite + React + TypeScript + Tailwind CSS + `framer-motion` + `lucide-react` + `shadcn` setup with `@magicui` and `@react-bits` registries configured in `components.json`.
2. **Slice 2, Smart Contracts & Base Configuration:** Write `MockUSDC.sol` and `UpHealthSLA.sol`, configure Base Sepolia (`84532`) via Viem/Wagmi, and build the deterministic TypeScript SLA & Escrow state engine (persisted via SQLite/Drizzle or local storage + API routes so state survives refreshes).
3. **Slice 3, Seeded Services & Monitoring Engine:** Seed **Streamly** (`$12/mo`, `99.9%` SLA), **CloudBox** (`$10/mo`, `99.95%` SLA), and **HyperNode RPC** (`$25/mo`, `99.99%` SLA) with 30-day heartbeat history, active reserves, and real-time outage simulation triggers.
4. **Slice 4, Consumer & Provider Dashboards:** Complete subscription checkout, USDC reserve funding, new service creation, and 1-click compensation claiming.
5. **Slice 5, Interactive Hackathon Demo (`/demo`):** Build the signature Chaos Theater where judges trigger outages (`15m Degraded Latency`, `45m Major Outage`, `2h Critical Blackout`) and watch uptime, SLA breach tiers, provider reserves, and consumer USDC balances update live with choreographed motion.
6. **Slice 6, Verification & Polish:** Run `typecheck`, `build`, responsive checks (`390px` mobile, `768px` tablet, `1440px` desktop), and `prefers-reduced-motion` audit.

---

## 6. Acceptance Checks

- [ ] Landing page immediately communicates **UpHealth** without looking like an AI template (zero purple gradients, zero emoji buttons).
- [ ] Judge can open `/demo` and complete **Subscribe → Trigger Outage → Watch SLA Breach → Claim USDC** in under 45 seconds with or without MetaMask installed.
- [ ] Provider can register a brand-new service on `/provider`, set a price and SLA guarantee, fund the USDC reserve, and see it immediately appear in `/consumer` and `/demo`.
- [ ] Triggering an outage accurately recalculates rolling uptime in basis points, matches the provider's compensation tier, deducts from the provider's locked USDC reserve, and credits the subscriber's claimable USDC balance.
- [ ] `npm run build` / `pnpm build` and TypeScript typechecking pass with zero errors.
