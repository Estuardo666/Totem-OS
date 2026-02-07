/**
 * Script para limpiar players antiguos/inválidos
 */

import { db } from "./src/lib/db";

async function cleanOldPlayers() {
  console.log("🧹 Limpiando players antiguos de OneSignal...\n");

  try {
    // Eliminar todos los players existentes (para empezar de nuevo)
    const deleted = await db.oneSignalPlayer.deleteMany({});
    
    console.log(`✅ ${deleted.count} player(s) eliminados`);
    console.log("\n💡 Ahora:");
    console.log("   1. Reinicia el servidor: npm run dev");
    console.log("   2. Abre la app en el navegador");
    console.log("   3. Acepta las notificaciones cuando lo pida");
    console.log("   4. Ejecuta: npx tsx test-push-quick.ts\n");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await db.$disconnect();
  }
}

cleanOldPlayers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error fatal:", error);
    process.exit(1);
  });
