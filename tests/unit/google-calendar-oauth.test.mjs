import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const connectRoute = readFileSync(
  resolve(root, "src/app/api/google-calendar/connect/route.ts"),
  "utf8",
);
const callbackRoute = readFileSync(
  resolve(root, "src/app/api/auth/google/route.ts"),
  "utf8",
);
const shootsView = readFileSync(
  resolve(root, "src/components/features/shoots/shoots-view.tsx"),
  "utf8",
);

test("el endpoint de conexión inicia OAuth mediante redirección", () => {
  assert.match(connectRoute, /return NextResponse\.redirect\(authUrl\)/);
  assert.doesNotMatch(connectRoute, /return NextResponse\.json\(\s*\{\s*authUrl/);
});

test("el botón de Rodajes usa una navegación completa para OAuth", () => {
  assert.match(shootsView, /window\.location\.href = "\/api\/auth\/google"/);
  assert.doesNotMatch(shootsView, /router\.push\("\/api\/google-calendar\/connect"\)/);
});

test("el callback hace una sincronización inicial después de guardar tokens", () => {
  assert.match(callbackRoute, /GoogleCalendarService\.saveTokens\(session\.user\.id, tokens\)/);
  assert.match(callbackRoute, /syncCalendarEventsToShoots\(session\.user\.id\)/);
});
