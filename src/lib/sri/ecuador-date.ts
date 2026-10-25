export function sriDate(date: Date) {
  if (!Number.isFinite(date.getTime())) throw new Error("Fecha SRI inválida");
  const values = new Map(new Intl.DateTimeFormat("en-US", { timeZone: "America/Guayaquil", day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(date).map(part => [part.type, part.value]));
  return { day: values.get("day")!, month: values.get("month")!, year: values.get("year")! };
}
export function sriDisplayDate(date: Date) {
  const { day, month, year } = sriDate(date);
  return `${day}/${month}/${year}`;
}
