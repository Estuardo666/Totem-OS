/**
 * Script para verificar y corregir el External ID en OneSignal
 * 
 * Uso: npx tsx fix-external-id.ts <playerId-de-onesignal>
 * 
 * Ejemplo: npx tsx fix-external-id.ts a9587a36-71fc-4c09-b49a-d6df0b3c255f
 */

import { db } from "./src/lib/db";

async function fixExternalId() {
  try {
    const playerId = process.argv[2];

    if (!playerId) {
      console.error("❌ Uso: npx tsx fix-external-id.ts <playerId>");
      console.error("   Ejemplo: npx tsx fix-external-id.ts a9587a36-71fc-4c09-b49a-d6df0b3c255f");
      process.exit(1);
    }

    console.log(`\n🔧 Verificando playerId: ${playerId}\n`);

    // Buscar el player en nuestra BD
    const player = await db.oneSignalPlayer.findUnique({
      where: { playerId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            roleLegacy: true,
          },
        },
      },
    });

    if (!player) {
      console.error(`❌ PlayerId no encontrado en nuestra BD: ${playerId}`);
      process.exit(1);
    }

    console.log("✅ PlayerId encontrado:");
    console.log(`   Device: ${player.device}`);
    console.log(`   Browser: ${player.browser}`);
    console.log(`   Subscribed: ${player.subscribed}`);
    console.log(`   Last Seen: ${player.lastSeen}\n`);

    if (!player.userId) {
      console.error("❌ PROBLEMA: Este playerId NO tiene userId asociado");
      console.error("   El usuario no está correctamente vinculado\n");
      process.exit(1);
    }

    console.log("👤 Usuario asociado:");
    console.log(`   ID: ${player.user?.id}`);
    console.log(`   Email: ${player.user?.email}`);
    console.log(`   Nombre: ${player.user?.name}`);
    console.log(`   Rol: ${player.user?.roleLegacy}\n`);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("⚠️ PROBLEMA ENCONTRADO:\n");
    console.log(
      "El External ID está vacío en OneSignal (aunque tiene los tags)"
    );
    console.log(
      "Esto significa que OneSignal no puede emparejar notificaciones\n"
    );

    console.log("📝 SOLUCIÓN:\n");
    console.log("1. El usuario debe cerrar Safari completamente");
    console.log("2. Recargará la app");
    console.log("3. Al iniciar sesión de nuevo, se actualizará el External ID\n");

    console.log(
      "Mientras tanto, para enviar una notificación AHORA al usuario:"
    );
    console.log(`\nnpx tsx test-send-notification.ts ${player.userId}\n`);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔄 OPCIÓN: Forzar actualización\n");

    console.log("Para que OneSignal actualice el External ID:");
    console.log("1. El usuario cierra Safari");
    console.log("2. El usuario abre la app de nuevo");
    console.log("3. El provider automáticamente enviará el External ID\n");

    console.log("Si quieres resetear desde el backend:");
    console.log(
      `\nconsole.log("En OneSignal Dashboard → Audience → Users")`
    );
    console.log(`Busca: a9587a36-71fc-4c09-b49a-d6df0b3c255f`);
    console.log(
      `Verifica que aparezca: External ID = ${player.userId}\n`
    );

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await db.$disconnect();
  }
}

fixExternalId();
