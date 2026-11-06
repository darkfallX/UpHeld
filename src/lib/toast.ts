"use client";
import { create } from "zustand";
import type { Receipt } from "./types";

export type ToastTone = "success" | "error" | "info";
export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
  receipt?: Receipt;
}

interface ToastState {
  toasts: Toast[];
  receiptOpen: Receipt | null;
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
  openReceipt: (r: Receipt | null) => void;
}

let seq = 0;
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  receiptOpen: null,
  push: (t) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts.slice(-1), { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.tone === "error" ? 6000 : 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  openReceipt: (r) => set({ receiptOpen: r }),
}));

export const toast = {
  success: (title: string, body?: string, receipt?: Receipt) => useToasts.getState().push({ tone: "success", title, body, receipt }),
  error: (title: string, body?: string) => useToasts.getState().push({ tone: "error", title, body }),
  info: (title: string, body?: string) => useToasts.getState().push({ tone: "info", title, body }),
};
