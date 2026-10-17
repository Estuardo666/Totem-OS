const RUN_ID_PATTERN = /^[a-zA-Z0-9-]{8,80}$/;
const GROUP_JID_PATTERN = /^\d+@g\.us$/;

export type FunctionalTestScope = {
  groupJid: string;
  runId: string;
  messagePrefix: string;
};

/** Returns a fail-closed scope only when functional-test isolation is explicitly enabled. */
export function readFunctionalTestScope(
  env: Record<string, string | undefined>,
): FunctionalTestScope | null {
  if (env.WA_FUNCTIONAL_TEST_ONLY !== "1") return null;

  if (env.WA_TEST_GROUP_ONLY === "1" || env.WA_PAIRING_ONLY === "1") {
    throw new Error("Functional test mode cannot be combined with group-only or pairing-only mode");
  }
  if (env.SRI_ENABLED !== "0") {
    throw new Error("Functional test mode requires SRI_ENABLED=0");
  }

  const database = env.WA_FUNCTIONAL_TEST_DATABASE?.trim();
  if (!database) throw new Error("WA_FUNCTIONAL_TEST_DATABASE is required");
  if (/neondb/i.test(database) || !/(test|staging)/i.test(database)) {
    throw new Error("WA_FUNCTIONAL_TEST_DATABASE must identify a test or staging database");
  }

  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required in functional test mode");
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid database URL");
  }
  const actualDatabase = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !parsed.hostname ||
    !parsed.username ||
    !actualDatabase ||
    actualDatabase !== database
  ) {
    throw new Error("DATABASE_URL must point exactly to WA_FUNCTIONAL_TEST_DATABASE with a valid host and user");
  }

  const groupJid = env.WA_FUNCTIONAL_TEST_GROUP_JID?.trim();
  if (!groupJid) throw new Error("WA_FUNCTIONAL_TEST_GROUP_JID is required");
  if (!GROUP_JID_PATTERN.test(groupJid)) throw new Error("WA_FUNCTIONAL_TEST_GROUP_JID must be a WhatsApp group JID");

  const runId = env.WA_FUNCTIONAL_TEST_RUN_ID?.trim();
  if (!runId) throw new Error("WA_FUNCTIONAL_TEST_RUN_ID is required");
  if (!RUN_ID_PATTERN.test(runId)) throw new Error("WA_FUNCTIONAL_TEST_RUN_ID has an invalid format");

  return { groupJid, runId, messagePrefix: `functional:${runId}:` };
}

export function filterFunctionalTestMessages<T extends { key?: { remoteJid?: string | null } }>(
  messages: unknown[],
  scope: FunctionalTestScope,
): T[] {
  return messages.filter((message) => (message as T | null)?.key?.remoteJid === scope.groupJid) as T[];
}

export function functionalMessageWhere(scope: FunctionalTestScope) {
  return {
    to: scope.groupJid,
    OR: [
      { kind: "MANUAL", dedupeKey: { startsWith: scope.messagePrefix } },
      { kind: "APPROVAL_CONFIRM", dedupeKey: { startsWith: `approval-confirm:${scope.messagePrefix}` } },
    ],
    kind: { in: ["MANUAL", "APPROVAL_CONFIRM"] },
  };
}
