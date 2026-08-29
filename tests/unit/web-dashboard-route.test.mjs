import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const dashboardRoute = readFileSync(resolve(root, "src/app/(dashboard)/page.tsx"), "utf8");
const nativeDashboard = readFileSync(resolve(root, "ios/TotemOS/TotemOS/NativeDashboardView.swift"), "utf8");
const nativeContent = readFileSync(resolve(root, "ios/TotemOS/TotemOS/ContentView.swift"), "utf8");
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
  assert.match(nativeContent, /\.opacity\(appCoordinator\.shouldUseNativeRoute \? 0 : 1\)/);
  assert.match(nativeContent, /\.allowsHitTesting\(!appCoordinator\.shouldUseNativeRoute\)/);
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
