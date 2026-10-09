"use client";

import { createContext, useContext } from "react";
import type { BrandSettings } from "@/lib/brand-settings";

const BrandSettingsContext = createContext<BrandSettings | null>(null);

export function BrandSettingsProvider({
  value,
  children,
}: {
  value: BrandSettings;
  children: React.ReactNode;
}) {
  return <BrandSettingsContext.Provider value={value}>{children}</BrandSettingsContext.Provider>;
}

export function useBrandSettings() {
  return useContext(BrandSettingsContext);
}
