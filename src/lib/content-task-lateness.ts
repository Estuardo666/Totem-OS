// Regla única de atrasos de contenido:
// - En Revisión Cliente la tarea espera al cliente: no cuenta como atraso del equipo.
// - Aprobada por el cliente y sin publicar: el atraso es de la Community Manager.
// - En el resto de estados abiertos el atraso es de quien produce la pieza.

const WAITING_ON_CLIENT_STATUSES = new Set(["REVIEW_CLIENT"]);
const COMMUNITY_OWNED_STATUSES = new Set(["IDEA", "SCRIPT", "CLIENT_APPROVED", "APPROVED"]);

/** ¿Una tarea en este estado puede considerarse atrasada por el equipo? */
export function countsTowardTeamLateness(status: string) {
  return status !== "PUBLISHED" && !WAITING_ON_CLIENT_STATUSES.has(status);
}

/** Responsable del atraso según el estado; cae al otro asignado si falta. */
export function getLatenessOwner<T>(task: {
  status: string;
  assignedEditor?: T | null;
  assignedCommunity?: T | null;
}): T | null {
  const editor = task.assignedEditor ?? null;
  const community = task.assignedCommunity ?? null;
  return COMMUNITY_OWNED_STATUSES.has(task.status) ? community ?? editor : editor ?? community;
}
