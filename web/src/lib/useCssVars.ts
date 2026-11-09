"use client";

import { useEffect, useState } from "react";

/**
 * Resolves CSS custom properties to concrete colors. Needed where a library
 * writes colors into SVG attributes (Leaflet, Recharts), which cannot read
 * `var(--x)`. Re-resolves when the OS light/dark preference changes.
 */
export function useCssVars<K extends string>(names: readonly K[]): Record<K, string> {
  const read = () => {
    const out = {} as Record<K, string>;
    if (typeof window === "undefined") return out;
    const cs = getComputedStyle(document.documentElement);
    for (const n of names) out[n] = cs.getPropertyValue(`--${n}`).trim();
    return out;
  };
  const [vals, setVals] = useState<Record<K, string>>(read);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setVals(read());
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
    // names is a module-level constant at every call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return vals;
}
