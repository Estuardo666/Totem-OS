import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const dashboardRoute = readFileSync(resolve(root, "src/app/(dashboard)/page.tsx"), "utf8");
const nativeDashboard = readFileSync(resolve(root, "ios/TotemOS/TotemOS/NativeDashboardView.swift"), "utf8");
const nativeContent = readFileSync(resolve(root, "ios/TotemOS/TotemOS/ContentView.swift"), "utf8");
const nativeWebView = readFileSync(resolve(root, "ios/TotemOS/TotemOS/WebAppView.swift"), "utf8");
const dashboardContract = readFileSync(resolve(root, "src/contracts/api-contracts.ts"), "utf8");

test("la portada web conserva el dashboard completo mientras Swift usa la API nativa", () => {
  assert.match(dashboardRoute, /HomeCommandCenter/);
  assert.match(dashboardRoute, /getTasks\(\)/);
  assert.match(dashboardRoute, /getClients\(\)/);
  assert.match(dashboardRoute, /getFinancialStats\(\)/);
  assert.match(dashboardRoute, /getReceivables\(\)/);
  assert.doesNotMatch(dashboardRoute, /ApiDashboardView/);
});

test("el shell conserva el WebView autenticado para navegar fuera del home nativo", () => {
  assert.match(nativeContent, /Keep the WKWebView mounted/);
  assert.match(nativeContent, /LegacyWebRouteView\(isVisible: !appCoordinator\.shouldUseNativeRoute && appCoordinator\.hasLoadedState\)/);
  assert.match(nativeContent, /opacity\(appCoordinator\.shouldUseNativeRoute \? 0\.001 : 1\)/);
  assert.match(nativeContent, /allowsHitTesting\(!appCoordinator\.shouldUseNativeRoute\)/);
  assert.match(nativeWebView, /webView\.isHidden = !isVisible/);
});

test("las barras del shell no crean una lente activa por cada item", () => {
  const nativeTabBar = readFileSync(resolve(root, "ios/TotemOS/TotemOS/Shell/ShellTabBarView.swift"), "utf8");
  const designSystem = readFileSync(resolve(root, "ios/TotemOS/TotemOS/TotemDesignSystem.swift"), "utf8");
  assert.doesNotMatch(nativeTabBar, /matchedGeometryEffect\(id: "shell-tab-selection"/);
  assert.match(designSystem, /background\(Color\.clear, in: shape\)/);
});

test("la API tiene timeout para cerrar el refresh aunque el servidor no responda", () => {
  const apiClient = readFileSync(resolve(root, "ios/TotemOS/TotemOSKit/GeneratedAPIClient.swift"), "utf8");
  assert.match(apiClient, /request\.timeoutInterval = 15/);
});

test("el contrato nativo transporta paleta React e imágenes del dashboard", () => {
  for (const field of [
    "themeId", "catppuccinAccent", "backgroundColor", "cardColor",
    "foregroundColor", "secondaryTextColor", "surfaceColor", "borderColor",
    "logoUrl", "imageUrl", "clientLogoUrl", "userImageUrl",
  ]) {
    assert.match(dashboardContract, new RegExp(field));
  }
});

test("el dashboard Swift conserva los bloques funcionales del dashboard React", () => {
  for (const section of [
    "Agenda de hoy",
    "Requieren atención",
    "Pipeline de contenido",
    "Capacidad del equipo",
    "Esperando aprobación",
    "Resumen financiero",
    "Próximas entregas",
    "Rendimiento del mes",
  ]) {
    assert.match(nativeDashboard, new RegExp(section));
  }

  for (const metric of [
    "Ingresos del mes",
    "Saldo pendiente",
    "Vencidas en edición",
    "Vencidas publicación",
    "Contenido publicado",
  ]) {
    assert.match(nativeDashboard, new RegExp(metric));
  }
});
