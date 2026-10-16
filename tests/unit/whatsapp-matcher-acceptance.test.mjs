import assert from "node:assert/strict";
import test from "node:test";
import { normalizeVideoFileName, tokenSetSimilarity } from "../../worker/whatsapp/text.ts";

test("los cinco archivos del plan seleccionan la tarea correcta entre candidatas", () => {
  const fixtures = [
    ["Diana Auquilla - Septiembre - Rematch - Tu be(2)_1", "Diana Auquilla", "Rematch – Tu be"],
    ["Arevalo Septiembre v2 - Frio o calido - Frio (1)_1", "Arevalo", "Frío o cálido"],
    ["Examenes mamas_1.mp4", "", "Exámenes de mamas"],
    ["Daniela Auquilla - Dialogo Snacks v4 - SNACKS(1)_1", "Daniela Auquilla", "Diálogo Snacks"],
    ["EuroPeek - certificados", "EuroPeek", "Certificados"],
  ];
  for (const [file, client, expected] of fixtures) {
    const key = normalizeVideoFileName(file, [client]);
    const ranked = fixtures.map(([, , title]) => ({ title, score: tokenSetSimilarity(key, title) })).sort((a, b) => b.score - a.score);
    assert.equal(ranked[0].title, expected, file);
    assert.ok(ranked[0].score >= 0.8 && ranked[0].score - ranked[1].score >= 0.1, file);
  }
});
