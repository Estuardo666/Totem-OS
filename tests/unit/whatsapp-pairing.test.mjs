import test from "node:test";
import assert from "node:assert/strict";
import { matchesExpectedWhatsAppIdentity, normalizeWhatsAppPn } from "../../worker/whatsapp/pairing-guard.ts";

test("normalizes Ecuador phone and WhatsApp PN identities", () => {
  assert.equal(normalizeWhatsAppPn("0990000001"), "593990000001");
  assert.equal(normalizeWhatsAppPn("593990000001:12@s.whatsapp.net"), "593990000001");
  assert.equal(normalizeWhatsAppPn("593990000001@c.us"), "593990000001");
});

test("pairing guard accepts only the expected bot identity", () => {
  assert.equal(matchesExpectedWhatsAppIdentity("593990000001", ["593990000001:12@s.whatsapp.net"]), true);
  assert.equal(matchesExpectedWhatsAppIdentity("593990000001", ["593990000001@s.whatsapp.net", "593990000001:2@s.whatsapp.net"]), true);
  assert.equal(matchesExpectedWhatsAppIdentity("593990000001", ["593990000003@s.whatsapp.net"]), false);
  assert.equal(matchesExpectedWhatsAppIdentity("593990000001", ["593990000001@s.whatsapp.net", "593990000003@s.whatsapp.net"]), false);
  assert.equal(matchesExpectedWhatsAppIdentity("593990000001", []), false);
  assert.equal(matchesExpectedWhatsAppIdentity("invalid", ["593990000001@s.whatsapp.net"]), false);
});
