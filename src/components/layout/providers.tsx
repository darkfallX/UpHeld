"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { useLiveDeployment } from "@/lib/live-deployment";
import { useUpHeld } from "@/lib/store";
import { wagmiConfig } from "@/lib/wagmi";
import { ReceiptModal } from "./receipt-modal";
import { SmoothScroll } from "./smooth-scroll";
import { Toaster } from "./toaster";

function StateBoot() {
  useEffect(() => {
    void useUpHeld.persist.rehydrate();
    void useLiveDeployment.persist.rehydrate();
    const t = setInterval(() => useUpHeld.getState().tickRecovery(), 1000);
    return () => clearInterval(t);
  }, []);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } }));
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <MotionConfig reducedMotion="user">
          <StateBoot />
          <SmoothScroll>{children}</SmoothScroll>
          <Toaster />
          <ReceiptModal />
        </MotionConfig>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
