"use client";
import { useEffect, useState } from "react";
import { useUpHeld } from "@/lib/store";

/** true once the persisted demo state has been read from localStorage */
export function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => {
    if (useUpHeld.persist.hasHydrated()) setH(true);
    const unsub = useUpHeld.persist.onFinishHydration(() => setH(true));
    return () => unsub();
  }, []);
  return h;
}
