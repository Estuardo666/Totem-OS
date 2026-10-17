import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type WhatsAppConfig = {
  paused: boolean;
  clientsEnabled: boolean;
  ownerPhone: string | null;
  approvalReminderHours: number;
  maxApprovalReminders: number;
  skipWeekends: boolean;
  teamDailyHour: string;
  amountsInGroups: boolean;
  aiModel: string | null;
};

const defaults: WhatsAppConfig = {
  paused: true,
  clientsEnabled: false,
  ownerPhone: null,
  approvalReminderHours: 48,
  maxApprovalReminders: 2,
  skipWeekends: true,
  teamDailyHour: "08:00",
  amountsInGroups: false,
  aiModel: null,
};

function parseValue(value: string | undefined, fallback: unknown): unknown {
  if (value === undefined) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function int(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}

export async function getWhatsAppConfig(client: Pick<Prisma.TransactionClient, "globalConfig"> = db): Promise<WhatsAppConfig> {
  const rows = await client.globalConfig.findMany({
    where: { key: { startsWith: "whatsapp." } },
    select: { key: true, value: true },
  });
  const values = new Map(rows.map((row) => [row.key, parseValue(row.value, undefined)]));
  const get = (key: keyof WhatsAppConfig) => values.get(`whatsapp.${key}`);
  const ownerPhone = get("ownerPhone");
  const hour = get("teamDailyHour");
  const model = get("aiModel");
  return {
    paused: bool(get("paused"), defaults.paused),
    clientsEnabled: bool(get("clientsEnabled"), defaults.clientsEnabled),
    ownerPhone: typeof ownerPhone === "string" && ownerPhone.trim() ? ownerPhone : null,
    approvalReminderHours: int(get("approvalReminderHours"), defaults.approvalReminderHours),
    maxApprovalReminders: int(get("maxApprovalReminders"), defaults.maxApprovalReminders),
    skipWeekends: bool(get("skipWeekends"), defaults.skipWeekends),
    teamDailyHour: typeof hour === "string" && /^\d{2}:\d{2}$/.test(hour) ? hour : defaults.teamDailyHour,
    amountsInGroups: bool(get("amountsInGroups"), defaults.amountsInGroups),
    aiModel: typeof model === "string" && model.trim() ? model.trim() : null,
  };
}

export async function setWhatsAppConfigValue(key: keyof WhatsAppConfig, value: unknown): Promise<void> {
  if (!(key in defaults)) throw new Error("Configuración de WhatsApp desconocida");
  await db.globalConfig.upsert({
    where: { key: `whatsapp.${key}` },
    create: { key: `whatsapp.${key}`, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
}

export async function setWhatsAppPaused(paused: boolean): Promise<void> {
  await setWhatsAppConfigValue("paused", paused);
}

export async function setWhatsAppClientsEnabled(enabled: boolean): Promise<void> {
  await setWhatsAppConfigValue("clientsEnabled", enabled);
}
