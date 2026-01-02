import { z } from "zod";

export const brandKitSchema = z.object({
  colors: z.array(z.string()),
  fonts: z.array(z.string()),
  driveLink: z.string().url().optional(),
});

export const vaultSchema = z.record(z.unknown());

export const planConfigSchema = z.object({
  quota: z.object({
    reels: z.number().int().min(0).optional(),
    flyers: z.number().int().min(0).optional(),
    stories: z.number().int().min(0).optional(),
  }),
});

export const brandDNASchema = z.object({
  businessDescription: z.string().min(1, "La descripción del negocio es requerida").optional(),
  toneOfVoice: z.string().min(1, "El tono de voz es requerido").optional(),
  audience: z.string().min(1, "La audiencia objetivo es requerida").optional(),
  values: z.string().optional(),
});

export const clientSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1, "El nombre del cliente es requerido"),
  status: z.enum(["ACTIVE", "PAUSED", "DEBT"]).default("ACTIVE"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Debe ser un color HEX válido").default("#000000"),
  brandKit: brandKitSchema.optional(),
  vault: vaultSchema.optional(),
  planConfig: planConfigSchema.optional(),
  brandDNA: brandDNASchema.optional(),
  monthlyReels: z.number().int().min(0).default(0),
  monthlyFlyers: z.number().int().min(0).default(0),
  monthlyRate: z.number().min(0).default(0),
  logo: z.string().url("Debe ser una URL válida").optional().nullable(),
  lastPostDate: z.date().optional(),
  editorId: z.string().cuid().optional().nullable(),
  communityId: z.string().cuid().optional().nullable(),
});

export const createClientSchema = clientSchema.omit({ id: true });
export const updateClientSchema = clientSchema.partial();

// Schema para Credenciales (Bóveda)
export const credentialSchema = z.object({
  id: z.string().cuid().optional(),
  service: z.string().min(1, "El servicio es requerido"),
  username: z.string().min(1, "El usuario es requerido"),
  password: z.string().min(1, "La contraseña es requerida"),
  url: z
    .union([z.string().url("Debe ser una URL válida"), z.literal("")])
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
  clientId: z.string().cuid(),
});

export const createCredentialSchema = credentialSchema.omit({ id: true });
export const updateCredentialSchema = credentialSchema.partial();

export type Client = z.infer<typeof clientSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type BrandKit = z.infer<typeof brandKitSchema>;
export type PlanConfig = z.infer<typeof planConfigSchema>;
export type BrandDNA = z.infer<typeof brandDNASchema>;
export type Credential = z.infer<typeof credentialSchema>;
export type CreateCredentialInput = z.infer<typeof createCredentialSchema>;

