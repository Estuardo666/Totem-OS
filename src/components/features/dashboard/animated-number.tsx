"use client";

import { useEffect, useState } from "react";

function formatValue(value: number, kind: "number" | "currency") {
  return new Intl.NumberFormat("en-US", kind === "currency"
    ? { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : { maximumFractionDigits: 0 }
  ).format(value);
}

export function AnimatedNumber({ value, kind = "number" }: { value: number; kind?: "number" | "currency" }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || value === 0) {
      setDisplayValue(value);
      return;
    }

    const startedAt = performance.now();
    const duration = 900;
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span>{formatValue(displayValue, kind)}</span>;
}
