import assert from "node:assert/strict";
import test from "node:test";
import {
  isTotemIOSUserAgent,
  parseTotemIOSAPNSLogoutContext,
} from "../../src/lib/totem-ios-client.ts";

test("distingue la app nativa de Safari y la PWA", () => {
  assert.equal(isTotemIOSUserAgent("Mobile/15E148 TotemOS-iOS"), true);
  assert.equal(isTotemIOSUserAgent("Mozilla/5.0 (iPhone) Mobile/15E148 Safari/604.1"), false);
});

test("acepta solamente el contexto APNs esperado para logout iOS", () => {
  const context = parseTotemIOSAPNSLogoutContext(JSON.stringify({
    installationId: "550e8400-e29b-41d4-a716-446655440000",
    environment: "PRODUCTION",
  }));

  assert.deepEqual(context, {
    installationId: "550e8400-e29b-41d4-a716-446655440000",
    environment: "PRODUCTION",
  });
});

test("rechaza contexto APNs manipulado o incompleto", () => {
  assert.equal(parseTotemIOSAPNSLogoutContext("not-json"), null);
  assert.equal(parseTotemIOSAPNSLogoutContext(JSON.stringify({
    installationId: "../../otra-instalacion",
    environment: "PRODUCTION",
  })), null);
  assert.equal(parseTotemIOSAPNSLogoutContext(JSON.stringify({
    installationId: "550e8400-e29b-41d4-a716-446655440000",
    environment: "UNKNOWN",
  })), null);
});
