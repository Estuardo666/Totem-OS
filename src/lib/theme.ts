export const DEFAULT_PRIMARY_COLOR = "#27221F";
export const DEFAULT_GRADIENT_COLOR = "#6366f1";
export const PRIMARY_COLOR_COOKIE = "primaryColor";
export const THEME_ID_COOKIE = "themeId";
export const CATPPUCCIN_ACCENT_COOKIE = "catppuccinAccent";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const PRIMARY_COLOR_COOKIE_MAX_AGE = THEME_COOKIE_MAX_AGE;
export const LIGHT_PRIMARY_FOREGROUND_HSL = "22 11% 14%";
export const DARK_PRIMARY_FOREGROUND_HSL = "0 0% 100%";

export const THEME_IDS = ["default", "catppuccin"] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export type ThemeVariant = "light" | "dark";

export const CATPPUCCIN_ACCENTS = [
  "rosewater", "flamingo", "pink", "mauve", "red", "maroon", "peach",
  "yellow", "green", "teal", "sky", "sapphire", "blue", "lavender",
] as const;
export type CatppuccinAccent = (typeof CATPPUCCIN_ACCENTS)[number];
export const DEFAULT_CATPPUCCIN_ACCENT: CatppuccinAccent = "mauve";

type CatppuccinFlavor = Record<CatppuccinAccent | "text" | "subtext1" | "subtext0" | "overlay2" | "overlay1" | "overlay0" | "surface2" | "surface1" | "surface0" | "base" | "mantle" | "crust", string>;

// Catppuccin palette v1.8.0: https://github.com/catppuccin/palette
export const CATPPUCCIN_PALETTES: Record<ThemeVariant, CatppuccinFlavor> = {
  light: {
    rosewater: "#dc8a78", flamingo: "#dd7878", pink: "#ea76cb", mauve: "#8839ef",
    red: "#d20f39", maroon: "#e64553", peach: "#fe640b", yellow: "#df8e1d",
    green: "#40a02b", teal: "#179299", sky: "#04a5e5", sapphire: "#209fb5",
    blue: "#1e66f5", lavender: "#7287fd", text: "#4c4f69", subtext1: "#5c5f77",
    subtext0: "#6c6f85", overlay2: "#7c7f93", overlay1: "#8c8fa1", overlay0: "#9ca0b0",
    surface2: "#acb0be", surface1: "#bcc0cc", surface0: "#ccd0da", base: "#eff1f5",
    mantle: "#e6e9ef", crust: "#dce0e8",
  },
  dark: {
    rosewater: "#f5e0dc", flamingo: "#f2cdcd", pink: "#f5c2e7", mauve: "#cba6f7",
    red: "#f38ba8", maroon: "#eba0ac", peach: "#fab387", yellow: "#f9e2af",
    green: "#a6e3a1", teal: "#94e2d5", sky: "#89dceb", sapphire: "#74c7ec",
    blue: "#89b4fa", lavender: "#b4befe", text: "#cdd6f4", subtext1: "#bac2de",
    subtext0: "#a6adc8", overlay2: "#9399b2", overlay1: "#7f849c", overlay0: "#6c7086",
    surface2: "#585b70", surface1: "#45475a", surface0: "#313244", base: "#1e1e2e",
    mantle: "#181825", crust: "#11111b",
  },
};

const HEX_COLOR_REGEX = /^#?[0-9a-fA-F]{6}$/;

export function isThemeId(value?: string | null): value is ThemeId {
  return value === "default" || value === "catppuccin";
}

export function isCatppuccinAccent(value?: string | null): value is CatppuccinAccent {
  return CATPPUCCIN_ACCENTS.includes(value as CatppuccinAccent);
}

export function sanitizeHexColor(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!HEX_COLOR_REGEX.test(trimmed)) return null;
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

export function hexToHsl(hex: string): string {
  const sanitized = sanitizeHexColor(hex) ?? DEFAULT_PRIMARY_COLOR;
  const normalized = sanitized.replace("#", "");
  const r = parseInt(normalized.substring(0, 2), 16) / 255;
  const g = parseInt(normalized.substring(2, 4), 16) / 255;
  const b = parseInt(normalized.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function hexToRgb(hex: string) {
  const normalized = (sanitizeHexColor(hex) ?? DEFAULT_PRIMARY_COLOR).replace("#", "");
  return { r: parseInt(normalized.substring(0, 2), 16) / 255, g: parseInt(normalized.substring(2, 4), 16) / 255, b: parseInt(normalized.substring(4, 6), 16) / 255 };
}

function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const [red, green, blue] = [r, g, b].map((channel) => channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function getPrimaryForegroundHsl(hex: string): string {
  return getRelativeLuminance(hex) > 0.58 ? LIGHT_PRIMARY_FOREGROUND_HSL : DARK_PRIMARY_FOREGROUND_HSL;
}

export function normalizeThemePrimaryColor(value?: string | null): string {
  const sanitized = sanitizeHexColor(value) ?? DEFAULT_PRIMARY_COLOR;
  return getRelativeLuminance(sanitized) > 0.92 ? DEFAULT_PRIMARY_COLOR : sanitized;
}

export function resolvePrimaryColor(value?: string | null) {
  const hex = normalizeThemePrimaryColor(value);
  return { hex, hsl: hexToHsl(hex), foregroundHsl: getPrimaryForegroundHsl(hex) };
}

export interface ThemeSelection {
  themeId: ThemeId;
  variant: ThemeVariant;
  primaryColor: string;
  catppuccinAccent: CatppuccinAccent;
}

export function getThemeCssVariables(selection: ThemeSelection): Record<string, string> {
  if (selection.themeId === "default") {
    const primary = resolvePrimaryColor(selection.primaryColor);
    return {
      "--primary": primary.hsl,
      "--primary-color": primary.hex,
      "--primary-foreground": primary.foregroundHsl,
      "--gradient-accent": hexToHsl(primary.hex.toLowerCase() === DEFAULT_PRIMARY_COLOR.toLowerCase() ? DEFAULT_GRADIENT_COLOR : primary.hex),
      "--accent": selection.variant === "dark" ? "23 1% 16%" : "220 20% 96%",
      "--accent-foreground": selection.variant === "dark" ? "0 0% 98%" : "22 11% 14%",
    };
  }
  const p = CATPPUCCIN_PALETTES[selection.variant];
  const primaryHex = p[selection.catppuccinAccent];
  const hsl = (key: keyof CatppuccinFlavor) => hexToHsl(p[key]);
  const isDark = selection.variant === "dark";
  return {
    "--background": isDark ? hsl("base") : "0 0% 100%", "--foreground": hsl("text"),
    "--card": isDark ? hsl("mantle") : "0 0% 100%", "--card-foreground": hsl("text"),
    "--popover": hsl(isDark ? "crust" : "base"), "--popover-foreground": hsl("text"),
    "--primary": hexToHsl(primaryHex), "--primary-color": primaryHex, "--primary-foreground": hsl("base"), "--gradient-accent": hexToHsl(primaryHex),
    "--secondary": isDark ? hsl("mantle") : "0 0% 100%", "--secondary-foreground": hsl("text"),
    "--muted": isDark ? hsl("mantle") : "0 0% 100%", "--muted-foreground": hsl("subtext0"),
    "--accent": hsl("surface1"), "--accent-foreground": hsl("text"),
    "--destructive": hsl("red"), "--destructive-foreground": hsl("base"),
    "--border": hsl("surface1"), "--input": hsl("surface1"), "--ring": hexToHsl(primaryHex),
    "--chart-1": hsl("blue"), "--chart-2": hsl("green"), "--chart-3": hsl("peach"),
    "--chart-4": hsl("mauve"), "--chart-5": hsl("pink"),
    "--scroll-track": hsl("mantle"), "--scroll-thumb": hsl("surface2"),
    "--scroll-thumb-hover": hsl("overlay0"), "--scroll-corner": hsl("crust"),
    "--theme-success": hsl("green"), "--theme-success-foreground": hsl("base"),
    "--theme-warning": hsl("yellow"), "--theme-warning-foreground": hsl("crust"),
    "--theme-error": hsl("red"), "--theme-error-foreground": hsl("base"),
    "--theme-info": hsl("blue"), "--theme-info-foreground": hsl("base"), "--theme-peach": hsl("peach"),
    "--theme-rosewater": hsl("rosewater"), "--theme-pink": hsl("pink"), "--theme-mauve": hsl("mauve"),
    "--theme-green": hsl("green"), "--theme-teal": hsl("teal"), "--theme-sky": hsl("sky"),
    "--theme-sapphire": hsl("sapphire"), "--theme-blue": hsl("blue"), "--theme-lavender": hsl("lavender"),
  };
}

export function applyThemeToDocument(selection: ThemeSelection) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", selection.variant === "dark");
  root.dataset.theme = selection.themeId;
  root.dataset.themeVariant = selection.variant;
  const variables = getThemeCssVariables(selection);
  Object.entries(variables).forEach(([name, value]) => root.style.setProperty(name, value));
  // Clear preset-only overrides when returning to the current/default theme.
  if (selection.themeId === "default") {
    ["--background", "--foreground", "--card", "--card-foreground", "--popover", "--popover-foreground", "--secondary", "--secondary-foreground", "--muted", "--muted-foreground", "--accent", "--accent-foreground", "--destructive", "--destructive-foreground", "--border", "--input", "--ring", "--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--scroll-track", "--scroll-thumb", "--scroll-thumb-hover", "--scroll-corner", "--theme-success", "--theme-success-foreground", "--theme-warning", "--theme-warning-foreground", "--theme-error", "--theme-error-foreground", "--theme-info", "--theme-info-foreground", "--theme-peach", "--theme-rosewater", "--theme-pink", "--theme-mauve", "--theme-green", "--theme-teal", "--theme-sky", "--theme-sapphire", "--theme-blue", "--theme-lavender"].forEach((name) => root.style.removeProperty(name));
    Object.entries(variables).forEach(([name, value]) => root.style.setProperty(name, value));
  }
}

export function persistThemeClient(selection: ThemeSelection) {
  if (typeof window === "undefined") return;
  localStorage.setItem("themeId", selection.themeId);
  localStorage.setItem("theme", selection.variant);
  localStorage.setItem("primaryColor", resolvePrimaryColor(selection.primaryColor).hex);
  localStorage.setItem("catppuccinAccent", selection.catppuccinAccent);
  document.cookie = `${THEME_ID_COOKIE}=${selection.themeId}; Max-Age=${THEME_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
  document.cookie = `${CATPPUCCIN_ACCENT_COOKIE}=${selection.catppuccinAccent}; Max-Age=${THEME_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
  setPrimaryColorCookieClient(selection.primaryColor);
}

export function toggleThemeVariantClient(): ThemeSelection {
  const root = document.documentElement;
  const themeIdValue = root.dataset.theme || localStorage.getItem("themeId");
  const accentValue = localStorage.getItem("catppuccinAccent");
  const selection: ThemeSelection = {
    themeId: isThemeId(themeIdValue) ? themeIdValue : "default",
    variant: root.classList.contains("dark") ? "light" : "dark",
    primaryColor: localStorage.getItem("primaryColor") || DEFAULT_PRIMARY_COLOR,
    catppuccinAccent: isCatppuccinAccent(accentValue) ? accentValue : DEFAULT_CATPPUCCIN_ACCENT,
  };
  applyThemeToDocument(selection);
  persistThemeClient(selection);
  return selection;
}

export function setPrimaryColorCookieClient(value: string) {
  if (typeof document === "undefined") return;
  const sanitized = sanitizeHexColor(value);
  if (!sanitized) return;
  document.cookie = `${PRIMARY_COLOR_COOKIE}=${sanitized}; Max-Age=${PRIMARY_COLOR_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}
