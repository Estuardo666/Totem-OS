"use server";

import { db } from "@/lib/db";
import {
  clearPrismaConnectionBackoff,
  registerPrismaConnectionIssue,
  shouldSkipPrismaConnectionAttempt,
} from "@/lib/prisma-connection-resilience";
import { createUserSchema, updateUserSchema, registerSchema, userSettingsSchema } from "@/schemas/user";
import type { ApiResponse } from "@/types";
import type { User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

function buildCurrentUserFallback(session: Awaited<ReturnType<typeof import("@/auth")["auth"]>>) {
  const now = new Date();
  const sessionUser = session?.user;

  return {
    id: sessionUser?.id || "",
    name: sessionUser?.name || "",
    firstName: null,
    lastName: null,
    email: sessionUser?.email || "",
    emailVerified: null,
    image: sessionUser?.image || null,
    password: null,
    roleLegacy: sessionUser?.roleLegacy || sessionUser?.role || "EDITOR",
    specialty: sessionUser?.specialty || null,
    salaryType: "MONTHLY",
    baseSalary: null,
    profitSharePercent: null,
    bankAccountInfo: null,
    hourlyRate: 0,
    currency: "USD",
    soundNotifications: true,
    primaryColor: sessionUser?.primaryColor || "#27221F",
    darkMode: false,
    createdAt: now,
    updatedAt: now,
  } satisfies User;
}

/**
 * Ejemplo de Server Action para crear un usuario
 * Todas las acciones deben seguir este patrón de respuesta
 */
export async function createUser(
  input: unknown
): Promise<ApiResponse<User>> {
  try {
    // 1. Validar con Zod
    const validatedData = createUserSchema.parse(input);

    // 2. Operación de DB
    const user = await db.user.create({
      data: validatedData,
    });

    // 3. Retornar éxito
    return { success: true, data: user };
  } catch (error) {
    // 4. Manejar errores
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al crear usuario",
    };
  }
}

/**
 * Ejemplo de Server Action para actualizar un usuario
 */
export async function updateUser(
  id: string,
  input: unknown
): Promise<ApiResponse<User>> {
  try {
    const validatedData = updateUserSchema.parse(input);

    const user = await db.user.update({
      where: { id },
      data: validatedData,
    });

    return { success: true, data: user };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al actualizar usuario",
    };
  }
}

/**
 * Server Action para actualizar un usuario (solo para ADMIN)
 * Valida que el ejecutor sea ADMIN y que no se quite el rol de ADMIN a sí mismo
 */
export async function updateUserAdmin(
  userId: string,
  input: unknown
): Promise<ApiResponse<User>> {
  try {
    // 1. Verificar que el usuario actual sea ADMIN
    const { auth } = await import("@/auth");
    const session = await auth();
    const currentUserId = session?.user?.id;
    const currentUserRole = session?.user?.role;

    if (!currentUserId) {
      return {
        success: false,
        error: "No autenticado",
      };
    }

    if (currentUserRole !== "ADMIN") {
      return {
        success: false,
        error: "No tienes permisos para realizar esta acción",
      };
    }

    // 2. Validar datos con Zod
    const validatedData = updateUserSchema.parse(input);

    // 3. Verificar que el usuario a actualizar existe
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, roleLegacy: true },
    });

    if (!targetUser) {
      return {
        success: false,
        error: "Usuario no encontrado",
      };
    }

    // 4. Prevenir que un ADMIN se quite el rol de ADMIN a sí mismo
    // Nota: validatedData.role no existe en el schema actual, pero mantenemos la lógica por si se añade
    // Asumimos que validatedData.roleLegacy es el campo a comprobar
    if (currentUserId === userId && validatedData.roleLegacy && validatedData.roleLegacy !== "ADMIN") {
      return {
        success: false,
        error: "No puedes quitarte el rol de ADMIN a ti mismo",
      };
    }

    // 5. Actualizar el usuario
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        ...(validatedData.name !== undefined && { name: validatedData.name }),
        ...(validatedData.email !== undefined && { email: validatedData.email }),
        ...(validatedData.roleLegacy !== undefined && { roleLegacy: validatedData.roleLegacy }),
        ...(validatedData.specialty !== undefined && { specialty: validatedData.specialty ?? null }),
        ...(validatedData.baseSalary !== undefined && { baseSalary: validatedData.baseSalary }),
      },
    });

    // 6. Revalidar rutas
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/admin/users");

    // 7. Retornar éxito (sin la contraseña)
    const { password: _, ...userWithoutPassword } = updatedUser;
    return { success: true, data: userWithoutPassword as User };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al actualizar usuario",
    };
  }
}

/**
 * Actualiza la tarifa por hora de un usuario (solo ADMIN)
 */
export async function updateUserRate(
  targetUserId: string,
  newRate: number
): Promise<ApiResponse<User>> {
  try {
    // 1. Verificar autenticación y rol
    const { auth } = await import("@/auth");
    const session = await auth();
    const currentUserId = session?.user?.id;
    const currentUserRole = session?.user?.role;

    if (!currentUserId) {
      return {
        success: false,
        error: "No autenticado",
      };
    }

    // 2. CRÍTICO: Solo ADMIN puede actualizar tarifas
    if (currentUserRole !== "ADMIN") {
      return {
        success: false,
        error: "No autorizado. Solo los administradores pueden actualizar tarifas.",
      };
    }

    // 3. Validar que el nuevo rate sea válido
    if (newRate < 0) {
      return {
        success: false,
        error: "La tarifa debe ser mayor o igual a 0",
      };
    }

    // 4. Verificar que el usuario objetivo existe
    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!targetUser) {
      return {
        success: false,
        error: "Usuario no encontrado",
      };
    }

    // 5. Actualizar la tarifa
    const updatedUser = await db.user.update({
      where: { id: targetUserId },
      data: {
        hourlyRate: newRate,
      },
    });

    // 6. Revalidar rutas
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/admin/users");
    revalidatePath("/chronos");

    // 7. Retornar éxito (sin la contraseña)
    const { password: _, ...userWithoutPassword } = updatedUser;
    return { success: true, data: userWithoutPassword as User };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al actualizar tarifa",
    };
  }
}

/**
 * Tipo para tarea activa simplificada (solo datos esenciales)
 */
export type ActiveTaskPreview = {
  id: string;
  title: string;
  client: {
    name: string;
  };
};

/**
 * Tipo extendido de User con conteo y preview de tareas activas
 */
export type UserWithTaskCount = User & {
  _count: {
    tasksAsEditor: number;
    tasksAsCommunity: number;
  };
};

/**
 * Server Action para obtener usuarios con conteo y preview de tareas activas
 */
export async function getUsers(): Promise<ApiResponse<UserWithTaskCount[]>> {
  try {
    // 0. Verificar autenticación
    const { auth } = await import("@/auth");
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "No autenticado" };
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

    return { success: true, data: users };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener usuarios",
    };
  }
}

/**
 * Server Action para registrar un nuevo usuario
 */
export async function registerUser(
  input: unknown
): Promise<ApiResponse<User>> {
  try {
    // 0. Verificar autenticación
    const { auth } = await import("@/auth");
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "No autenticado" };
    }

    // 1. Validar con Zod
    const validatedData = registerSchema.parse(input);

    // 2. Verificar si el usuario ya existe
    const existingUser = await db.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return {
        success: false,
        error: "Ya existe un usuario con este correo electrónico",
      };
    }

    // 3. Encriptar la contraseña
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // 4. Crear el usuario
    const user = await db.user.create({
      data: {
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        name: `${validatedData.firstName} ${validatedData.lastName}`,
        email: validatedData.email,
        password: hashedPassword,
        roleLegacy: "EDITOR", // Por defecto EDITOR
        specialty: null, // Sin especialidad inicial
        baseSalary: 0,
      },
    });

    // 5. Retornar éxito (sin la contraseña)
    const { password: _, ...userWithoutPassword } = user;
    return { success: true, data: userWithoutPassword as User };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al registrar usuario",
    };
  }
}

/**
 * Server Action para actualizar la configuración del usuario actual
 */
export async function updateUserSettings(
  input: unknown
): Promise<ApiResponse<User>> {
  try {
    // 1. Verificar autenticación
    const { auth } = await import("@/auth");
    const session = await auth();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      return {
        success: false,
        error: "No autenticado",
      };
    }

    // 2. Validar datos con Zod
    const validatedData = userSettingsSchema.parse(input);

    // 3. Actualizar el usuario
    const updatedUser = await db.user.update({
      where: { id: currentUserId },
      data: {
        ...(validatedData.soundNotifications !== undefined && {
          soundNotifications: validatedData.soundNotifications,
        }),
        ...(validatedData.primaryColor !== undefined && {
          primaryColor: validatedData.primaryColor,
        }),
        ...(validatedData.darkMode !== undefined && {
          darkMode: validatedData.darkMode,
        }),
      },
    });

    // 4. Revalidar el layout completo para aplicar cambios de tema
    revalidatePath("/", "layout");

    // 5. Retornar éxito (sin la contraseña)
    const { password: _, ...userWithoutPassword } = updatedUser;
    return { success: true, data: userWithoutPassword as User };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al actualizar configuración",
    };
  }
}

/**
 * Server Action para obtener el usuario actual con su configuración
 */
export async function getCurrentUser(): Promise<ApiResponse<User>> {
  try {
    const { auth } = await import("@/auth");
    const session = await auth();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      return {
        success: false,
        error: "No autenticado",
      };
    }

    if (shouldSkipPrismaConnectionAttempt()) {
      return { success: true, data: buildCurrentUserFallback(session) };
    }

    const user = await db.user.findUnique({
      where: { id: currentUserId },
    });
    clearPrismaConnectionBackoff();

    if (!user) {
      return {
        success: false,
        error: "Usuario no encontrado",
      };
    }

    const { password: _, ...userWithoutPassword } = user;
    return { success: true, data: userWithoutPassword as User };
  } catch (error) {
    const { auth } = await import("@/auth");
    const session = await auth();

    if (registerPrismaConnectionIssue(error) && session?.user?.id) {
      return { success: true, data: buildCurrentUserFallback(session) };
    }

    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener usuario",
    };
  }
}

