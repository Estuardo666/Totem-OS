import assert from "node:assert/strict";
import test from "node:test";
import { financialResponseData } from "../../src/lib/assistant/finance-response.ts";
import { buildSystemPrompt } from "../../src/lib/assistant/prompt.ts";
import { buildVoiceInstructions } from "../../src/lib/assistant/voice-guidance.ts";

test("el resumen distingue 1895 cobrados de 2535 comprometidos y 63 de reembolsos", () => {
  const summary = {
    period: { value: "2026-10" },
    executive: { collectedCash: 1895, recognizedRevenue: 2535 },
    treasury: { pendingReimbursements: 63, operatingEndingBalance: 427, pendingCompensation: 100 },
    quality: { isProvisional: true, pendingRecurringRevenue: 650 },
  };
  const result = financialResponseData(summary);
  assert.equal(result.ingresosCobradosReales, 1895);
  assert.equal(result.ingresosReconocidosComprometidos, 2535);
  assert.equal(result.tesoreria.pendingReimbursements, 63);
  assert.equal(result.tesoreria.operatingEndingBalance, 427);
  assert.equal(result.mes, "2026-10");
  assert.match(result.definiciones.ingresosReconocidosComprometidos, /no equivale a dinero recibido/);
  assert.match(result.definiciones.reembolsosPendientes, /acumulados/);
  assert.ok(Number.isFinite(Date.parse(result.consultadoEn)));
  summary.executive.collectedCash = 2000;
  assert.equal(financialResponseData(summary).ingresosCobradosReales, 2000);
});

test("cero real no se sustituye por ingreso comprometido", () => {
  const result = financialResponseData({ period: { value: "2026-10" }, executive: { collectedCash: 0, recognizedRevenue: 2535 }, treasury: {}, quality: {} });
  assert.equal(result.ingresosCobradosReales, 0);
});

test("chat, pensador y voz exigen datos nuevos también ante correcciones", () => {
  const user = { id: "admin", name: "Stuart", role: "ADMIN" };
  for (const prompt of [buildSystemPrompt(user), buildSystemPrompt(user, "voice"), buildVoiceInstructions("Stuart")]) {
    assert.match(prompt, /En CADA turno sobre finanzas consulta nuevamente/);
    assert.match(prompt, /nunca como fuente vigente de montos/);
    assert.match(prompt, /no proyectados/);
    assert.match(prompt, /ingresosCobradosReales/);
    assert.match(prompt, /pendingReimbursements/);
    assert.match(prompt, /Si la consulta falla/);
  }
});
