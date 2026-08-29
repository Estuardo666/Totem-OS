"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { createTotemQueryClient } from "@/lib/api-query";

export function ApiQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createTotemQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
