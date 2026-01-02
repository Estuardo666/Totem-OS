/**
 * Script de ejemplo para configurar métricas dinámicas por cliente
 * 
 * PASOS PARA USAR:
 * 1. Ejecutar `npx prisma db push` para actualizar el esquema
 * 2. Copiar este código donde necesites configurar un cliente
 * 3. Reemplazar los IDs de ejemplo con IDs reales de tus clientes
 */

import { updateClientMetricsConfig } from "@/actions/client-actions";

// Ejemplo 1: Configurar cliente con solo métricas de Meta
async function configurarClienteMeta() {
  const result = await updateClientMetricsConfig(
    "clx123abc456", // ← REEMPLAZA CON ID REAL DEL CLIENTE
    [
      "metaViews",
      "metaLikes",
      "metaShares",
      "metaComments",
      "metaSaves",
      "metaReach"
    ]
  );

  if (result.success) {
    console.log("✅ Cliente configurado con métricas Meta");
  } else {
    console.error("❌ Error:", result.error);
  }
}

// Ejemplo 2: Configurar cliente con métricas de ambas plataformas + business impact
async function configurarClienteFull() {
  const result = await updateClientMetricsConfig(
    "clx789def012", // ← REEMPLAZA CON ID REAL DEL CLIENTE
    [
      // Meta
      "metaViews",
      "metaLikes",
      "metaShares",
      "metaComments",
      "metaSaves",
      "metaReach",
      // TikTok
      "ttViews",
      "ttLikes",
      "ttShares",
      "ttComments",
      "ttSaves",
      // Business Impact
      "conversions",
      "salesCount",
      "revenue",
      "conversionSource"
    ]
  );

  if (result.success) {
    console.log("✅ Cliente configurado con métricas completas");
  } else {
    console.error("❌ Error:", result.error);
  }
}

// Ejemplo 3: Configurar cliente con métricas básicas
async function configurarClienteBasico() {
  const result = await updateClientMetricsConfig(
    "clx345ghi678", // ← REEMPLAZA CON ID REAL DEL CLIENTE
    [
      "metaViews",
      "metaLikes",
      "ttViews",
      "ttLikes"
    ]
  );

  if (result.success) {
    console.log("✅ Cliente configurado con métricas básicas");
  } else {
    console.error("❌ Error:", result.error);
  }
}

// Ejemplo 4: Actualizar configuración existente
async function actualizarConfiguracion(clientId: string, nuevasMetricas: string[]) {
  const result = await updateClientMetricsConfig(clientId, nuevasMetricas);
  
  if (result.success) {
    console.log("✅ Configuración actualizada");
    console.log("Cliente:", result.data?.name);
    console.log("Nuevas métricas:", nuevasMetricas);
  } else {
    console.error("❌ Error:", result.error);
  }
}

// Ejemplo 5: Ver qué métricas tiene configuradas un cliente
async function verificarConfiguracion(clientId: string) {
  // Esto se hace automáticamente en el componente, pero puedes verificarlo así:
  const { getEnabledMetricsForClient } = await import("@/actions/content-actions");
  const metricas = await getEnabledMetricsForClient(clientId);
  
  console.log("📊 Métricas habilitadas para el cliente:", metricas);
  return metricas;
}

// USO EN LA APLICACIÓN:
// 1. En algún lugar donde configures clientes (ej: página de edición de cliente)
// 2. Llama a updateClientMetricsConfig con el ID del cliente y el array de métricas
// 3. El EditTaskModal detectará automáticamente esta configuración al abrirse

// EJEMPLO DE USO EN UN COMPONENTE:
/*
"use client";

import { updateClientMetricsConfig } from "@/actions/client-actions";
import { Button } from "@/components/ui/button";

export function MetricsConfigurator({ clientId }: { clientId: string }) {
  const handleConfigure = async () => {
    const metricasMeta = ["metaViews", "metaLikes", "metaComments", "metaReach"];
    const result = await updateClientMetricsConfig(clientId, metricasMeta);
    
    if (result.success) {
      alert("Configuración guardada!");
    }
  };

  return <Button onClick={handleConfigure}>Configurar Métricas Meta</Button>;
}
*/
