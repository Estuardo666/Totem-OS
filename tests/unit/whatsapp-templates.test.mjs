import assert from "node:assert/strict";
import test from "node:test";
import { approvalReminderText, paymentReminderText, shootReminderText } from "../../src/lib/whatsapp/templates.ts";

test("las tres variantes son estables y conservan los datos del recordatorio", () => {
  for (const render of [
    (key) => approvalReminderText({ title: "Video local", variantKey: key }),
    (key) => shootReminderText({ title: "Rodaje local", date: "20/10/2026 09:00", variantKey: key }),
    (key) => paymentReminderText({ clientName: "Cliente local", timing: "vence hoy", isGroup: true, amount: 999, variantKey: key }),
  ]) {
    const variants = ["a", "b", "c"].map(render);
    assert.equal(new Set(variants).size, 3);
    assert.equal(render("a"), render("a"));
    assert.ok(variants.every((text) => text.startsWith("🤖 Totem Bot:")));
  }
});

test("el monto nunca aparece en grupos sin la opción explícita", () => {
  const base = { clientName: "Cliente local", timing: "vence hoy", amount: 321.45, variantKey: "a" };
  assert.doesNotMatch(paymentReminderText({ ...base, isGroup: true }), /321|\$/);
  assert.match(paymentReminderText({ ...base, isGroup: false }), /\$321\.45/);
  assert.match(paymentReminderText({ ...base, isGroup: true, amountsInGroups: true }), /\$321\.45/);
});
