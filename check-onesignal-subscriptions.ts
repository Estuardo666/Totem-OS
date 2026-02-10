/**
 * Script para verificar el estado de las suscripciones en OneSignal
 * 
 * Uso: npx tsx check-onesignal-subscriptions.ts
 */

import { db } from "./src/lib/db";

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

async function checkSubscriptions() {
  console.log("\n🔍 Verificando suscripciones en OneSignal...\n");

  try {
    // 1. Ver stats generales de OneSignal
    console.log("📊 Estadísticas de la App en OneSignal:\n");
    
    const appResponse = await fetch(`https://onesignal.com/api/v1/apps/${ONESIGNAL_APP_ID}`, {
      headers: {
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
    });
    
    const appData = await appResponse.json();
    console.log("Players:", appData.players);
    console.log("Messageable Players:", appData.messageable_players);
    
    // 2. Listar dispositivos de OneSignal
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📱 Dispositivos en OneSignal:\n");
    
    const devicesResponse = await fetch(
      `https://onesignal.com/api/v1/players?app_id=${ONESIGNAL_APP_ID}&limit=50`,
      {
        headers: {
          Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
        },
      }
    );
    
    const devicesData = await devicesResponse.json();
    
    if (devicesData.players && devicesData.players.length > 0) {
      for (const player of devicesData.players) {
        console.log(`Device: ${player.id}`);
        console.log(`  Device Type: ${player.device_type}`);
        console.log(`  Device OS: ${player.device_os}`);
        console.log(`  Device Model: ${player.device_model}`);
        console.log(`  Notification Types: ${player.notification_types}`);
        console.log(`  Invalid Identifier: ${player.invalid_identifier}`);
        console.log(`  External User ID: ${player.external_user_id}`);
        console.log(`  Tags:`, player.tags);
        console.log(`  Last Active: ${new Date(player.last_active * 1000).toLocaleString()}`);
        console.log();
      }
      
      console.log(`\nTotal: ${devicesData.total_count} dispositivos`);
    } else {
      console.log("❌ No se encontraron dispositivos");
      console.log("Respuesta:", JSON.stringify(devicesData, null, 2));
    }
    
    // 3. Comparar con nuestra BD
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🗄️ Comparación con nuestra BD:\n");
    
    const ourPlayers = await db.oneSignalPlayer.findMany({
      where: { subscribed: true },
      include: {
        user: {
          select: { email: true, name: true },
        },
      },
    });
    
    console.log(`Tenemos ${ourPlayers.length} playerIds en nuestra BD:\n`);
    
    for (const p of ourPlayers) {
      console.log(`  ${p.playerId}`);
      console.log(`    Usuario: ${p.user?.name} (${p.user?.email})`);
      console.log(`    Device: ${p.device}`);
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await db.$disconnect();
  }
}

checkSubscriptions();
