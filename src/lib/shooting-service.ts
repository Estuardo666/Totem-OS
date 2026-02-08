/**
 * Shooting Service
 * Operaciones CRUD de base de datos para rodajes
 * 
 * @fileoverview Lógica de persistencia extraída de shooting-actions.ts
 */

import { db } from "@/lib/db";
import { startOfMonth, endOfMonth } from "date-fns";
import type { Shoot, User, ContentTask, Client } from "@prisma/client";

export type ShootWithRelations = (Shoot & {
  googleEventId?: string | null;
  googleEventLink?: string | null;
}) & {
  client: Client;
  crew: User[];
  tasks: (ContentTask & { client: Client })[];
};

// Include clause reutilizable
const SHOOT_INCLUDE = {
  client: true,
  crew: true,
  tasks: {
    include: {
      client: true,
    },
  },
} as const;

export interface CreateShootingData {
  title: string;
  startTime: Date;
  endTime: Date;
  address?: string | null;
  mapLink?: string | null;
  scriptUrl?: string | null;
  audioBriefUrl?: string | null;
  notes?: string | null;
  clientId: string;
  crewIds: string[];
  taskIds: string[];
}

export interface UpdateShootingData {
  title?: string;
  startTime?: Date;
  endTime?: Date;
  address?: string | null;
  mapLink?: string | null;
  scriptUrl?: string | null;
  audioBriefUrl?: string | null;
  notes?: string | null;
  clientId?: string;
  status?: string;
  crewIds?: string[];
  taskIds?: string[];
  googleEventId?: string;
  googleEventLink?: string;
}

/**
 * Crea un rodaje en la base de datos
 */
export async function createShootingInDb(
  data: CreateShootingData
): Promise<ShootWithRelations> {
  return db.shoot.create({
    data: {
      title: data.title,
      startTime: data.startTime,
      endTime: data.endTime,
      address: data.address ?? null,
      mapLink: data.mapLink ?? null,
      scriptUrl: data.scriptUrl ?? null,
      audioBriefUrl: data.audioBriefUrl ?? null,
      notes: data.notes ?? null,
      clientId: data.clientId,
      status: "SCHEDULED",
      crew: {
        connect: data.crewIds.map((id) => ({ id })),
      },
      tasks: {
        connect: data.taskIds.map((id) => ({ id })),
      },
    },
    include: SHOOT_INCLUDE,
  }) as Promise<ShootWithRelations>;
}

/**
 * Actualiza un rodaje en la base de datos
 */
export async function updateShootingInDb(
  id: string,
  data: UpdateShootingData
): Promise<ShootWithRelations> {
  const updateData: Record<string, unknown> = {};

  // Campos simples
  if (data.title !== undefined) updateData.title = data.title;
  if (data.startTime !== undefined) updateData.startTime = data.startTime;
  if (data.endTime !== undefined) updateData.endTime = data.endTime;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.mapLink !== undefined) updateData.mapLink = data.mapLink;
  if (data.scriptUrl !== undefined) updateData.scriptUrl = data.scriptUrl;
  if (data.audioBriefUrl !== undefined) updateData.audioBriefUrl = data.audioBriefUrl;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.clientId !== undefined) updateData.clientId = data.clientId;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.googleEventId !== undefined) updateData.googleEventId = data.googleEventId;
  if (data.googleEventLink !== undefined) updateData.googleEventLink = data.googleEventLink;

  // Relaciones
  if (data.crewIds !== undefined) {
    updateData.crew = { set: data.crewIds.map((id) => ({ id })) };
  }
  if (data.taskIds !== undefined) {
    updateData.tasks = { set: data.taskIds.map((id) => ({ id })) };
  }

  return db.shoot.update({
    where: { id },
    data: updateData,
    include: SHOOT_INCLUDE,
  }) as Promise<ShootWithRelations>;
}

/**
 * Obtiene un rodaje por ID
 */
export async function getShootingByIdFromDb(
  id: string
): Promise<ShootWithRelations | null> {
  return db.shoot.findUnique({
    where: { id },
    include: SHOOT_INCLUDE,
  }) as Promise<ShootWithRelations | null>;
}

/**
 * Obtiene rodajes filtrados por mes y/o cliente
 */
export async function getShootingsFromDb(options?: {
  month?: Date;
  clientId?: string;
}): Promise<ShootWithRelations[]> {
  const where: Record<string, unknown> = {};

  if (options?.clientId) {
    where.clientId = options.clientId;
  }

  if (options?.month) {
    const monthStart = startOfMonth(options.month);
    const monthEnd = endOfMonth(options.month);
    where.startTime = {
      gte: monthStart,
      lte: monthEnd,
    };
  }

  return db.shoot.findMany({
    where,
    include: SHOOT_INCLUDE,
    orderBy: {
      startTime: "asc",
    },
  }) as Promise<ShootWithRelations[]>;
}

/**
 * Cancela un rodaje (cambia estado a CANCELED)
 */
export async function cancelShootingInDb(
  id: string
): Promise<ShootWithRelations> {
  return db.shoot.update({
    where: { id },
    data: { status: "CANCELED" },
    include: SHOOT_INCLUDE,
  }) as Promise<ShootWithRelations>;
}

/**
 * Elimina un rodaje de la base de datos
 */
export async function deleteShootingFromDb(id: string): Promise<void> {
  await db.shoot.delete({
    where: { id },
  });
}

/**
 * Obtiene rodajes próximos (dentro de X horas)
 */
export async function getUpcomingShootingsFromDb(
  hoursAhead: number = 12
): Promise<Array<Shoot & { crew: User[] }>> {
  const now = new Date();
  const futureTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  return db.shoot.findMany({
    where: {
      status: "SCHEDULED",
      startTime: {
        gte: now,
        lte: futureTime,
      },
    },
    include: {
      crew: true,
    },
  });
}

/**
 * Obtiene emails del crew para un rodaje
 */
export async function getCrewWithEmails(
  crewIds: string[]
): Promise<Array<{ id: string; name: string; email: string | null }>> {
  return db.user.findMany({
    where: { id: { in: crewIds } },
    select: { id: true, name: true, email: true },
  });
}
