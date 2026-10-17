export interface WorkerStartupFlags {
  sriEnabled: string | undefined;
  pairingOnly: boolean;
}

/** Pairing-only disables WhatsApp processing, but does not gate the separate SRI queue. */
export function shouldStartSRIWorker({ sriEnabled }: WorkerStartupFlags): boolean {
  return sriEnabled === "1";
}
