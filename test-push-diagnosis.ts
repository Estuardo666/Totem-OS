/**
 * Script de diagnóstico de notificaciones PUSH
 * Verifica configuración y suscripciones
 */

import { db } from "./src/lib/db";

async function diagnosePush() {
  console.log("🔍 DIAGNÓSTICO DE NOTIFICACIONES PUSH\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  try {
    // 1. Verificar variables de entorno
    console.log("1️⃣ Variables de entorno:");
    const appId = process.env.ONESIGNAL_APP_ID;
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;
    const publicAppId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

    console.log(`   ONESIGNAL_APP_ID: ${appId ? "✅ Configurado" : "❌ NO configurado"}`);
    console.log(`   ONESIGNAL_REST_API_KEY: ${apiKey ? "✅ Configurado" : "❌ NO configurado"}`);
    console.log(`   NEXT_PUBLIC_ONESIGNAL_APP_ID: ${publicAppId ? "✅ Configurado" : "❌ NO configurado"}`);
    console.log();

    // 2. Verificar admins en BD
    console.log("2️⃣ Usuarios administradores:");
    const admins = await db.user.findMany({
      where: { roleLegacy: "ADMIN" },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });
    console.log(`   Total: ${admins.length} admins`);
    admins.forEach((admin, i) => {
      console.log(`   ${i + 1}. ${admin.name} (${admin.email})`);
      console.log(`      ID: ${admin.id}`);
    });
    console.log();

    // 3. Verificar suscripciones OneSignal
    console.log("3️⃣ Suscripciones OneSignal (Players):");
    const players = await db.oneSignalPlayer.findMany();

    if (players.length === 0) {
      console.log("   ❌ NO hay ningún usuario suscrito a notificaciones PUSH");
      console.log("   💡 Solución: Abre la app en el navegador y acepta las notificaciones");
    } else {
      console.log(`   Total: ${players.length} suscripciones`);
      
      // Obtener usuarios para los players
      const userIds = players.map(p => p.userId).filter((id): id is string => id !== null);
      const users = await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, roleLegacy: true },
      });
      const userMap = new Map(users.map(u => [u.id, u]));

      players.forEach((player, i) => {
        const user = player.userId ? userMap.get(player.userId) : null;
        const isAdmin = user?.roleLegacy === "ADMIN";
        const status = player.subscribed ? "✅ Activo" : "❌ Inactivo";
        console.log(`   ${i + 1}. ${user?.name || "Usuario desconocido"} ${isAdmin ? "👑" : ""}`);
        console.log(`      Player ID: ${player.playerId}`);
        console.log(`      User ID: ${player.userId || "No asignado"}`);
        console.log(`      Estado: ${status}`);
        console.log(`      Creado: ${player.createdAt.toLocaleString()}`);
      });

      // Verificar si hay admins suscritos
      const adminPlayerCount = players.filter(p => {
        const user = p.userId ? userMap.get(p.userId) : null;
        return user?.roleLegacy === "ADMIN" && p.subscribed;
      }).length;
      
      console.log();
      if (adminPlayerCount === 0) {
        console.log("   ⚠️ ADVERTENCIA: Ningún ADMIN está suscrito a notificaciones PUSH");
        console.log("   💡 Solución: Los admins deben abrir la app y aceptar las notificaciones");
      } else {
        console.log(`   ✅ ${adminPlayerCount} admin(s) suscrito(s) correctamente`);
      }
    }
    console.log();

    // 4. Test de envío
    console.log("4️⃣ Test de envío:");
    if (players.length > 0 && appId && apiKey) {
      console.log("   Enviando notificación de prueba...");
      
      const { sendPushNotification } = await import("./src/actions/onesignal-actions");
      
      const adminIds = admins.map(a => a.id);
      const result = await sendPushNotification({
        title: "🔔 Test de diagnóstico",
        message: "Si recibes esta notificación, ¡todo funciona correctamente!",
        userIds: adminIds,
        url: "/admin",
      });

      if (result.success) {
        console.log("   ✅ Notificación enviada a OneSignal");
        console.log(`   📊 Notificación ID: ${result.data?.notificationId}`);
        console.log(`   📱 Destinatarios: ${result.data?.recipients ?? "undefined"}`);
      } else {
        console.log(`   ❌ Error al enviar: ${result.error}`);
      }
    } else {
      console.log("   ⏭️ Saltando test (falta configuración o suscripciones)");
    }
    console.log();

    // 5. Recomendaciones
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 RECOMENDACIONES:\n");

    if (!appId || !apiKey) {
      console.log("❌ Configura las variables de entorno de OneSignal en .env");
    }

    if (players.length === 0) {
      console.log("⚠️ PASO CRÍTICO: Debes suscribirte a las notificaciones:");
      console.log("   1. Abre la app en tu navegador");
      console.log("   2. Acepta el permiso de notificaciones cuando aparezca");
      console.log("   3. Verifica que el ícono de campana muestre estado activo");
    }

    const userIds = players.map(p => p.userId).filter((id): id is string => id !== null);
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, roleLegacy: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));
    const adminPlayerCount = players.filter(p => {
      const user = p.userId ? userMap.get(p.userId) : null;
      return user?.roleLegacy === "ADMIN" && p.subscribed;
    }).length;

    if (players.length > 0 && adminPlayerCount === 0) {
      console.log("⚠️ Los admins necesitan suscribirse a las notificaciones");
    }

    if (players.length > 0 && adminPlayerCount > 0) {
      console.log("✅ Todo está configurado correctamente");
      console.log("💡 Si aún no recibes notificaciones:");
      console.log("   • Verifica que los permisos del navegador estén activos");
      console.log("   • Revisa la consola del navegador por errores");
      console.log("   • Asegúrate de estar usando HTTPS o localhost");
    }

  } catch (error) {
    console.error("\n❌ Error durante el diagnóstico:", error);
    if (error instanceof Error) {
      console.error("   Mensaje:", error.message);
    }
  } finally {
    await db.$disconnect();
    console.log("\n🔌 Diagnóstico completado.");
  }
}

diagnosePush()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n💥 Error fatal:", error);
    process.exit(1);
  });
