/**
 * Shooting Validation Service
 * Validaciones de horario, conflictos y datos de rodajes
 * 
 * @fileoverview Lógica de validación extraída de shooting-actions.ts
 */

import { db } from "@/lib/db";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Client } from "@prisma/client";

export interface TimeValidationInput {
  startTime: Date;
  endTime: Date;
  excludeShootId?: string; // Para updates
}

export interface ClientValidationInput {
  clientId: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  client?: Client;
}

/**
 * Valida que endTime sea posterior a startTime
 */
export function validateTimeRange(startTime: Date, endTime: Date): ValidationResult {
  if (endTime <= startTime) {
    return {
      valid: false,
      error: "La hora de finalización debe ser posterior a la hora de inicio",
    };
  }
  return { valid: true };
}

/**
 * Valida que el cliente exista
 */
export async function validateClient(clientId: string): Promise<ValidationResult> {
  const client = await db.client.findUnique({
    where: { id: clientId },
  });

  if (!client) {
    return { valid: false, error: "Cliente no encontrado" };
  }

  return { valid: true, client };
}

/**
 * Detecta conflictos de horario con otros rodajes
 * Lógica: (NewStart < ExistingEnd) AND (NewEnd > ExistingStart)
 */
export async function validateNoConflicts(
  input: TimeValidationInput
): Promise<ValidationResult> {
  const whereClause: {
    id?: { not: string };
    status: { not: string };
    AND: Array<{ startTime?: { lt: Date }; endTime?: { gt: Date } }>;
  } = {
    status: { not: "CANCELED" },
    AND: [
      { startTime: { lt: input.endTime } },
      { endTime: { gt: input.startTime } },
    ],
  };

  // Excluir el rodaje actual en updates
  if (input.excludeShootId) {
    whereClause.id = { not: input.excludeShootId };
  }

  const conflictingShoot = await db.shoot.findFirst({
    where: whereClause,
  });

  if (conflictingShoot) {
    const startTimeStr = format(input.startTime, "HH:mm", { locale: es });
    const endTimeStr = format(input.endTime, "HH:mm", { locale: es });
    return {
      valid: false,
      error: `Conflicto de horario: Ya existe un rodaje entre las ${startTimeStr} y ${endTimeStr}.`,
    };
  }

  return { valid: true };
}

/**
 * Valida que el rodaje exista
 */
export async function validateShootingExists(
  shootingId: string
): Promise<ValidationResult & { shooting?: { id: string; googleEventId?: string | null; syncedFromCalendar?: boolean; status?: string; title?: string } }> {
  const shooting = await db.shoot.findUnique({
    where: { id: shootingId },
  });

  if (!shooting) {
    return { valid: false, error: "Rodaje no encontrado" };
  }

  return { 
    valid: true, 
    shooting: {
      id: shooting.id,
      googleEventId: (shooting as any)?.googleEventId ?? null,
      syncedFromCalendar: (shooting as any)?.syncedFromCalendar ?? false,
      status: shooting.status,
      title: shooting.title,
    }
  };
}

/**
 * Validación completa para creación de rodaje
 */
export async function validateCreateShooting(input: {
  startTime: Date;
  endTime: Date;
  clientId: string;
}): Promise<ValidationResult> {
  // 1. Validar rango de tiempo
  const timeResult = validateTimeRange(input.startTime, input.endTime);
  if (!timeResult.valid) return timeResult;

  // 2. Validar cliente
  const clientResult = await validateClient(input.clientId);
  if (!clientResult.valid) return clientResult;

  // 3. Validar sin conflictos
  const conflictResult = await validateNoConflicts({
    startTime: input.startTime,
    endTime: input.endTime,
  });
  if (!conflictResult.valid) return conflictResult;

  return { valid: true, client: clientResult.client };
}

/**
 * Validación completa para actualización de rodaje
 */
export async function validateUpdateShooting(input: {
  shootingId: string;
  startTime?: Date;
  endTime?: Date;
  clientId?: string;
  existingStartTime: Date;
  existingEndTime: Date;
}): Promise<ValidationResult> {
  // 1. Si se actualiza alguna fecha, validar
  const newStartTime = input.startTime ?? input.existingStartTime;
  const newEndTime = input.endTime ?? input.existingEndTime;

  if (input.startTime !== undefined || input.endTime !== undefined) {
    // Validar rango
    const timeResult = validateTimeRange(newStartTime, newEndTime);
    if (!timeResult.valid) return timeResult;

    // Validar sin conflictos (excluyendo el actual)
    const conflictResult = await validateNoConflicts({
      startTime: newStartTime,
      endTime: newEndTime,
      excludeShootId: input.shootingId,
    });
    if (!conflictResult.valid) return conflictResult;
  }

  // 2. Si se actualiza cliente, validar
  if (input.clientId) {
    const clientResult = await validateClient(input.clientId);
    if (!clientResult.valid) return clientResult;
    return { valid: true, client: clientResult.client };
  }

  return { valid: true };
}
