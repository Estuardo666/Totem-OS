export type WatchdogCheck = { healthy: boolean; createdAt: Date };

export function evaluateWhatsAppWatchdog(input: {
  checks: WatchdogCheck[];
  latestAlertAt: Date | null;
  checkedAt: Date;
}) {
  // The caller reads newest-first. The first healthy check ends the last outage.
  const latestHealthy = input.checks.find((event) => event.healthy);
  const failures = input.checks.filter((event) =>
    !event.healthy && (!latestHealthy || event.createdAt > latestHealthy.createdAt),
  );
  const failedSince = failures.at(-1)?.createdAt ?? input.checkedAt;
  const alreadyAlerted = Boolean(
    input.latestAlertAt && (!latestHealthy || input.latestAlertAt > latestHealthy.createdAt),
  );
  const minutesDown = Math.floor((input.checkedAt.getTime() - failedSince.getTime()) / 60_000);

  return {
    failedSince,
    minutesDown,
    shouldAlert: failures.length > 0 && minutesDown >= 5 && !alreadyAlerted,
  };
}
