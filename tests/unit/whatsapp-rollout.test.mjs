import assert from "node:assert/strict";
import test from "node:test";
import { meetsPromotionCriteria } from "../../src/lib/whatsapp/rollout-policy.ts";

test("AUTO exige cinco decisiones sin rechazos ni correcciones", () => {
  const yes = { answer: "1", edited: false };
  assert.equal(meetsPromotionCriteria(Array(4).fill(yes)), false);
  assert.equal(meetsPromotionCriteria(Array(5).fill(yes)), true);
  assert.equal(meetsPromotionCriteria([...Array(5).fill(yes), { answer: "2", edited: false }]), false);
  assert.equal(meetsPromotionCriteria([...Array(5).fill(yes), { answer: "1", edited: true }]), false);
});
