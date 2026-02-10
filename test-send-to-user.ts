/**
 * Script para enviar notificación de prueba directamente a un usuario específico
 * y diagnosticar qué está pasando con OneSignal
 * 
 * Uso: npx tsx test-send-to-user.ts <email>
 */

import { db } from "./src/lib/db";

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

async function testSendToUser() {
  try {
    const email = process.argv[2] || "totemcisnemedia@gmail.com";

    console.log(`\n🧪 Test de envío directo a: ${email}\n`);

    // Buscar usuario
    const user = await db.user.findFirst({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      console.error("❌ Usuario no encontrado");
      process.exit(1);
    }

    console.log(`👤 Usuario: ${user.name} (${user.id})\n`);

    // Buscar sus playerIds
    const players = await db.oneSignalPlayer.findMany({
      where: { userId: user.id, subscribed: true },
    });

    console.log(`📱 Devices encontrados: ${players.length}`);
    for (const p of players) {
      console.log(`   - ${p.device}: ${p.playerId}`);
    }

    if (players.length === 0) {
      console.error("❌ No hay devices suscritos");
      process.exit(1);
    }

    const playerIds = players.map((p) => p.playerId);

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📤 MÉTODO 1: Envío por include_subscription_ids (nuevo)\n");

    // Método 1: Usar include_subscription_ids (nuevo en OneSignal v16)
    const payload1 = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: "🧪 Test Método 1" },
      contents: { en: "Enviado con include_subscription_ids" },
      include_subscription_ids: playerIds,
    };

    console.log("Payload:", JSON.stringify(payload1, null, 2));

    const response1 = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload1),
    });

    const result1 = await response1.json();
    console.log("\nRespuesta:", JSON.stringify(result1, null, 2));

    if (result1.recipients > 0) {
      console.log(`✅ Método 1 FUNCIONÓ: ${result1.recipients} recipient(s)`);
    } else {
      const errMsg = result1.errors ? JSON.stringify(result1.errors) : "0 recipients";
      console.log(`❌ Método 1 NO envió: ${errMsg}`);
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📤 MÉTODO 2: Envío por include_player_ids (antiguo)\n");

    // Método 2: Usar include_player_ids (antiguo)
    const payload2 = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: "🧪 Test Método 2" },
      contents: { en: "Enviado con include_player_ids" },
      include_player_ids: playerIds,
    };

    console.log("Payload:", JSON.stringify(payload2, null, 2));

    const response2 = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload2),
    });

    const result2 = await response2.json();
    console.log("\nRespuesta:", JSON.stringify(result2, null, 2));

    if (result2.recipients > 0) {
      console.log(`✅ Método 2 FUNCIONÓ: ${result2.recipients} recipient(s)`);
    } else {
      const errMsg = result2.errors ? JSON.stringify(result2.errors) : "0 recipients";
      console.log(`❌ Método 2 NO envió: ${errMsg}`);
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📤 MÉTODO 3: Envío por external_id (usando aliases)\n");

    // Método 3: Usar include_aliases con external_id
    const payload3 = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: "🧪 Test Método 3" },
      contents: { en: "Enviado con external_id (alias)" },
      include_aliases: {
        external_id: [user.id],
      },
      target_channel: "push",
    };

    console.log("Payload:", JSON.stringify(payload3, null, 2));

    const response3 = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload3),
    });

    const result3 = await response3.json();
    console.log("\nRespuesta:", JSON.stringify(result3, null, 2));

    if (result3.recipients > 0) {
      console.log(`✅ Método 3 FUNCIONÓ: ${result3.recipients} recipient(s)`);
    } else {
      const errMsg = result3.errors ? JSON.stringify(result3.errors) : "0 recipients";
      console.log(`❌ Método 3 NO envió: ${errMsg}`);
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📤 MÉTODO 4: Envío a segmento 'Subscribed Users'\n");

    // Método 4: Enviar a todos los suscritos
    const payload4 = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: "🧪 Test Método 4 (Broadcast)" },
      contents: { en: "Enviado a TODOS los suscritos" },
      included_segments: ["Subscribed Users"],
    };

    console.log("Payload:", JSON.stringify(payload4, null, 2));

    const response4 = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload4),
    });

    const result4 = await response4.json();
    console.log("\nRespuesta:", JSON.stringify(result4, null, 2));

    if (result4.recipients > 0) {
      console.log(`✅ Método 4 FUNCIONÓ: ${result4.recipients} recipient(s)`);
    } else {
      const errMsg = result4.errors ? JSON.stringify(result4.errors) : "0 recipients";
      console.log(`❌ Método 4 NO envió: ${errMsg}`);
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 RESUMEN:\n");
    console.log("Si el usuario recibió alguna notificación, ese método funciona.");
    console.log("Verifica con el usuario cuáles de los 4 tests recibió.\n");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await db.$disconnect();
  }
}

testSendToUser();
