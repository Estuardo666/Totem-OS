import test from "node:test";
import assert from "node:assert/strict";
import { matchesExpectedWhatsAppIdentity, normalizeWhatsAppPn } from "../../worker/whatsapp/pairing-guard.ts";

test("normalizes Ecuador phone and WhatsApp PN identities", () => {
  assert.equal(normalizeWhatsAppPn("0994782827"), "593994782827");
  assert.equal(normalizeWhatsAppPn("593994782827:12@s.whatsapp.net"), "593994782827");
  assert.equal(normalizeWhatsAppPn("593994782827@c.us"), "593994782827");
});

test("pairing guard accepts only the expected bot identity", () => {
  assert.equal(matchesExpectedWhatsAppIdentity("593994782827", ["593994782827:12@s.whatsapp.net"]), true);
  assert.equal(matchesExpectedWhatsAppIdentity("593994782827", ["593994782827@s.whatsapp.net", "593994782827:2@s.whatsapp.net"]), true);
  assert.equal(matchesExpectedWhatsAppIdentity("593994782827", ["593998813559@s.whatsapp.net"]), false);
  assert.equal(matchesExpectedWhatsAppIdentity("593994782827", ["593994782827@s.whatsapp.net", "593998813559@s.whatsapp.net"]), false);
  assert.equal(matchesExpectedWhatsAppIdentity("593994782827", []), false);
  assert.equal(matchesExpectedWhatsAppIdentity("invalid", ["593994782827@s.whatsapp.net"]), false);
});
