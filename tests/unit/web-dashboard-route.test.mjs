import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const dashboardRoute = readFileSync(resolve(root, "src/app/(dashboard)/page.tsx"), "utf8");
const nativeDashboard = readFileSync(resolve(root, "ios/TotemOS/TotemOS/NativeDashboardView.swift"), "utf8");
const nativeContent = readFileSync(resolve(root, "ios/TotemOS/TotemOS/ContentView.swift"), "utf8");
const nativeWebView = readFileSync(resolve(root, "ios/TotemOS/TotemOS/WebAppView.swift"), "utf8");
const nativeShellState = readFileSync(resolve(root, "ios/TotemOS/TotemOSKit/AppCoordinatorContracts.swift"), "utf8");
const nativeVariableBlur = readFileSync(resolve(root, "ios/TotemOS/TotemOS/Shell/TotemVariableBlur.swift"), "utf8");
const dashboardContract = readFileSync(resolve(root, "src/contracts/api-contracts.ts"), "utf8");

test("la portada web conserva el dashboard completo mientras Swift usa la API nativa", () => {
  assert.match(dashboardRoute, /HomeCommandCenter/);
  assert.match(dashboardRoute, /getTasks\(\)/);
  assert.match(dashboardRoute, /getClients\(\)/);
  assert.match(dashboardRoute, /getFinancialStats\(\)/);
  assert.match(dashboardRoute, /getReceivables\(\)/);
  assert.doesNotMatch(dashboardRoute, /ApiDashboardView/);
});

test("React conserva todas las pantallas privadas y el shell sigue superpuesto", () => {
  assert.match(nativeContent, /Keep the WKWebView mounted/);
  assert.match(nativeContent, /LegacyWebRouteView\(isVisible: !appCoordinator\.shouldUseNativeRoute && appCoordinator\.hasLoadedState\)/);
  assert.match(nativeContent, /opacity\(appCoordinator\.shouldUseNativeRoute \? 0\.001 : 1\)/);
  assert.match(nativeContent, /allowsHitTesting\(!appCoordinator\.shouldUseNativeRoute\)/);
  assert.match(nativeWebView, /webView\.isHidden = !isVisible/);
});

test("las banderas nativas quedan pausadas hasta una aprobación explícita", () => {
  const coordinator = readFileSync(resolve(root, "ios/TotemOS/TotemOS/ShellBridge.swift"), "utf8");
  assert.match(coordinator, /private let nativeScreenMigrationsEnabled = false/);
  assert.match(coordinator, /nativeScreenMigrationsEnabled && mode\(for: state\.route\) == \.native/);
  assert.match(coordinator, /guard !nativeScreenMigrationsEnabled \|\| mode\(for: route\) == \.web else \{ return \}/);
});

test("la barra inferior mantiene la lente detrás del icono y del texto", () => {
  const nativeTabBar = readFileSync(resolve(root, "ios/TotemOS/TotemOS/Shell/ShellTabBarView.swift"), "utf8");
  const designSystem = readFileSync(resolve(root, "ios/TotemOS/TotemOS/TotemDesignSystem.swift"), "utf8");
  assert.match(nativeTabBar, /let ownsLens = activeLensID == tab\.id/);
  assert.match(nativeTabBar, /TotemGlassContainer\(spacing: 8\)/);
  assert.match(nativeTabBar, /selectionLens\(isInteracting: isInteracting\)[\s\S]*\.zIndex\(0\)/);
  assert.match(nativeTabBar, /configuration\.label[\s\S]*\.zIndex\(1\)/);
  assert.match(nativeTabBar, /glassEffectID\(isLensOwner \? "shell-tab-selection"/);
  assert.match(nativeTabBar, /ShellTabButtonStyle/);
  assert.doesNotMatch(nativeTabBar, /TabView\(selection:/);
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
  assert.match(nativeOverlay, /TotemVariableBlurView/);
  assert.match(nativeVariableBlur, /CIFilter\.linearGradient\(\)/);
  assert.match(nativeVariableBlur, /inputMaskImage/);
  assert.match(nativeVariableBlur, /inputRadius/);
  assert.match(nativeVariableBlur, /CABackdropLayer/);
  assert.doesNotMatch(nativeOverlay, /backgroundExtensionEffect/);
  assert.match(nativeOverlay, /ignoresSafeArea\(edges: \.top\)/);
  assert.match(nativeOverlay, /ignoresSafeArea\(edges: \.bottom\)/);
});

test("el acento Catppuccin se mantiene idéntico al cambiar el tema", () => {
  assert.match(nativeShellState, /accentColor = Self\.catppuccinAccentHex\(catppuccinAccent, variant: variant\)/);
  assert.match(nativeShellState, /case "mauve": return "#8839EF"/);
  assert.match(nativeShellState, /case "mauve": return "#CBA6F7"/);
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
