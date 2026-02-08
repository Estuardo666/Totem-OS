/**
 * Utilidades para optimizar listas y tablas
 * Proporciona memoización inteligente de filas
 */

import React, { useMemo, useCallback } from "react";

/**
 * Hook para memoizar datos de lista con dependencias controladas
 * Evita re-renders innecesarios cuando los datos no cambian
 */
export function useMemoizedList<T extends { id: string | number }>(
  items: T[],
  dependencies?: React.DependencyList
) {
  return useMemo(() => items, dependencies ? [...dependencies] : [items]);
}

/**
 * Hook para crear funciones de callback estables en listas
 * Previene re-renders de child components que reciben callbacks como props
 */
export function useListCallbacks<T extends { id: string | number }>(
  onSelect?: (item: T) => void,
  onDelete?: (id: string | number) => void,
  onEdit?: (item: T) => void
) {
  const handleSelect = useCallback((item: T) => {
    onSelect?.(item);
  }, [onSelect]);

  const handleDelete = useCallback((id: string | number) => {
    onDelete?.(id);
  }, [onDelete]);

  const handleEdit = useCallback((item: T) => {
    onEdit?.(item);
  }, [onEdit]);

  return { handleSelect, handleDelete, handleEdit };
}

/**
 * HOC para memoizar row components en listas
 * Compara props anteriores y solo re-renderiza si cambian
 */
export function withListItemMemo<P extends { id: string | number }>(
  Component: React.ComponentType<P>
) {
  return React.memo(Component, (prevProps, nextProps) => {
    // Retorna true si props son iguales (no re-render)
    // Compara solo propiedades relevantes, ignorando funciones que siempre cambian
    return (
      prevProps.id === nextProps.id &&
      JSON.stringify(prevProps) === JSON.stringify(nextProps)
    );
  });
}

/**
 * Hook para virtualizar listas largas
 * Útil para listas con 100+ items
 * Nota: requiere react-window como dependencia
 */
interface UseVirtualListOptions {
  itemCount: number;
  itemHeight: number;
  containerHeight: number;
}

export function useVirtualListConfig({
  itemCount,
  itemHeight,
  containerHeight,
}: UseVirtualListOptions) {
  return useMemo(
    () => ({
      itemCount,
      itemHeight,
      height: containerHeight,
      width: "100%",
    }),
    [itemCount, itemHeight, containerHeight]
  );
}

/**
 * Nota: Para componentes JSX, ver user-list-row.tsx que tiene UserRow y UserList
 * Este archivo contiene solo hooks de optimización de rendimiento
 */
