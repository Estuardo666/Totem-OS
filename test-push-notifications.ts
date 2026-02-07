/**
 * Script de prueba para notificaciones PUSH a administradores
 * Ejecutar: npx tsx test-push-notifications.ts
 */

import { db } from "./src/lib/db";

async function testPushNotifications() {
  console.log("🧪 Iniciando prueba de notificaciones PUSH...\n");

  try {
    // Importar la función de notificación
    const { notifyAdminsWithPush } = await import("./src/actions/notification-actions");

    // 1. Test: Notificación de nuevo gasto
    console.log("📝 Test 1: Notificación de gasto...");
    const test1 = await notifyAdminsWithPush(
      "Nuevo gasto registrado",
      "Test: Se registró un gasto de $150 en Comida",
      "ADMIN_ALERT",
      "/finance/expenses"
    );
    console.log(test1.success ? "✅ Gasto OK" : `❌ Error: ${test1.error}`);
    console.log(`   In-app: ${test1.data?.inAppCount ?? 0}, PUSH: ${test1.data?.pushSent ? "✅" : "❌"}\n`);

    await sleep(2000);

    // 2. Test: Notificación de nuevo ingreso
    console.log("💰 Test 2: Notificación de ingreso...");
    const test2 = await notifyAdminsWithPush(
      "Nuevo ingreso registrado",
      "Test: Se registró un ingreso de $500 - Pago cliente",
      "ADMIN_ALERT",
      "/finance"
    );
    console.log(test2.success ? "✅ Ingreso OK" : `❌ Error: ${test2.error}`);
    console.log(`   In-app: ${test2.data?.inAppCount ?? 0}, PUSH: ${test2.data?.pushSent ? "✅" : "❌"}\n`);

    await sleep(2000);

    // 3. Test: Notificación de nueva tarea
    console.log("📋 Test 3: Notificación de tarea...");
    const test3 = await notifyAdminsWithPush(
      "Nueva tarea creada",
      "Test: Se creó una nueva tarea asignada: Post Instagram - Cliente Demo",
      "ADMIN_ALERT",
      "/content"
    );
    console.log(test3.success ? "✅ Tarea OK" : `❌ Error: ${test3.error}`);
    console.log(`   In-app: ${test3.data?.inAppCount ?? 0}, PUSH: ${test3.data?.pushSent ? "✅" : "❌"}\n`);

    await sleep(2000);

    // 4. Test: Notificación de nuevo rodaje
    console.log("🎬 Test 4: Notificación de rodaje...");
    const test4 = await notifyAdminsWithPush(
      "Nuevo rodaje creado",
      "Test: Se creó un nuevo rodaje: Sesión producto - Cliente Demo (08/02/2026 10:00)",
      "ADMIN_ALERT",
      "/content/shoots"
    );
    console.log(test4.success ? "✅ Rodaje OK" : `❌ Error: ${test4.error}`);
    console.log(`   In-app: ${test4.data?.inAppCount ?? 0}, PUSH: ${test4.data?.pushSent ? "✅" : "❌"}\n`);

    // Resumen
    console.log("\n📊 RESUMEN DE PRUEBAS:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    const totalTests = 4;
    const successTests = [test1, test2, test3, test4].filter(t => t.success).length;
    console.log(`Total: ${successTests}/${totalTests} tests exitosos`);
    
    if (successTests === totalTests) {
      console.log("\n✅ Todas las notificaciones PUSH funcionan correctamente!");
      console.log("🔔 Revisa tu dispositivo para ver las notificaciones.");
    } else {
      console.log("\n⚠️ Algunos tests fallaron. Revisa la configuración de OneSignal.");
    }

  } catch (error) {
    console.error("\n❌ Error durante las pruebas:", error);
    if (error instanceof Error) {
      console.error("   Mensaje:", error.message);
      console.error("   Stack:", error.stack);
    }
  } finally {
    await db.$disconnect();
    console.log("\n🔌 Conexión a BD cerrada.");
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Ejecutar pruebas
testPushNotifications()
  .then(() => {
    console.log("\n✨ Pruebas completadas.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Error fatal:", error);
    process.exit(1);
  });
