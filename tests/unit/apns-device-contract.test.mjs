import assert from "node:assert/strict";
import test from "node:test";
import {
  isAllowedApnsBundleId,
  registerApnsDeviceSchema,
  revokeApnsDeviceSchema,
} from "../../src/schemas/apns-device.ts";

const validRegistration = {
  installationId: "550e8400-e29b-41d4-a716-446655440000",
  deviceToken: "A".repeat(64),
  environment: "PRODUCTION",
  bundleId: "com.totem.ios",
  appVersion: "1.0.0",
};

test("normaliza un token APNs hexadecimal valido", () => {
  const result = registerApnsDeviceSchema.parse(validRegistration);
  assert.equal(result.deviceToken, "a".repeat(64));
});

test("rechaza tokens, ambientes e instalaciones invalidas", () => {
  assert.equal(registerApnsDeviceSchema.safeParse({ ...validRegistration, deviceToken: "xyz" }).success, false);
  assert.equal(registerApnsDeviceSchema.safeParse({ ...validRegistration, environment: "DEV" }).success, false);
  assert.equal(revokeApnsDeviceSchema.safeParse({ installationId: "no-uuid", environment: "SANDBOX" }).success, false);
});

test("el bundle falla cerrado si no esta configurado o no coincide", () => {
  assert.equal(isAllowedApnsBundleId("com.totem.ios", "com.totem.ios"), true);
  assert.equal(isAllowedApnsBundleId("com.attacker.app", "com.totem.ios"), false);
  assert.equal(isAllowedApnsBundleId("com.totem.ios", undefined), false);
});
