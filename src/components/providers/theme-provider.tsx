"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { getCurrentUser } from "@/actions/user.actions";
import { setPrimaryColorCookieClient } from "@/lib/theme";

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

        // Sincronizar primaryColor con la variable CSS --primary
        // Convertir hex a HSL para que funcione con Tailwind
        const hexToHsl = (hex: string): string => {
          // Remover el #
          const r = parseInt(hex.slice(1, 3), 16) / 255;
          const g = parseInt(hex.slice(3, 5), 16) / 255;
          const b = parseInt(hex.slice(5, 7), 16) / 255;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          let h = 0;
          let s = 0;
          const l = (max + min) / 2;

          if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

            switch (max) {
              case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
              case g:
                h = ((b - r) / d + 2) / 6;
                break;
              case b:
                h = ((r - g) / d + 4) / 6;
                break;
            }
          }

          h = Math.round(h * 360);
          s = Math.round(s * 100);
          const lPercent = Math.round(l * 100);

          return `${h} ${s}% ${lPercent}%`;
        };

        const primaryHex = user.primaryColor || "#2563eb";
        const hslColor = hexToHsl(primaryHex);
        rootElement.style.setProperty("--primary", hslColor);
        rootElement.style.setProperty("--primary-color", primaryHex);

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

