import { test, expect, type Page } from "@playwright/test";

const NATIVE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 "
  + "(KHTML, like Gecko) Mobile/15E148 TotemOS-iOS";

/**
 * Reproduce lo que hace el `WKWebView`: marca el documento antes de renderizar
 * y expone el canal `totemShell` para recibir los snapshots.
 */
async function installNativeShellBridge(page: Page, ready = true) {
  await page.addInitScript((shellReady) => {
    const scope = window as unknown as Record<string, unknown>;
    scope.__TOTEM_NATIVE_SHELL__ = true;
    scope.__totemShellSnapshots = [] as string[];
    scope.webkit = {
      messageHandlers: {
        totemShell: {
          postMessage(value: string) {
            (scope.__totemShellSnapshots as string[]).push(value);
          },
        },
      },
    };
    document.documentElement.setAttribute("data-totem-native-shell", "1");
    if (shellReady) {
      document.documentElement.setAttribute("data-totem-native-shell-ready", "1");
    }
  }, ready);
}

async function latestSnapshot(page: Page) {
  return page.evaluate(() => {
    const snapshots = (window as unknown as Record<string, unknown>)
      .__totemShellSnapshots as string[] | undefined;
    if (!snapshots?.length) return null;
    return JSON.parse(snapshots[snapshots.length - 1]) as Record<string, unknown>;
  });
}

test.describe("web móvil y PWA", () => {
  test("conservan navbar, sidebar y botón flotante", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // El contenedor de la navbar no tiene caja propia: su contenido es fijo.
    await expect(page.locator("[data-mobile-navbar]")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Abrir menú" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar transacción" })).toBeVisible();
  });
});

test.describe("app nativa TotemOS-iOS", () => {
  test.use({ userAgent: NATIVE_USER_AGENT });

  test("oculta el chrome web y publica el snapshot", async ({ page }) => {
    await installNativeShellBridge(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("[data-mobile-navbar]")).toBeHidden();
    await expect(page.getByRole("button", { name: "Registrar transacción" })).toBeHidden();
    await expect(page.getByText(/añade esta app a tu pantalla de inicio/i)).toHaveCount(0);

    await expect.poll(async () => (await latestSnapshot(page))?.version).toBe(1);

    const snapshot = await latestSnapshot(page);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.route).toBe("/");
    expect(Array.isArray(snapshot!.navigation)).toBe(true);
    expect((snapshot!.tabs as Array<{ label: string }>).map((tab) => tab.label)).toEqual([
      "Inicio",
      "Tareas",
      "Finanzas",
      "Clientes",
    ]);
  });

  test("conserva el chrome web hasta que Swift confirma que está listo", async ({ page }) => {
    await installNativeShellBridge(page, false);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("[data-mobile-navbar]")).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar transacción" })).toBeVisible();
  });

  test("responde a los comandos de navegación y transacción", async ({ page }) => {
    await installNativeShellBridge(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect.poll(async () => (await latestSnapshot(page))?.version).toBe(1);

    const dispatch = (command: Record<string, unknown>) => page.evaluate(
      (value) => {
        const fn = (window as unknown as Record<string, unknown>).__totemShellDispatch;
        return typeof fn === "function"
          ? (fn as (input: unknown) => Promise<boolean>)(value)
          : Promise.resolve(false);
      },
      command,
    );

    expect(await dispatch({ type: "navigate", route: "/clients" })).toBe(true);
    await expect.poll(async () => (await latestSnapshot(page))?.route).toBe("/clients");

    // Los comandos desconocidos o con rutas fuera del menú se descartan.
    expect(await dispatch({ type: "navigate", route: "https://example.com" })).toBe(false);
    expect(await dispatch({ type: "eval", code: "1" })).toBe(false);

    expect(await dispatch({ type: "openTransaction", tab: "expense" })).toBe(true);
    await expect(page.getByRole("dialog").getByText("Nueva Transacción")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Gasto" })).toHaveAttribute("data-state", "active");
    // Mientras el formulario está abierto el shell nativo se oculta.
    await expect.poll(async () => (await latestSnapshot(page))?.overlayHidden).toBe(true);
  });

  test("alterna el tema desde el shell nativo", async ({ page }) => {
    await installNativeShellBridge(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect.poll(async () => (await latestSnapshot(page))?.version).toBe(1);

    const before = (await latestSnapshot(page))?.theme;
    await page.evaluate(() => {
      const fn = (window as unknown as Record<string, unknown>).__totemShellDispatch;
      return (fn as (input: unknown) => Promise<boolean>)({ type: "toggleTheme" });
    });

    await expect.poll(async () => (await latestSnapshot(page))?.theme).not.toBe(before);
  });
});
