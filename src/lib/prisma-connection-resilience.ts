import { Prisma } from "@prisma/client";

const PRISMA_RETRY_COOLDOWN_MS = 2 * 60 * 1000;

let nextPrismaRetryAt = 0;

export function shouldSkipPrismaConnectionAttempt() {
  return Date.now() < nextPrismaRetryAt;
}

export function clearPrismaConnectionBackoff() {
  nextPrismaRetryAt = 0;
}

export function isPrismaConnectionIssue(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ["P1001", "P1002"].includes(error.code)
  ) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return [
    "Can't reach database server",
    "ConnectionReset",
    "forcibly closed by the remote host",
    "ECONNRESET",
    "ETIMEDOUT",
  ].some((snippet) => error.message.includes(snippet));
}

export function registerPrismaConnectionIssue(error: unknown) {
  if (!isPrismaConnectionIssue(error)) {
    return false;
  }

  nextPrismaRetryAt = Date.now() + PRISMA_RETRY_COOLDOWN_MS;
  return true;
}