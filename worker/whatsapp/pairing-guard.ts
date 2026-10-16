/** Normalize a WhatsApp JID/phone to a digits-only PN identity. */
export function normalizeWhatsAppPn(value: string | null | undefined): string | null {
  if (!value) return null;
  const withoutDevice = value.split(":", 1)[0];
  const user = withoutDevice.split("@", 1)[0];
  let digits = user.replace(/\D/g, "").replace(/^00/, "");
  if (digits.startsWith("0") && digits.length === 10) digits = `593${digits.slice(1)}`;
  if (digits.startsWith("9") && digits.length === 9) digits = `593${digits}`;
  return /^\d{7,15}$/.test(digits) ? digits : null;
}

/** Require every identity exposed by Baileys on open to match the configured bot PN. */
export function matchesExpectedWhatsAppIdentity(
  expectedPhone: string,
  identities: Array<string | null | undefined>,
): boolean {
  const expected = normalizeWhatsAppPn(expectedPhone);
  const observed = identities.map(normalizeWhatsAppPn);
  return Boolean(expected && observed.length && observed.every((identity) => identity === expected));
}
