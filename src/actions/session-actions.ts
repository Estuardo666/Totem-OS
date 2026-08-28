"use server";

import { auth } from "@/auth";
import { pusherServer } from "@/lib/pusher";
import { resolveRoleCode } from "@/lib/roles";

export type ForceLogoutResult = {
  success: boolean;
  message: string;
  affectedUsers?: string;
};

/**
 * Envía un broadcast de logout forzado a todas las sesiones activas
 * Solo puede ser ejecutado por administradores
 */
export async function forceLogoutAllSessionsAction(): Promise<ForceLogoutResult> {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return { success: false, message: "No autenticado" };
    }

    // Solo admins pueden forzar logout
    if (resolveRoleCode(session.user) !== "ADMIN") {
      return { success: false, message: "Sin permisos de administrador" };
    }

    // Enviar evento de logout forzado a todos los clientes conectados
    await pusherServer.trigger("system", "force-logout", {
      message: "El administrador ha cerrado todas las sesiones",
      targetUserId: null, // null = afecta a todos
      timestamp: new Date().toISOString(),
    });

    console.log("🔒 [ADMIN] Broadcast de force-logout enviado a todos los usuarios");

    return {
      success: true,
      message: "Se ha enviado la orden de cerrar todas las sesiones",
      affectedUsers: "todos",
    };
  } catch (error) {
    console.error("❌ Error al enviar force-logout:", error);
    return {
      success: false,
      message: "Error al enviar la orden de cierre de sesiones",
    };
  }
}

/**
 * Envía un broadcast de logout forzado a un usuario específico
 * Solo puede ser ejecutado por administradores
 */
export async function forceLogoutUserAction(targetUserId: string): Promise<ForceLogoutResult> {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return { success: false, message: "No autenticado" };
    }

    // Solo admins pueden forzar logout
    if (resolveRoleCode(session.user) !== "ADMIN") {
      return { success: false, message: "Sin permisos de administrador" };
    }

    // Enviar evento de logout forzado al usuario específico
    await pusherServer.trigger("system", "force-logout", {
      message: "Tu sesión ha sido cerrada por el administrador",
      targetUserId: targetUserId,
      timestamp: new Date().toISOString(),
    });

    console.log(`🔒 [ADMIN] Force-logout enviado al usuario: ${targetUserId}`);

    return {
      success: true,
      message: `Se ha cerrado la sesión del usuario`,
      affectedUsers: targetUserId,
    };
  } catch (error) {
    console.error("❌ Error al enviar force-logout:", error);
    return {
      success: false,
      message: "Error al enviar la orden de cierre de sesión",
    };
  }
}
