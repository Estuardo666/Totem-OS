"use client";

import { Suspense, ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface LazySuspenseWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  height?: string;
}

/**
 * Wrapper para componentes lazy con Suspense boundary y fallback
 * Proporciona UX consistente mientras se carga el componente
 */
export function LazySuspenseWrapper({
  children,
  fallback,
  height = "200px",
}: LazySuspenseWrapperProps) {
  return (
    <Suspense
      fallback={
        fallback || (
          <div style={{ height }} className="space-y-2 p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        )
      }
    >
      {children}
    </Suspense>
  );
}

/**
 * Dialog-specific lazy wrapper (taller que el default)
 */
export function LazyDialogWrapper({
  children,
  fallback,
}: Omit<LazySuspenseWrapperProps, "height">) {
  return (
    <LazySuspenseWrapper height="400px" fallback={fallback}>
      {children}
    </LazySuspenseWrapper>
  );
}

/**
 * Table/List-specific lazy wrapper
 */
export function LazyListWrapper({
  children,
  fallback,
}: Omit<LazySuspenseWrapperProps, "height">) {
  return (
    <LazySuspenseWrapper height="600px" fallback={fallback}>
      {children}
    </LazySuspenseWrapper>
  );
}
