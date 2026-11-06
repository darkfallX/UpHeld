# BASE_AND_MCP_GUIDE.md: Base Blockchain Reference & 100% Free Web Design / MCP Toolkit

> This single reference file equips **Claude / Claude Code / Codex** (and you) with everything needed to integrate **Base (`docs.base.org`)** and the **Free Vibe-Coder UI & MCP Toolkit** without spending a single cent.

---

# PART 1: Base Blockchain Integration Reference (`https://docs.base.org/get-started/base`)

## 1. Base Network Parameters

Always target **Base Sepolia** for hackathon testing and live judge demos, while keeping constants ready for Base Mainnet:

| Parameter | Base Sepolia (Testnet, Default for Demo) | Base Mainnet |
| :--- | :--- | :--- |
| **Network Name** | Base Sepolia | Base |
| **Chain ID** | `84532` (`0x14a34`) | `8453` (`0x2105`) |
| **Public RPC URL** | `https://sepolia.base.org` | `https://mainnet.base.org` |
| **Block Explorer** | `https://sepolia.basescan.org` | `https://basescan.org` |
| **Currency Symbol** | `ETH` | `ETH` |
| **Official Circle USDC** | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (6 decimals) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (6 decimals) |

> **Why we also include `MockUSDC.sol`:** Circle's official Base Sepolia faucet limits users to small drips and requires external sign-in. By deploying our own `MockUSDC.sol` alongside `UpHealthSLA.sol` (and supporting an instant in-app faucet), judges can mint `100.00 Testnet USDC` in a single click inside UpHealth!

---

## 2. Reference Solidity Smart Contracts (`contracts/UpHealthSLA.sol`)

Claude should include these contracts in `contracts/` and mirror their exact ABI & state transitions in the TypeScript execution layer:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

contract MockUSDC {
    string public constant name = "USD Coin (UpHealth Base Testnet)";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function faucet(address to, uint256 amount) external {
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient USDC");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient USDC");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

contract UpHealthSLA {
    IERC20 public immutable usdc;
    uint256 public constant BILLING_WINDOW_MINUTES = 43200; // 30 days

    struct Service {
        uint256 id;
        address provider;
        string name;
        uint256 monthlyPriceUsdc; // 6 decimals
        uint16 slaTargetBps;      // e.g. 9995 = 99.95%
        uint16 currentUptimeBps;  // starts at 10000 = 100.00%
        uint256 downtimeMinutes;
        uint256 reserveBalanceUsdc;
        uint16 minorRefundBps;    // e.g. 1000 = 10%
        uint16 moderateRefundBps; // e.g. 2500 = 25%
        uint16 severeRefundBps;   // e.g. 5000 = 50%
        bool active;
    }

    uint256 public nextServiceId = 1;
    mapping(uint256 => Service) public services;
    mapping(uint256 => address[]) public serviceSubscribers;
    mapping(address => mapping(uint256 => bool)) public isSubscribed;
    mapping(address => mapping(uint256 => uint256)) public claimableCompensation;

    event ServiceRegistered(uint256 indexed serviceId, address indexed provider, string name, uint256 priceUsdc, uint16 slaBps);
    event ReserveFunded(uint256 indexed serviceId, uint256 amountUsdc, uint256 newReserveBalance);
    event Subscribed(uint256 indexed serviceId, address indexed subscriber, uint256 priceUsdc);
    event OutageRecorded(uint256 indexed serviceId, uint256 downtimeMinutes, uint16 newUptimeBps, uint16 refundBps, bytes32 attestationHash);
    event CompensationClaimed(uint256 indexed serviceId, address indexed subscriber, uint256 amountUsdc);

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    function registerService(
        string calldata name,
        uint256 monthlyPriceUsdc,
        uint16 slaTargetBps,
        uint16 minorRefundBps,
        uint16 moderateRefundBps,
        uint16 severeRefundBps
    ) external returns (uint256 serviceId) {
        serviceId = nextServiceId++;
        services[serviceId] = Service({
            id: serviceId,
            provider: msg.sender,
            name: name,
            monthlyPriceUsdc: monthlyPriceUsdc,
            slaTargetBps: slaTargetBps,
            currentUptimeBps: 10000,
            downtimeMinutes: 0,
            reserveBalanceUsdc: 0,
            minorRefundBps: minorRefundBps,
            moderateRefundBps: moderateRefundBps,
            severeRefundBps: severeRefundBps,
            active: true
        });
        emit ServiceRegistered(serviceId, msg.sender, name, monthlyPriceUsdc, slaTargetBps);
    }

    function fundReserve(uint256 serviceId, uint256 amountUsdc) external {
        require(services[serviceId].active, "Service inactive");
        require(usdc.transferFrom(msg.sender, address(this), amountUsdc), "Reserve transfer failed");
        services[serviceId].reserveBalanceUsdc += amountUsdc;
        emit ReserveFunded(serviceId, amountUsdc, services[serviceId].reserveBalanceUsdc);
    }

    function subscribe(uint256 serviceId) external {
        Service storage svc = services[serviceId];
        require(svc.active, "Service inactive");
        require(!isSubscribed[msg.sender][serviceId], "Already subscribed");
        require(usdc.transferFrom(msg.sender, svc.provider, svc.monthlyPriceUsdc), "Subscription payment failed");
        isSubscribed[msg.sender][serviceId] = true;
        serviceSubscribers[serviceId].push(msg.sender);
        emit Subscribed(serviceId, msg.sender, svc.monthlyPriceUsdc);
    }

    function recordOutage(uint256 serviceId, uint256 additionalDowntimeMinutes, bytes32 attestationHash) external {
        Service storage svc = services[serviceId];
        require(svc.active, "Service inactive");
        svc.downtimeMinutes += additionalDowntimeMinutes;
        if (svc.downtimeMinutes >= BILLING_WINDOW_MINUTES) {
            svc.currentUptimeBps = 0;
        } else {
            svc.currentUptimeBps = uint16(((BILLING_WINDOW_MINUTES - svc.downtimeMinutes) * 10000) / BILLING_WINDOW_MINUTES);
        }

        uint16 refundBps = 0;
        if (svc.currentUptimeBps < svc.slaTargetBps) {
            if (svc.currentUptimeBps < 9800) {
                refundBps = svc.severeRefundBps;
            } else if (svc.currentUptimeBps < 9900) {
                refundBps = svc.moderateRefundBps;
            } else {
                refundBps = svc.minorRefundBps;
            }
        }

        if (refundBps > 0) {
            uint256 refundPerSub = (svc.monthlyPriceUsdc * refundBps) / 10000;
            address[] storage subs = serviceSubscribers[serviceId];
            for (uint256 i = 0; i < subs.length; i++) {
                if (svc.reserveBalanceUsdc >= refundPerSub) {
                    svc.reserveBalanceUsdc -= refundPerSub;
                    claimableCompensation[subs[i]][serviceId] += refundPerSub;
                }
            }
        }

        emit OutageRecorded(serviceId, svc.downtimeMinutes, svc.currentUptimeBps, refundBps, attestationHash);
    }

    function claimCompensation(uint256 serviceId) external {
        uint256 owed = claimableCompensation[msg.sender][serviceId];
        require(owed > 0, "No compensation available");
        claimableCompensation[msg.sender][serviceId] = 0;
        require(usdc.transfer(msg.sender, owed), "Compensation transfer failed");
        emit CompensationClaimed(serviceId, msg.sender, owed);
    }
}
```

---

# PART 2: The "Vibe Coders: Thank Me Later" Free UI & MCP Guide

Here is the honest breakdown of every tool from the viral list, **which ones are 100% free with zero API keys or credit cards**, how to hook them into Claude, and how to use them when building UpHealth.

---

## A. 100% Free MCP Servers & Component Registries (Install & Use Freely)

### 1. `shadcn` MCP + `Magic UI` (`magicui.design`) + `React Bits` (`reactbits.dev`)
Instead of installing separate paid MCP servers, **both Magic UI and React Bits publish free official `shadcn`-compatible registries!**
- **Cost:** **$0 (100% Free, no API key, no account, no credit card).**
- **How to enable in Claude Code / Claude Desktop (`.mcp.json` or `claude_desktop_config.json`):**
  ```json
  {
    "mcpServers": {
      "shadcn": {
        "command": "npx",
        "args": ["-y", "shadcn@latest", "mcp"]
      }
    }
  }
  ```
- **How to enable inside your project's `components.json`:**
  Add the `@magicui` and `@react-bits` registries to `components.json`:
  ```json
  {
    "registries": {
      "@magicui": "https://magicui.design/r/{name}.json",
      "@react-bits": "https://reactbits.dev/r/{name}.json"
    }
  }
  ```
- **How to use them in UpHealth (Free items only: skip "Pro" items):**
  - **Magic UI (`@magicui`):** Use `animated-beam` (for showing USDC flowing from Provider Reserve to Consumer Wallet on Base!), `number-ticker` (for live uptime % and USDC balance counters), `bento-grid` (for architecture overview), `border-beam` (for active SLA breach cards), and `marquee` (for live Base Sepolia incident feed).
    - CLI command Claude can run: `npx shadcn@latest add "https://magicui.design/r/animated-beam.json"` or `npx shadcn@latest add "https://magicui.design/r/number-ticker.json"`.
  - **React Bits (`@react-bits`):** Use free text/motion components like `SplitText`, `CountUp`, `SpotlightCard`, or `Magnet` for tactile interactive buttons.

---

## B. 100% Free Direct Packages & Web Tools (No MCP Server Needed)

### 2. `lucide.dev` (`lucide-react`)
- **Cost:** **$0 (MIT License, 100% Free).**
- **Why it matters:** Replaces cheap-looking emojis (`🚀`, `💰`, `⚠️`, `✅`) with surgical vector icons (`Activity`, `ShieldCheck`, `AlertTriangle`, `Zap`, `ArrowUpRight`, `Database`, `Wallet`, `RefreshCw`, `Radio`).
- **How Claude uses it:** `npm install lucide-react` and import icons directly.

### 3. `uiverse.io`
- **Cost:** **$0 (MIT License, Open Source UI Elements).**
- **Why it matters:** Great for tactile switches, glowing status toggles, and pulse indicators.
- **How Claude uses it:** No MCP server needed. Use Uiverse's open-source Tailwind/CSS patterns (or their official GitHub repo `github.com/uiverse-io/galaxy`) for the **"Simulate Outage"** toggle switch and live status radar pulse.

### 4. `realtimecolors.com`
- **Cost:** **$0 (Free Web Tool).**
- **How we already applied it for UpHealth:** We used RealtimeColors contrast rules to lock in UpHealth's anti-purple palette in `MOTION.md`:
  - Background: `#090D10` (Obsidian)
  - Surface: `#11171D`
  - Text: `#F3F6F8`
  - Primary Accent: `#0052FF` (Base Electric Blue)
  - Secondary Accent: `#10B981` (Signal Emerald)
  - Danger/Outage: `#EF4444` (Crimson)

### 5. `fontjoy.com`
- **Cost:** **$0 (Free Google Fonts Pairing Tool).**
- **How we already applied it for UpHealth:**
  - Heading Font: `Space Grotesk` (bold geometric tech authority)
  - Body Font: `Inter` (clean legibility)
  - Telemetry / Numbers Font: `JetBrains Mono` (tabular numerals for uptime `99.95%` and `$10.00 USDC`)

### 6. `haikei.app`
- **Cost:** **$0 (Free Basic Web Generator: no signup required for SVG export).**
- **How to use it:** Use clean layered SVG waves, subtle telemetry grids, and contour paths directly in JSX for section dividers and the live Heartbeat Oscilloscope background.

### 7. `undraw.co`
- **Cost:** **$0 (Free open-source SVG illustrations you can recolor to `#0052FF` / `#10B981`).**
- **Important rule:** Do NOT build an automated scraper/MCP for unDraw (their license forbids automated scraping). Simply download an SVG manually from `undraw.co` if needed, or let Claude generate custom inline technical SVG telemetry diagrams.

---

## C. Tools with Strict Free Quotas or Paid Walls (Know Before You Click!)

### 8. `21st.dev` (`@21st-dev/magic` MCP)
- **Is it free?** **Freemium with a tight daily cap.**
  - Browsing/searching components on `https://21st.dev` in your browser and copying the code manually is **free**.
  - However, their **MCP server (`@21st-dev/magic`) requires an API key and limits free accounts to only ~2 component generations/retrievals per day** before asking you to pay for a monthly plan.
- **Best strategy for zero cost:** Browse `21st.dev` on the web for free and copy-paste any component code you like into your chat with Claude, **OR** stick to the unlimited free `@magicui` + `@react-bits` + `shadcn` MCP setup above!

### 9. `mobbin.com`
- **Is it free?** **Paid (Free tier is very limited browsing; Mobbin MCP requires a paid subscription).**
- **Best strategy:** Do not install Mobbin MCP. We already extracted the layout inspiration (Linear + BetterStack + Stripe telemetry) directly into `MOTION.md`.

### 10. `lottiefiles.com`
- **Is it free?** **Limited Free Quota** (Free workspaces only allow 5 downloads total).
- **Best strategy:** Use `framer-motion` + custom animated SVG paths for UpHealth's heartbeat and USDC flow animations-they load faster, never hit quota limits, and react dynamically to your real app state!
