import Pusher from "pusher";

// Configuración del servidor de Pusher (backend)
const pusherAppId = process.env.PUSHER_APP_ID as string;
const pusherKey = process.env.PUSHER_KEY as string;
const pusherSecret = process.env.PUSHER_SECRET as string;
const pusherCluster = process.env.PUSHER_CLUSTER as string;

// 🔌 Inicialización con logs detallados
console.log("🔌 Inicializando Pusher con AppID:", process.env.PUSHER_APP_ID);
console.log("🔌 PUSHER_KEY:", pusherKey ? `${pusherKey.substring(0, 8)}...` : "undefined");
console.log("🔌 PUSHER_SECRET:", pusherSecret ? "***definido***" : "undefined");
console.log("🔌 PUSHER_CLUSTER:", pusherCluster || "undefined (usará 'us2' por defecto)");

// Validar que todas las variables estén definidas
if (!pusherAppId || !pusherKey || !pusherSecret || !pusherCluster) {
  console.warn(
    "⚠️ Pusher no está completamente configurado. Algunas variables de entorno faltan."
  );
  console.warn("⚠️ Variables faltantes:", {
    PUSHER_APP_ID: !pusherAppId ? "FALTA" : "OK",
    PUSHER_KEY: !pusherKey ? "FALTA" : "OK",
    PUSHER_SECRET: !pusherSecret ? "FALTA" : "OK",
    PUSHER_CLUSTER: !pusherCluster ? "FALTA" : "OK",
  });
}

console.log("🔌 Inicializando instancia de Pusher Server");

// Validar credenciales antes de crear la instancia
if (!pusherAppId || !pusherKey || !pusherSecret || !pusherCluster) {
  console.error("❌ [PUSHER] Faltan credenciales. No se puede inicializar Pusher Server.");
  throw new Error("Pusher credentials missing");
}

// Verificar que las credenciales tengan el formato correcto
if (pusherAppId.length < 1 || pusherKey.length < 10 || pusherSecret.length < 20) {
  console.error("❌ [PUSHER] Credenciales parecen inválidas (longitud incorrecta)");
  console.error("❌ [PUSHER] AppID length:", pusherAppId?.length || 0);
  console.error("❌ [PUSHER] Key length:", pusherKey?.length || 0);
  console.error("❌ [PUSHER] Secret length:", pusherSecret?.length || 0);
}

export const pusherServer = new Pusher({
  appId: pusherAppId,
  key: pusherKey,
  secret: pusherSecret,
  cluster: pusherCluster,
  useTLS: true,
});

console.log("✅ Instancia de Pusher Server creada exitosamente");

