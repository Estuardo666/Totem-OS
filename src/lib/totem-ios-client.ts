"use client";

import { signOut } from "next-auth/react";

const TOTEM_IOS_USER_AGENT_MARKER = "TotemOS-iOS";
const APNS_CONTEXT_STORAGE_KEY = "totem-ios-apns-context";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type APNSLogoutContext = {
  installationId: string;
  environment: "SANDBOX" | "PRODUCTION";
};

export function isTotemIOSAppUserAgent(): boolean {
  return typeof navigator !== "undefined"
    && isTotemIOSUserAgent(navigator.userAgent);
}

export function isTotemIOSUserAgent(userAgent: string): boolean {
  return userAgent.includes(TOTEM_IOS_USER_AGENT_MARKER);
}

export async function signOutWithTotemIOSCleanup(
  callbackUrl = "/sign-in",
): Promise<void> {
  await revokeTotemIOSPushInstallation();
  await signOut({ callbackUrl });
}

async function revokeTotemIOSPushInstallation(): Promise<void> {
  if (!isTotemIOSAppUserAgent()) return;

  const context = readAPNSLogoutContext();
  if (!context) return;

  try {
    const response = await fetch("/api/push/apns", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(context),
      keepalive: true,
    });
    if (response.ok) {
      localStorage.removeItem(APNS_CONTEXT_STORAGE_KEY);
    }
  } catch {
    // El cierre de sesión no debe quedar bloqueado por una falla de red.
  }
}

function readAPNSLogoutContext(): APNSLogoutContext | null {
  return parseTotemIOSAPNSLogoutContext(
    localStorage.getItem(APNS_CONTEXT_STORAGE_KEY),
  );
}

export function parseTotemIOSAPNSLogoutContext(
  rawValue: string | null,
): APNSLogoutContext | null {
  try {
    if (!rawValue) return null;

    const value: unknown = JSON.parse(rawValue);
    if (!value || typeof value !== "object") return null;

    const candidate = value as Record<string, unknown>;
    if (typeof candidate.installationId !== "string"
      || !UUID_PATTERN.test(candidate.installationId)
      || (candidate.environment !== "SANDBOX" && candidate.environment !== "PRODUCTION")) {
      return null;
    }

    return {
      installationId: candidate.installationId,
      environment: candidate.environment,
    };
  } catch {
    return null;
  }
}
