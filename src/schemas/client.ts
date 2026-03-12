import { z } from "zod";

export const credentialServices = [
  "Facebook",
  "Instagram",
  "TikTok",
  "Gmail",
  "Hotmail",
  "Web",
  "Otros",
] as const;

export const credentialServiceSchema = z.enum(credentialServices);

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

const contactEmailsSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      const emails = value
        .split(/[\s,;]+/)
        .map((email) => email.trim())
        .filter(Boolean);
      return emails.length ? emails : [];
    }
    if (Array.isArray(value)) {
      return value;
    }
    return undefined;
  },
  z.array(z.string().email("Email inválido")).optional()
);

const optionalDateSchema = z.preprocess(
  (value) => {
    if (value === "" || value === undefined || value === null) {
      return null;
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === "string") {
      return new Date(`${value}T00:00:00`);
    }

    return value;
  },
  z.date().nullable().optional()
);

export const clientSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1, "El nombre del cliente es requerido"),
  status: z.enum(["ACTIVE", "PAUSED", "DEBT", "INACTIVE"]).default("ACTIVE"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Debe ser un color HEX válido").default("#000000"),
  brandKit: brandKitSchema.optional(),
  vault: vaultSchema.optional(),
  planConfig: planConfigSchema.optional(),
  brandDNA: brandDNASchema.optional(),
  monthlyReels: z.number().int().min(0).default(0),
  monthlyFlyers: z.number().int().min(0).default(0),
  monthlyShoots: z.number().int().min(0).default(0),
  monthlyRate: z.number().min(0).default(0),
  paymentDay: z
    .number()
    .int()
    .min(1, "El día de pago debe ser entre 1 y 31")
    .max(31, "El día de pago debe ser entre 1 y 31")
    .optional()
    .nullable(),
  billingStartDate: optionalDateSchema,
  logo: z.string().url("Debe ser una URL válida").optional().nullable(),
  lastPostDate: z.date().optional(),
  editorId: z.string().cuid().optional().nullable(),
  communityId: z.string().cuid().optional().nullable(),
  contactEmails: contactEmailsSchema,
});

export const createClientSchema = clientSchema.omit({ id: true });
export const updateClientSchema = clientSchema.partial();

export const clientBillingExceptionTypeSchema = z.enum([
  "SKIP",
  "OVERRIDE_AMOUNT",
  "MARK_AS_PAID",
]);

export const clientBillingExceptionSchema = z
  .object({
    clientId: z.string().cuid(),
    period: z.string().regex(/^\d{4}-\d{2}$/, "Selecciona un período válido"),
    type: clientBillingExceptionTypeSchema,
    overrideAmount: z.preprocess(
      (value) => {
        if (value === "" || value === undefined || value === null) {
          return null;
        }

        if (typeof value === "number") {
          return value;
        }

        if (typeof value === "string") {
          const parsed = Number(value);
          return Number.isNaN(parsed) ? value : parsed;
        }

        return value;
      },
      z.number().min(0, "El monto debe ser mayor o igual a 0").nullable().optional()
    ),
    reason: z.string().min(3, "El motivo es requerido"),
    notes: z.string().max(500, "Máximo 500 caracteres").optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "OVERRIDE_AMOUNT" && data.overrideAmount === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["overrideAmount"],
        message: "Debes indicar el monto a cobrar en este mes",
      });
    }
  });

// Schema para Credenciales (Bóveda)
export const credentialSchema = z.object({
  id: z.string().cuid().optional(),
  service: credentialServiceSchema,
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

export const credentialGroupReferenceSchema = z.object({
  id: z.string().cuid(),
  service: credentialServiceSchema,
});

export const credentialGroupSchema = z.object({
  services: z.array(credentialServiceSchema).min(1, "Selecciona al menos un servicio"),
  username: z.string().min(1, "El usuario es requerido"),
  password: z.string().min(1, "La contraseña es requerida"),
  url: z
    .union([z.string().url("Debe ser una URL válida"), z.literal("")])
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
  clientId: z.string().cuid(),
  existingCredentials: z.array(credentialGroupReferenceSchema).default([]),
});

export const deleteCredentialGroupSchema = z.object({
  clientId: z.string().cuid(),
  credentialIds: z.array(z.string().cuid()).min(1, "No hay credenciales para eliminar"),
});

export type Client = z.infer<typeof clientSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ClientBillingExceptionInput = z.infer<typeof clientBillingExceptionSchema>;
export type ClientBillingExceptionType = z.infer<typeof clientBillingExceptionTypeSchema>;
export type BrandKit = z.infer<typeof brandKitSchema>;
export type PlanConfig = z.infer<typeof planConfigSchema>;
export type BrandDNA = z.infer<typeof brandDNASchema>;
export type Credential = z.infer<typeof credentialSchema>;
export type CreateCredentialInput = z.infer<typeof createCredentialSchema>;
export type CredentialService = z.infer<typeof credentialServiceSchema>;
export type CredentialGroupInput = z.infer<typeof credentialGroupSchema>;

