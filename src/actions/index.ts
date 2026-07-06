// Server Actions centralizadas
// Todas las mutaciones de DB deben estar aquí

// Las acciones se organizarán por dominio:
// - user.actions.ts
// - client.actions.ts
// - content.actions.ts
// - finance.actions.ts

// Ejemplo de estructura de respuesta estándar:
// export async function actionName(input: InputType): Promise<ApiResponse<OutputType>> {
//   try {
//     // Validación con Zod
//     // Operación de DB
//     return { success: true, data: result };
//   } catch (error) {
//     return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
//   }
// }

// Exportar acciones de clientes
export { createClient, getClients } from "./client-actions";

// Exportar acciones de usuarios
export { createUser, updateUser, getUsers } from "./user.actions";
export type { UserWithTaskCount } from "./user.actions";

// Exportar acciones de contenido
export {
  createTask,
  getTasks,
  updateTaskStatus,
  updateTask,
  deleteTask,
} from "./content-actions";
export type { ContentTaskWithClient } from "./content-actions";

// Exportar acciones de finanzas
export {
  getFinancialStats,
  createInvoice,
  createExpense,
} from "./finance-actions";
export type { FinancialStats } from "./finance-actions";

// Exportar acciones de IA
export { generateFinancialPredictionsAction } from "./ai-actions";

// Exportar acciones de Web Push Notifications
export {
  sendPushNotification,
  sendPushToUser,
  sendPushToAll,
  getSubscriptionStats,
} from "./push-actions";

