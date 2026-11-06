"use client";

import { create } from "zustand";

export type Theme = "dark" | "light";
export const THEME_KEY = "upheld-theme";

/** Runs in <head> before paint so the stored theme never flashes. */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark")t="dark";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

function current(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

interface ThemeState {
  theme: Theme;
  sync: () => void;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: "dark",
  sync: () => set({ theme: current() }),
  setTheme: (t) => {
    const root = document.documentElement;
    // cross-fade every color for the duration of the switch
    root.classList.add("theme-switching");
    root.setAttribute("data-theme", t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {}
    set({ theme: t });
    window.setTimeout(() => root.classList.remove("theme-switching"), 650);
  },
  toggle: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
}));
