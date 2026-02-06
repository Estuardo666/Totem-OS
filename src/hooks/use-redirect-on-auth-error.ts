"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { ApiResponse, ActionResponse } from "@/types";

/**
 * Hook para manejar errores de autenticación automáticamente
 * Detecta si un error es por falta de autenticación y redirige a /sign-in
 * 
 * Uso:
 * const handleAuthError = useRedirectOnAuthError();
 * const result = await someAction();
 * handleAuthError(result); // Si es autenticación, redirige automáticamente
 */
export function useRedirectOnAuthError() {
  const router = useRouter();

  return useCallback(
    <T,>(response: ApiResponse<T> | ActionResponse<T> | { success: boolean; error?: string }) => {
      if (!response.success && response.error) {
        // Detectar error de autenticación
        if (
          response.error.toLowerCase().includes("no autenticado") ||
          response.error.toLowerCase().includes("not authenticated") ||
          response.error.toLowerCase().includes("unauthorized") ||
          response.error.toLowerCase().includes("no sesión") ||
          response.error.toLowerCase().includes("sesión expirada")
        ) {
          // Redirigir a sign-in después de un pequeño delay para que se vea el toast
          setTimeout(() => {
            router.push("/sign-in");
            router.refresh();
          }, 500);
          return true; // Indica que fue un error de autenticación
        }
      }
      return false; // No fue error de autenticación
    },
    [router]
  );
}
