"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ApiResponse } from "@/types";
import { userCreateSchema, userUpdateSchema } from "@/schemas/admin-schemas";
import bcrypt from "bcryptjs";
import type { Prisma, User } from "@prisma/client";
import { normalizeCanonicalRole, resolveRoleCode, type CanonicalRole } from "@/lib/roles";

// Nunca exponemos el hash de contraseña a componentes cliente.
export type AdminUserWithRelations = Omit<User, "password"> & {
  _count: {
    tasksAsEditor: number;
    tasksAsCommunity: number;
  };
};

/**
 * Obtiene todos los usuarios
 * Solo accesible para ADMIN
 */
export async function getUsers(): Promise<ApiResponse<AdminUserWithRelations[]>> {
  try {
    const session = await auth();
    if (!session?.user || resolveRoleCode(session.user) !== "ADMIN") {
      return { success: false, error: "No autorizado." };
    }

    const users = await db.user.findMany({
      include: {
        _count: {
          select: {
            tasksAsEditor: true,
            tasksAsCommunity: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const usersWithoutPassword = users.map((user) => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    return { success: true, data: usersWithoutPassword };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error" };
  }
}

/**
 * Crea un nuevo usuario
 * Default: roleLegacy: "EDITOR", specialty: null
 */
export async function createUser(input: unknown): Promise<ApiResponse<AdminUserWithRelations>> {
  try {
    const session = await auth();
    if (!session?.user || resolveRoleCode(session.user) !== "ADMIN") {
      return { success: false, error: "No autorizado." };
    }

    const validatedData = userCreateSchema.parse(input);

    // Verificar duplicados
    const existingUser = await db.user.findUnique({ where: { email: validatedData.email } });
    if (existingUser) return { success: false, error: "Email ya existe" };

    const hashedPassword = await bcrypt.hash(validatedData.password, 10);
    const roleCode = resolveRoleCode(validatedData) ?? "EDITOR";

    const user = await db.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        image: validatedData.image || null,
        roleLegacy: roleCode,
        roleCode,
        specialty: validatedData.specialty || null,
      },
      include: { _count: { select: { tasksAsEditor: true, tasksAsCommunity: true } } },
    });

    revalidatePath("/admin/users");
    const { password, ...userWithoutPassword } = user;
    return { success: true, data: userWithoutPassword };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error" };
  }
}

/**
 * Actualiza un usuario existente
 */
export async function updateUser(userId: string, input: unknown): Promise<ApiResponse<AdminUserWithRelations>> {
  try {
    const session = await auth();
    if (!session?.user || resolveRoleCode(session.user) !== "ADMIN") {
      return { success: false, error: "No autorizado." };
    }

    const validatedData = userUpdateSchema.parse(input);

    const existingUser = await db.user.findUnique({ where: { id: userId } });
    if (!existingUser) return { success: false, error: "Usuario no encontrado" };

    // Verificar duplicados de email
    if (validatedData.email && validatedData.email !== existingUser.email) {
      const duplicate = await db.user.findUnique({ where: { email: validatedData.email } });
      if (duplicate) return { success: false, error: "Email ya existe" };
    }

    const updateData: Prisma.UserUpdateInput = {
      ...(validatedData.name && { name: validatedData.name }),
      ...(validatedData.email && { email: validatedData.email }),
      ...(validatedData.image !== undefined && { image: validatedData.image }),
      ...(validatedData.specialty !== undefined && { specialty: validatedData.specialty }),
    };

    const requestedRole = validatedData.roleCode ?? validatedData.roleLegacy;
    if (requestedRole !== undefined) {
      const roleCode = normalizeCanonicalRole(requestedRole);
      if (roleCode) {
        updateData.roleCode = roleCode;
        updateData.roleLegacy = roleCode;
      }
    }

    if (validatedData.password) {
      updateData.password = await bcrypt.hash(validatedData.password, 10);
    }

    const user = await db.user.update({
      where: { id: userId },
      data: updateData,
      include: { _count: { select: { tasksAsEditor: true, tasksAsCommunity: true } } },
    });

    revalidatePath("/admin/users");
    const { password, ...userWithoutPassword } = user;
    return { success: true, data: userWithoutPassword };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error" };
  }
}

/**
 * Elimina un usuario
 */
export async function deleteUser(userId: string): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const session = await auth();
    if (!session?.user || resolveRoleCode(session.user) !== "ADMIN") {
      return { success: false, error: "No autorizado." };
    }

    if (session.user.id === userId) {
      return { success: false, error: "No puedes eliminarte a ti mismo" };
    }

    await db.user.delete({ where: { id: userId } });
    revalidatePath("/admin/users");

    return { success: true, data: { success: true } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error" };
  }
}

/**
 * CORRECCIÓN DE DATOS: Normaliza roles legacy
 * Esta función corrige usuarios que tengan "CLIENTE" o valores incorrectos en roleLegacy
 * y los establece a "EDITOR" por defecto.
 */
export async function fixUserRoles(): Promise<ApiResponse<{ updated: number }>> {
  try {
    const session = await auth();
    if (!session?.user || resolveRoleCode(session.user) !== "ADMIN") {
      return { success: false, error: "No autorizado." };
    }

    // Buscar usuarios con valores legacy o canónicos inválidos. El backfill
    // nunca eleva un valor desconocido: lo convierte al rol mínimo USER.
    const users = await db.user.findMany({
      select: { id: true, roleLegacy: true, roleCode: true },
    });
    const usersToFix = users.filter((user) => {
      const expected = normalizeCanonicalRole(user.roleLegacy) ?? "USER";
      return user.roleCode !== expected || normalizeCanonicalRole(user.roleCode) === null;
    });

    if (usersToFix.length === 0) {
      return { success: true, data: { updated: 0 }, message: "No se encontraron usuarios con roles inválidos." };
    }

    // Actualizar ambos campos en una sola operación lógica.
    for (const user of usersToFix) {
      const roleCode: CanonicalRole = normalizeCanonicalRole(user.roleLegacy) ?? "USER";
      await db.user.update({
        where: { id: user.id },
        data: { roleLegacy: roleCode, roleCode }
      });
    }

    revalidatePath("/admin/users");
    return { success: true, data: { updated: usersToFix.length } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error" };
  }
}
