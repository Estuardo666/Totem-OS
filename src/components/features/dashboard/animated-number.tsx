"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/currency-format";

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function formatValue(value: number, kind: "number" | "currency") {
  return kind === "currency" ? formatCurrency(value) : numberFormatter.format(value);
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
