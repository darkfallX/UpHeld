import type { Metadata } from "next";
import { ChaosTheater } from "@/components/demo/chaos-theater";

export const metadata: Metadata = { title: "Chaos Theater · UpHeld" };

export default function DemoPage() {
  return <ChaosTheater />;
}
