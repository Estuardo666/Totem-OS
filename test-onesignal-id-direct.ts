/**
 * Script para probar envío directo al OneSignal ID real
 * 
 * Uso: npx tsx test-onesignal-id-direct.ts
 */

// Importar para cargar env vars
import { db } from "./src/lib/db";

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

// El OneSignal ID que mostró el Dashboard (iPhone de Paty)
const REAL_ONESIGNAL_ID = "a9587a36-71fc-4c09-b49a-d6df0b3c255f";

async function testDirectSend() {
  console.log("\n🧪 Test de envío DIRECTO al OneSignal ID real\n");
  console.log(`📱 OneSignal ID: ${REAL_ONESIGNAL_ID}\n`);

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    headings: { en: "🧪 Test Directo" },
    contents: { en: "Enviado con el OneSignal ID real del Dashboard" },
    include_subscription_ids: [REAL_ONESIGNAL_ID],
  };

  console.log("Payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log("\nRespuesta:", JSON.stringify(result, null, 2));

    if (result.recipients > 0) {
      console.log(`\n✅ ¡FUNCIONÓ! Enviado a ${result.recipients} recipient(s)`);
      console.log("\n💡 CONCLUSIÓN:");
      console.log("   El OneSignal ID del Dashboard es el CORRECTO");
      console.log("   El problema es que nuestra BD tiene playerIds DIFERENTES");
      console.log("   Necesitamos actualizar cómo guardamos el ID en el cliente");
    } else {
      console.log(`\n❌ No se envió. Errores:`, result.errors);
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await db.$disconnect();
  }
}

testDirectSend();
