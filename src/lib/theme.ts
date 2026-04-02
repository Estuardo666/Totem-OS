export const DEFAULT_PRIMARY_COLOR = "#27221F";
export const PRIMARY_COLOR_COOKIE = "primaryColor";
export const PRIMARY_COLOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 año

const HEX_COLOR_REGEX = /^#?[0-9a-fA-F]{6}$/;

export function sanitizeHexColor(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!HEX_COLOR_REGEX.test(trimmed)) {
    return null;
  }
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
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  const hue = Math.round(h * 360);
  const saturation = Math.round(s * 100);
  const lightness = Math.round(l * 100);

  return `${hue} ${saturation}% ${lightness}%`;
}

export function resolvePrimaryColor(value?: string | null) {
  const hex = sanitizeHexColor(value) ?? DEFAULT_PRIMARY_COLOR;
  return {
    hex,
    hsl: hexToHsl(hex),
  };
}

export function setPrimaryColorCookieClient(value: string) {
  if (typeof document === "undefined") return;
  const sanitized = sanitizeHexColor(value);
  if (!sanitized) return;

  document.cookie = `${PRIMARY_COLOR_COOKIE}=${sanitized}; Max-Age=${PRIMARY_COLOR_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}
