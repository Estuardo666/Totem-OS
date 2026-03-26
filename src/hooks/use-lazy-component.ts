import { lazy, ComponentType, LazyExoticComponent } from "react";

/**
 * Hook para crear lazy components con mejor manejo de tipos
 * Uso: const LazyDialog = useLazyComponent(() => import("@/components/dialogs/create-expense"));
 */
export function useLazyComponent<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>
): LazyExoticComponent<ComponentType<P>> {
  return lazy(importFn);
}

/**
 * Map de componentes lazy pre-configurados para uso en toda la app
 * Esto permite centralizar imports costosos y reutilizarlos
 */
export const LAZY_COMPONENTS = {
  // Finance
  CreateExpenseDialog: lazy(() =>
    import("@/components/features/finance/create-expense-dialog").then((m) => ({
      default: m.CreateExpenseDialog,
    }))
  ),

  // Shoots/Rodajes
  ShootsCalendar: lazy(() =>
    import("@/components/features/shoots/shoots-calendar").then((m) => ({
      default: m.ShootsCalendar,
    }))
  ),
} as const;
