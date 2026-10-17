function variant(key: string): number {
  let hash = 0;
  for (const character of key) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % 3;
}

export function approvalReminderText(input: { title: string; variantKey: string }): string {
  const versions = [
    `Hola, ¿pudieron revisar “${input.title}”? Quedamos atentos a sus comentarios. ¡Gracias!`,
    `¡Hola! Les recordamos que “${input.title}” está pendiente de revisión. Nos cuentan si lo aprobamos o requiere ajustes 🙌`,
    `Buen día, cuando tengan un momento nos ayudan con la revisión de “${input.title}”. Estamos atentos para continuar.`,
  ];
  return `🤖 Totem Bot: ${versions[variant(input.variantKey)]}`;
}

export function shootReminderText(input: { title: string; date: string; variantKey: string }): string {
  const versions = [
    `Hola, les recordamos el rodaje “${input.title}”, programado para ${input.date}. ¡Nos vemos pronto!`,
    `¡Hola! Tenemos agendado “${input.title}” para ${input.date}. Quedamos atentos a cualquier novedad 🙌`,
    `Buen día, les compartimos un recordatorio de “${input.title}”: ${input.date}. Gracias por coordinar con nosotros.`,
  ];
  return `🤖 Totem Bot: ${versions[variant(input.variantKey)]}`;
}

export function paymentReminderText(input: {
  clientName: string; timing: string; dueDate?: string; amount?: number;
  isGroup: boolean; amountsInGroups?: boolean; variantKey: string;
}): string {
  const amount = Number.isFinite(input.amount) && (!input.isGroup || input.amountsInGroups === true)
    ? ` por $${input.amount!.toFixed(2)}` : "";
  const date = input.dueDate ? ` (vencimiento: ${input.dueDate})` : "";
  const detail = `el pago de ${input.clientName}${amount} ${input.timing}${date}`;
  const versions = [
    `Hola, un recordatorio cordial: ${detail}. Si ya realizaron el pago, nos cuentan para actualizarlo. ¡Gracias!`,
    `¡Hola! Les escribimos para recordar que ${detail}. Quedamos atentos a cualquier consulta 🙌`,
    `Buen día, les compartimos este aviso sobre ${detail}. Gracias por ayudarnos con la coordinación.`,
  ];
  return `🤖 Totem Bot: ${versions[variant(input.variantKey)]}`;
}
