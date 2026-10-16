import assert from "node:assert/strict";
import test from "node:test";
import { buildVoiceInstructions, VOICE_TOOLS } from "../../src/lib/assistant/voice-guidance.ts";
import { voiceDraftConfirmationMessage } from "../../src/lib/assistant/voice-draft-messages.ts";

test("la voz descubre las consultas y acciones de WhatsApp y exige borrador confirmado", () => {
  const instructions = buildVoiceInstructions("Stuart");
  const assistant = VOICE_TOOLS.find((tool) => tool.name === "asistente");
  const confirm = VOICE_TOOLS.find((tool) => tool.name === "confirmar");

  assert.match(instructions, /WhatsApp/);
  assert.match(instructions, /aprobaciones pendientes/);
  assert.match(instructions, /pausar\/reanudar/);
  assert.match(instructions, /solo si el usuario dice claramente que sí/i);
  assert.match(instructions, /la entrega todavía no está confirmada/);
  assert.match(assistant?.description ?? "", /acciones de WhatsApp/);
  assert.match(confirm?.description ?? "", /no confirma su entrega/);
});

test("confirmar un mensaje solo informa que quedó en cola, no que se entregó", () => {
  const message = voiceDraftConfirmationMessage("enviarWhatsApp");
  assert.match(message, /quedó en cola/);
  assert.match(message, /entrega todavía no está confirmada/);
  assert.doesNotMatch(message, /se envió|fue enviado|entregado/i);
});

test("las confirmaciones de otras acciones describen el efecto específico", () => {
  assert.match(voiceDraftConfirmationMessage("pausarBot"), /pausa del bot se actualizó/);
  assert.match(voiceDraftConfirmationMessage("marcarAprobado"), /aprobada/);
  assert.match(voiceDraftConfirmationMessage("crearTarea"), /acción se confirmó/);
});
