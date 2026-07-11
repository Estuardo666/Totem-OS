"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import type { ApiResponse } from "@/types";
import { specialtySchema } from "@/schemas/admin-schemas";
import type { Specialty } from "@prisma/client";

// Cached separately from the auth check so a cache hit never bypasses authorization
const getCachedSpecialties = unstable_cache(
  async () => db.specialty.findMany({ orderBy: { createdAt: "desc" } }),
  ["specialties"],
  { tags: ["specialties"], revalidate: 3600 }
);

export async function getSpecialties(): Promise<ApiResponse<Specialty[]>> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "No autorizado." };
    }

    const specialties = await getCachedSpecialties();
    return { success: true, data: specialties };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error" };
  }
}

export async function createSpecialty(input: unknown): Promise<ApiResponse<Specialty>> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "No autorizado." };
    }

    const validatedData = specialtySchema.parse(input);

    // Verificar duplicados (case insensitive manual para evitar problemas de SQLite)
    const existing = await db.specialty.findMany();
    const duplicate = existing.find(s => s.name.toLowerCase() === validatedData.name.toLowerCase());
    
    if (duplicate) {
      return { success: false, error: "Ya existe una especialidad con este nombre" };
    }

    const specialty = await db.specialty.create({
      data: { name: validatedData.name },
    });

    revalidatePath("/admin/users");
    revalidateTag("specialties");
    return { success: true, data: specialty };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return { success: false, error: "Nombre ya existe" };
    }
    return { success: false, error: error instanceof Error ? error.message : "Error" };
  }
}

export async function deleteSpecialty(specialtyId: string): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "No autorizado." };
    }

    // Verificar si existe
    const existing = await db.specialty.findUnique({ where: { id: specialtyId } });
    if (!existing) return { success: false, error: "No encontrado" };

    // Nota: Como User.specialty es solo texto, no hay restricción de FK.
    // Podemos borrar la especialidad del catálogo libremente.

    await db.specialty.delete({ where: { id: specialtyId } });
    revalidatePath("/admin/users");
    revalidateTag("specialties");

    return { success: true, data: { success: true } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error" };
  }
}

/**
 * Sincroniza especialidades legacy desde User hacia Specialty
 * Crea registros en Specialty para valores únicos encontrados en User.specialty
 */
export async function syncLegacySpecialties(): Promise<ApiResponse<{ count: number }>> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "No autorizado." };
    }

    // 1. Obtener valores únicos de specialty de la tabla User
    // Prisma no tiene un método directo para "DISTINCT" en campos específicos en todas las versiones/DBs
    // Usaremos una query cruda o agrupamiento en JS para asegurar compatibilidad
    const users = await db.user.findMany({
      where: { specialty: { not: null } },
      select: { specialty: true },
    });

    // Filtrar valores únicos y no vacíos
    const uniqueSpecialties = [...new Set(users.map(u => u.specialty).filter(Boolean) as string[])];

    if (uniqueSpecialties.length === 0) {
      return { success: true, data: { count: 0 } };
    }

    let createdCount = 0;

    // 2. Upsert cada especialidad única
    for (const specName of uniqueSpecialties) {
      try {
        // Verificar si ya existe (case insensitive check opcional, aquí exacto)
        const existing = await db.specialty.findFirst({
          where: { name: specName }
        });

        if (!existing) {
          await db.specialty.create({
            data: { name: specName }
          });
          createdCount++;
        }
      } catch (e) {
        // Ignorar errores de duplicado en caso de concurrencia
        continue;
      }
    }

    revalidatePath("/admin/users");
    revalidateTag("specialties");
    return { success: true, data: { count: createdCount } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error" };
  }
}
