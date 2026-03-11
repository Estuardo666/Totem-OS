import type { Credential } from "@prisma/client";
import { credentialServices, type CredentialService } from "@/schemas/client";
import type { VaultCredentialGroup } from "./vault-types";

const serviceOrder = new Map<string, number>(
  credentialServices.map((service, index) => [service, index])
);

export function getVaultGroupKey(credential: Credential): string {
  return [credential.username, credential.password, credential.url ?? ""].join("::");
}

export function groupVaultCredentials(
  credentials: Credential[],
  clientId: string
): VaultCredentialGroup[] {
  const groupsMap = new Map<string, VaultCredentialGroup>();

  credentials.forEach((credential) => {
    const key = getVaultGroupKey(credential);
    const currentGroup = groupsMap.get(key);

    if (currentGroup) {
      currentGroup.credentials.push(credential);
      currentGroup.services.push(credential.service as CredentialService);
      return;
    }

    groupsMap.set(key, {
      id: key,
      clientId,
      username: credential.username,
      password: credential.password,
      url: credential.url ?? "",
      services: [credential.service as CredentialService],
      credentials: [credential],
    });
  });

  return Array.from(groupsMap.values())
    .map((group) => ({
      ...group,
      services: Array.from(new Set(group.services)).sort(sortServices),
      credentials: [...group.credentials].sort((a, b) => sortServices(a.service, b.service)),
    }))
    .sort((a, b) => a.username.localeCompare(b.username, "es", { sensitivity: "base" }));
}

export function sortServices(left: string, right: string): number {
  return (serviceOrder.get(left) ?? Number.MAX_SAFE_INTEGER) - (serviceOrder.get(right) ?? Number.MAX_SAFE_INTEGER);
}
