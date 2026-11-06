import type { Metadata } from "next";
import { ContractsExplorer } from "@/components/app/contracts-explorer";

export const metadata: Metadata = { title: "Contracts · UpHeld" };

export default function Page() {
  return <ContractsExplorer />;
}
