/** Text the voice model may use after a draft is actually confirmed. */
export function voiceDraftConfirmationMessage(action: string | undefined): string {
  switch (action) {
    case "enviarWhatsApp":
      return "El mensaje quedó en cola para que el worker lo procese; su entrega todavía no está confirmada.";
    case "pausarBot":
      return "La configuración de pausa del bot se actualizó.";
    case "marcarAprobado":
      return "La tarea quedó marcada como aprobada.";
    default:
      return "La acción se confirmó correctamente.";
  }
}
