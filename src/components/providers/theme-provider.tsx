"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { getCurrentUser } from "@/actions/user.actions";
import { resolvePrimaryColor, setPrimaryColorCookieClient } from "@/lib/theme";

/**
 * ThemeProvider que sincroniza darkMode y primaryColor desde la BD
 * con las clases CSS y variables CSS globales
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user?.id) return;

    const syncTheme = async () => {
      try {
        const result = await getCurrentUser();
        if (!result.success || !result.data) return;

        const user = result.data;
        const htmlElement = document.documentElement;
        const rootElement = document.documentElement;

        // Sincronizar darkMode con la clase .dark
        if (user.darkMode) {
          htmlElement.classList.add("dark");
          localStorage.setItem('theme', 'dark');
        } else {
          htmlElement.classList.remove("dark");
          localStorage.setItem('theme', 'light');
        }

        const { hex: primaryHex, hsl, foregroundHsl } = resolvePrimaryColor(user.primaryColor);
        rootElement.style.setProperty("--primary", hsl);
        rootElement.style.setProperty("--primary-color", primaryHex);
        rootElement.style.setProperty("--primary-foreground", foregroundHsl);

        try {
          localStorage.setItem("primaryColor", primaryHex);
          setPrimaryColorCookieClient(primaryHex);
        } catch (_) {}

        // Aplicar transición suave al body
        rootElement.style.transition = "color 300ms ease, background-color 300ms ease";
      } catch (error) {
        console.error("Error al sincronizar tema:", error);
      }
    };

    syncTheme();
  }, [session?.user?.id]);

  return <>{children}</>;
}

