import { useSyncExternalStore } from "react";

/** The hero's words. The page script owns the language and publishes them on window.__crHero, then fires "cr:hero". */
export interface Copy {
  lang: string;
  dir: "ltr" | "rtl";
  name: string;
  alt: string;
  role: string;
  status: string;
  place: string;
  wa: string;
  waLabel: string;
  seeWork: string;
  skip: string;
  drag: string;
  loading: string;
  close: string;
  reels: string;
  ads: string;
}

const FALLBACK: Copy = {
  lang: "en", dir: "ltr", name: "Chaker Redjil", alt: "شاكر رجيل",
  role: "QHSE engineer in training · School director · Digital marketer", status: "", place: "Khenchela, Algeria",
  wa: "", waLabel: "WhatsApp me", seeWork: "See my work", skip: "Skip intro", drag: "Drag to explore",
  loading: "Loading Reels", close: "Close", reels: "reels", ads: "AI video ads",
};

declare global {
  interface Window { __crHero?: Partial<Copy>; __dealCover?: boolean }
}

let snap: Copy = { ...FALLBACK, ...window.__crHero };
const subscribe = (cb: () => void) => {
  const on = () => { snap = { ...FALLBACK, ...window.__crHero }; cb(); };
  document.addEventListener("cr:hero", on);
  return () => document.removeEventListener("cr:hero", on);
};

export const useCopy = (): Copy => useSyncExternalStore(subscribe, () => snap);
