/**
 * Script de prueba RÁPIDO para notificaciones PUSH a administradores
 * Ejecutar: npx tsx test-push-quick.ts
 */

import { db } from "./src/lib/db";

async function testPushQuick() {
  console.log("🧪 Test rápido de notificaciones PUSH...\n");

  try {
    const { notifyAdminsWithPush } = await import("./src/actions/notification-actions");

    // Test único combinado
    console.log("🔔 Enviando notificación de prueba a admins...");
    const result = await notifyAdminsWithPush(
      "🧪 Test de notificaciones PUSH",
      "Este es un test de las notificaciones PUSH para administradores. Si recibes esto, ¡todo funciona correctamente! ✅",
      "ADMIN_ALERT",
      "/admin"
    );

    console.log("\n📊 RESULTADO:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    if (result.success) {
      console.log(`✅ Notificaciones enviadas exitosamente`);
      console.log(`   📱 In-app (Pusher): ${result.data?.inAppCount ?? 0} admins`);
      console.log(`   🔔 PUSH (OneSignal): ${result.data?.pushSent ? "✅ Enviada" : "❌ Falló"}`);
      console.log("\n💡 Revisa tu dispositivo para ver la notificación PUSH.");
      console.log("💡 Revisa el dashboard para ver la notificación in-app.");
    } else {
      console.log(`❌ Error: ${result.error}`);
      console.log("\n⚠️ Verifica:");
      console.log("   • Variables de entorno de OneSignal");
      console.log("   • Que existan usuarios ADMIN en la BD");
      console.log("   • Que los usuarios tengan suscripción PUSH activa");
    }

  } catch (error) {
    console.error("\n❌ Error durante el test:", error);
    if (error instanceof Error) {
      console.error("   Mensaje:", error.message);
    }
  } finally {
    await db.$disconnect();
    console.log("\n🔌 Test completado.");
  }
}

testPushQuick()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n💥 Error fatal:", error);
    process.exit(1);
  });
