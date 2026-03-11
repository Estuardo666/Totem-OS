import type { Credential } from "@prisma/client";
import type { CredentialGroupInput, CredentialService } from "@/schemas/client";

export type VaultCredentialReference = {
  id: string;
  service: CredentialService;
};

export type VaultCredentialGroup = {
  id: string;
  clientId: string;
  username: string;
  password: string;
  url: string;
  services: CredentialService[];
  credentials: Credential[];
};

export type VaultGroupFormValues = CredentialGroupInput;
