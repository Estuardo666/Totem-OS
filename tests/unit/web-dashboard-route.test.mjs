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

test("las barras del shell limitan el glass activo a la selección", () => {
  const nativeTabBar = readFileSync(resolve(root, "ios/TotemOS/TotemOS/Shell/ShellTabBarView.swift"), "utf8");
  const designSystem = readFileSync(resolve(root, "ios/TotemOS/TotemOS/TotemDesignSystem.swift"), "utf8");
  assert.match(nativeTabBar, /glassEffectID\(isSelected \? "shell-tab-selection"/);
  assert.match(nativeTabBar, /TotemGlassContainer\(spacing: 8\)/);
  assert.doesNotMatch(nativeTabBar, /matchedGeometryEffect\(id:/);
  assert.match(nativeTabBar, /ShellTabButtonStyle/);
  assert.match(nativeTabBar, /scaleEffect\(isInteracting \? 1\.12/);
  assert.match(designSystem, /glassEffect\(\.regular, in: shape\)/);
  assert.match(designSystem, /glassEffect\(\.regular\.tint\(tint\)\.interactive\(\), in: shape\)/);
});

test("el header deja controles libres bajo la isla con blur progresivo", () => {
  const nativeHeader = readFileSync(resolve(root, "ios/TotemOS/TotemOS/Shell/ShellHeaderView.swift"), "utf8");
  const nativeOverlay = readFileSync(resolve(root, "ios/TotemOS/TotemOS/Shell/NativeShellOverlay.swift"), "utf8");
  assert.match(nativeHeader, /private var leftControls/);
  assert.match(nativeHeader, /private var rightControls/);
  assert.doesNotMatch(nativeHeader, /ProgressiveHeaderBlur/);
  assert.doesNotMatch(nativeHeader, /totemShellGlass\(/);
  assert.match(nativeOverlay, /ProgressiveHeaderBlurView/);
  assert.match(nativeOverlay, /color: \.black, location: 0/);
  assert.doesNotMatch(nativeOverlay, /backgroundExtensionEffect/);
  assert.match(nativeOverlay, /ignoresSafeArea\(edges: \.bottom\)/);
});

test("la transacción React informa a Swift para restaurar el dashboard nativo al cerrar", () => {
  const nativeProvider = readFileSync(resolve(root, "src/components/providers/native-shell-provider.tsx"), "utf8");
  const coordinator = readFileSync(resolve(root, "ios/TotemOS/TotemOS/ShellBridge.swift"), "utf8");
  assert.match(nativeProvider, /__totemTransactionOpen/);
  assert.match(coordinator, /monitorTransactionDialog/);
  assert.match(coordinator, /restoreNativeDashboardAfterTransaction/);
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
