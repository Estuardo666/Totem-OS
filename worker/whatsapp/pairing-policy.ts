export type WhatsAppPairingPolicy = Readonly<{
  registerInboundHandlers: boolean;
  notifyOwner: boolean;
  syncGroups: boolean;
  recoverSendingMessages: boolean;
  runMessageAutomation: boolean;
}>;

/** Restrict pairing-only connections to authentication and health events. */
export function getWhatsAppPairingPolicy(pairingOnly: boolean): WhatsAppPairingPolicy {
  const automationEnabled = !pairingOnly;
  return {
    registerInboundHandlers: automationEnabled,
    notifyOwner: automationEnabled,
    syncGroups: automationEnabled,
    recoverSendingMessages: automationEnabled,
    runMessageAutomation: automationEnabled,
  };
}
