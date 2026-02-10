/**
 * Script para diagnosticar por qué un usuario ESPECÍFICO no recibe notificaciones
 * 
 * Uso: npx tsx check-user-notifications.ts <email-o-id-del-usuario>
 */

import { db } from "./src/lib/db";

async function checkUserNotifications() {
  try {
    const userIdentifier = process.argv[2];

    if (!userIdentifier) {
      console.error("❌ Uso: npx tsx check-user-notifications.ts <email-o-id-del-usuario>");
      console.error("   Ejemplo: npx tsx check-user-notifications.ts admin@totem.com");
      process.exit(1);
    }

    console.log(`\n🔍 Diagnosticando notificaciones para: ${userIdentifier}\n`);

    // Encontrar usuario
    const user = await db.user.findFirst({
      where: {
        OR: [{ id: userIdentifier }, { email: userIdentifier }],
      },
      select: {
        id: true,
        email: true,
        name: true,
        roleLegacy: true,
      },
    });

    if (!user) {
      console.error(`❌ Usuario no encontrado: ${userIdentifier}`);
      process.exit(1);
    }

    console.log("👤 Usuario encontrado:");
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Nombre: ${user.name}`);
    console.log(`   Rol: ${user.roleLegacy}\n`);

    // Buscar sus playerIds en OneSignal
    const players = await db.oneSignalPlayer.findMany({
      where: { userId: user.id },
    });

    if (players.length === 0) {
      console.error(
        `❌ PROBLEMA: Este usuario NO tiene ningún playerId registrado en la BD`
      );
      console.error(`   Esto significa que:`)
      console.error(`   1. La app no lo registró correctamente`);
      console.error(`   2. Probablemente NO aceptó el permiso de notificaciones`);
      console.error(`   3. O hay un error en el client-side al registrar\n`);
      console.error(`📱 SOLUCIÓN:`);
      console.error(`   1. Pídele que abra la app en Safari`);
      console.error(`   2. Que vaya a Settings → Safari → Notifications`);
      console.error(`   3. Habilita notificaciones para "Totem OS"`);
      console.error(`   4. Que cierre y recargue completamente Safari`);
      console.error(`   5. Que intente de nuevo\n`);
    } else {
      console.log(`✅ BIEN: El usuario tiene ${players.length} device(s) registrado(s):\n`);

      for (const player of players) {
        console.log(`📱 Device ${players.indexOf(player) + 1}:`);
        console.log(`   PlayerId: ${player.playerId}`);
        console.log(`   Device: ${player.device || "unknown"}`);
        console.log(`   Browser: ${player.browser || "unknown"}`);
        console.log(`   Subscribed: ${player.subscribed ? "✅ SÍ" : "❌ NO"}`);
        console.log(`   Last Seen: ${player.lastSeen?.toLocaleString()}`);
        console.log(`   Created: ${player.createdAt?.toLocaleString()}`);
        console.log();

        if (!player.subscribed) {
          console.error(
            `   ⚠️ PROBLEMA: Este device está marcado como NO suscrito`
          );
          console.error(`      Esto significa que el usuario hizo opt-out\n`);
          console.error(`      SOLUCIÓN: Necesita reactivar notificaciones en Safari`);
          console.error(`      Settings → Safari → Notifications → Totem OS → Allow\n`);
        }
      }
    }

    // Resumen de problemas posibles
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 CHECKLIST DE DIAGNÓSTICO\n");

    const checks = [
      {
        name: "Usuario existe en BD",
        ok: !!user,
      },
      {
        name: "Usuario tiene playerId registrado",
        ok: players.length > 0,
      },
      {
        name: "Algún device está suscrito",
        ok: players.some((p) => p.subscribed),
      },
      {
        name: "Es Admin (puede recibir notificaciones)",
        ok: user.roleLegacy === "ADMIN",
      },
    ];

    for (const check of checks) {
      console.log(`${check.ok ? "✅" : "❌"} ${check.name}`);
    }

    const allOk = checks.every((c) => c.ok);

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    if (allOk) {
      console.log("\n✅ TODO ESTÁ BIEN en la BD");
      console.log(
        "   Si sigue sin recibir notificaciones, el problema es en OneSignal"
      );
      console.log("   Ve al OneSignal Dashboard → Deliveries y busca el playerId");
    } else {
      console.log("\n❌ PROBLEMAS ENCONTRADOS");
      console.log("   Sigue los pasos de solución arriba\n");
    }

    // Instrucciones finales
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔧 PRÓXIMOS PASOS PARA EL USUARIO:\n");

    console.log("1️⃣ En Safari en el iPhone:");
    console.log("   → Settings → Safari → Notifications");
    console.log("   → Busca 'Totem OS' y asegúrate que esté en Allow");
    console.log("   → Si no está, agrégalo");

    console.log("\n2️⃣ Cierra Safari completamente:");
    console.log("   → Desliza desde el multitarea para cerrar");
    console.log("   → Espera 10 segundos");

    console.log("\n3️⃣ Recarga la app:");
    console.log("   → Abre Safari → Totem OS");
    console.log("   → Inicia sesión de nuevo");
    console.log("   → Observe la consola (F12) para ver si se registra");

    console.log("\n4️⃣ Luego ejecuta este script de nuevo para verificar:\n");
    console.log(`   npx tsx check-user-notifications.ts ${user.email}\n`);
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await db.$disconnect();
  }
}

checkUserNotifications();
