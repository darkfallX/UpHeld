import { createCoinbaseWalletSDK } from "@coinbase/wallet-sdk";
import { injected } from "@wagmi/core";
import { createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { BASE_SEPOLIA } from "./chain";

type Eip1193 = ReturnType<ReturnType<typeof createCoinbaseWalletSDK>["getProvider"]>;
let cbProvider: Eip1193 | undefined;

/** Coinbase Smart Wallet (passkeys, no extension) via the official SDK, exposed through wagmi's injected connector. */
export const CB_OPT_IN_KEY = "upheld.coinbaseSmartWallet";

/** Lazily created only after the user picks Coinbase Smart Wallet (avoids SDK telemetry on every page load). */
function coinbaseSmartWalletProvider(): Eip1193 | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    if (window.localStorage.getItem(CB_OPT_IN_KEY) !== "1") return undefined;
  } catch {
    return undefined;
  }
  if (!cbProvider) {
    cbProvider = createCoinbaseWalletSDK({
      appName: "UpHeld",
      appChainIds: [BASE_SEPOLIA.chainId],
      preference: { options: "smartWalletOnly", telemetry: false },
    }).getProvider();
  }
  return cbProvider;
}

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  // EIP-6963 discovery adds every installed browser wallet (MetaMask, Rabby, Coinbase extension…)
  multiInjectedProviderDiscovery: true,
  connectors: [
    injected({ shimDisconnect: true }),
    injected({
      shimDisconnect: true,
      target: () => ({
        id: "coinbaseSmartWallet",
        name: "Coinbase Smart Wallet",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        provider: (() => coinbaseSmartWalletProvider()) as any,
      }),
    }),
  ],
  transports: { [baseSepolia.id]: http(BASE_SEPOLIA.rpcUrl) },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
