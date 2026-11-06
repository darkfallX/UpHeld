import type { Metadata } from "next";
import { ConsumerDashboard } from "@/components/app/consumer-dashboard";

export const metadata: Metadata = { title: "Consumer · UpHeld" };

export default function Page() {
  return <ConsumerDashboard />;
}
