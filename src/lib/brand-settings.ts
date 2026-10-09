import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

export type BrandSettings = {
  logoLight: string | null;
  logoDark: string | null;
  favicon: string | null;
};

export const BRAND_SETTINGS_TAG = "brand-settings";

const EMPTY_BRAND: BrandSettings = { logoLight: null, logoDark: null, favicon: null };

// Los logos son públicos (se ven en sign-in) y casi nunca cambian: se leen una
// vez por hora en el servidor en lugar de pedirlos desde cada componente cliente.
export const getCachedBrandSettings = unstable_cache(
  async (): Promise<BrandSettings> => {
    try {
      const row = await db.globalConfig.findUnique({ where: { key: "brand_settings" } });
      if (!row) return EMPTY_BRAND;
      const parsed = JSON.parse(row.value) as Partial<Record<keyof BrandSettings, string>>;
      return {
        logoLight: parsed.logoLight || null,
        logoDark: parsed.logoDark || null,
        favicon: parsed.favicon || null,
      };
    } catch {
      return EMPTY_BRAND;
    }
  },
  ["brand-settings-public"],
  { revalidate: 3600, tags: [BRAND_SETTINGS_TAG] }
);
