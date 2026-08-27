"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ApiResponse } from "@/types";
import { roleSchema } from "@/schemas/admin-schemas";
import type { Role } from "@prisma/client";

export type RoleWithUserCount = Role & {
  _count: { users: number };
};

/**
 * Obtiene todos los roles del sistema
 */
export async function getRoles(): Promise<ApiResponse<RoleWithUserCount[]>> {
  try {
    // Validar autenticación
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: "No autenticado",
      };
    }

    const roles = await db.role.findMany({
      orderBy: { createdAt: "asc" },
    });

    const roleCounts = await db.user.groupBy({
      by: ["roleLegacy"],
      _count: { _all: true },
    });
    const countsByName = new Map(
      roleCounts.map(({ roleLegacy, _count }) => [
        roleLegacy.toUpperCase(),
        _count._all,
      ])
    );
    const rolesWithCounts = roles.map((role) => ({
      ...role,
      _count: { users: countsByName.get(role.name.toUpperCase()) ?? 0 },
    }));

    return { success: true, data: rolesWithCounts };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al obtener roles",
    };
  }
}

/**
 * Crea un nuevo rol
 * Solo accesible para ADMIN
 */
export async function createRole(
  input: unknown
): Promise<ApiResponse<Role>> {
  try {
    // 1. Validar autenticación y permisos
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return {
        success: false,
        error: "No autorizado. Solo los administradores pueden crear roles.",
      };
    }

    // 2. Validar datos con Zod
    const validatedData = roleSchema.parse(input);

    // 3. Verificar que el nombre no exista ya (case insensitive)
    const existingRole = await db.role.findFirst({
      where: {
        name: {
          equals: validatedData.name,
          mode: "insensitive",
        },
      },
    });

    if (existingRole) {
      return {
        success: false,
        error: `Ya existe un rol con el nombre "${validatedData.name}"`,
      };
    }

    // 4. Crear el rol
    const role = await db.role.create({
      data: {
        name: validatedData.name,
        description: validatedData.description || null,
      },
    });

    // 5. Revalidar rutas
    revalidatePath("/admin/users");

    return { success: true, data: role };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al crear rol",
    };
  }
}

/**
 * Actualiza un rol existente
 * Solo accesible para ADMIN
 */
export async function updateRole(
  roleId: string,
  input: unknown
): Promise<ApiResponse<Role>> {
  try {
    // 1. Validar autenticación y permisos
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return {
        success: false,
        error: "No autorizado. Solo los administradores pueden actualizar roles.",
      };
    }

    // 2. Validar datos con Zod
    const validatedData = roleSchema.parse(input);

    // 3. Verificar que el rol existe
    const existingRole = await db.role.findUnique({
      where: { id: roleId },
    });

    if (!existingRole) {
      return {
        success: false,
        error: "Rol no encontrado",
      };
    }

    // 4. Verificar duplicados (si se está cambiando el nombre)
    if (validatedData.name !== existingRole.name) {
      const duplicateRole = await db.role.findFirst({
        where: {
          name: {
            equals: validatedData.name,
            mode: "insensitive",
          },
          NOT: {
            id: roleId,
          },
        },
      });

      if (duplicateRole) {
        return {
          success: false,
          error: `Ya existe un rol con el nombre "${validatedData.name}"`,
        };
      }
    }

    // 5. Actualizar el rol
    const role = await db.role.update({
      where: { id: roleId },
      data: {
        name: validatedData.name,
        description: validatedData.description || null,
      },
    });

    // 6. Revalidar rutas
    revalidatePath("/admin/users");

    return { success: true, data: role };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al actualizar rol",
    };
  }
}

/**
 * Elimina un rol
 * Solo accesible para ADMIN
 * Importante: Valida que no tenga usuarios asignados antes de borrar
 */
export async function deleteRole(
  roleId: string
): Promise<ApiResponse<{ success: boolean }>> {
  try {
    // 1. Validar autenticación y permisos
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return {
        success: false,
        error: "No autorizado. Solo los administradores pueden eliminar roles.",
      };
    }

    // 2. Verificar que el rol existe y contar usuarios asignados
    const role = await db.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      return {
        success: false,
        error: "Rol no encontrado",
      };
    }

    // 3. Validar que no tenga usuarios asignados
    const assignedUsers = await db.user.count({
      where: { roleLegacy: role.name.toUpperCase() },
    });
    if (assignedUsers > 0) {
      return {
        success: false,
        error: `No se puede eliminar el rol "${role.name}" porque tiene ${assignedUsers} usuario(s) asignado(s). Asigna primero otros roles a estos usuarios.`,
      };
    }

    // 4. Eliminar el rol
    await db.role.delete({
      where: { id: roleId },
    });

    // 5. Revalidar rutas
    revalidatePath("/admin/users");

    return { success: true, data: { success: true } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al eliminar rol",
    };
  }
}

