"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { getCurrentUser } from "@/actions/user.actions";
import {
  applyThemeToDocument,
  DEFAULT_CATPPUCCIN_ACCENT,
  DEFAULT_PRIMARY_COLOR,
  isCatppuccinAccent,
  isThemeId,
  persistThemeClient,
  type ThemeSelection,
} from "@/lib/theme";

function readLocalSelection(): ThemeSelection {
  const themeIdValue = localStorage.getItem("themeId");
  const accentValue = localStorage.getItem("catppuccinAccent");
  return {
    themeId: isThemeId(themeIdValue) ? themeIdValue : "default",
    variant: localStorage.getItem("theme") === "dark" ? "dark" : "light",
    primaryColor: localStorage.getItem("primaryColor") || DEFAULT_PRIMARY_COLOR,
    catppuccinAccent: isCatppuccinAccent(accentValue) ? accentValue : DEFAULT_CATPPUCCIN_ACCENT,
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    applyThemeToDocument(readLocalSelection());
    if (!session?.user?.id || (typeof navigator !== "undefined" && !navigator.onLine)) return;

    const syncTheme = async () => {
      try {
        const result = await getCurrentUser();
        if (!result.success || !result.data) return;
        const user = result.data;
        const selection: ThemeSelection = {
          themeId: isThemeId(user.themeId) ? user.themeId : "default",
          variant: user.darkMode ? "dark" : "light",
          primaryColor: user.primaryColor || DEFAULT_PRIMARY_COLOR,
          catppuccinAccent: isCatppuccinAccent(user.catppuccinAccent) ? user.catppuccinAccent : DEFAULT_CATPPUCCIN_ACCENT,
        };
        applyThemeToDocument(selection);
        persistThemeClient(selection);
        document.documentElement.style.transition = "color 300ms ease, background-color 300ms ease";
      } catch (error) {
        console.error("Error al sincronizar tema:", error);
      }
    };
    syncTheme();
  }, [session?.user?.id]);

  useEffect(() => {
    const handleStorage = () => applyThemeToDocument(readLocalSelection());
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return <>{children}</>;
}
