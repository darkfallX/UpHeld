"use client";

import { useReducedMotion as useFramerReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Hydration-safe prefers-reduced-motion: renders the server markup (false) on the first
 * client pass, then switches to the user's real preference after mount.
 */
export function useReducedMotion(): boolean {
  const pref = useFramerReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? !!pref : false;
}
