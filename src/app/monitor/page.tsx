import type { Metadata } from "next";
import { MonitorDashboard } from "@/components/app/monitor-dashboard";

export const metadata: Metadata = { title: "Monitor · UpHeld" };

export default function Page() {
  return <MonitorDashboard />;
}
