import type { Metadata } from "next";
import { ProviderDashboard } from "@/components/app/provider-dashboard";

export const metadata: Metadata = { title: "Provider Console · UpHeld" };

export default function Page() {
  return <ProviderDashboard />;
}
