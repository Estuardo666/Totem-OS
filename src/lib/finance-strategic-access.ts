export type StrategicClientScope =
  | Record<string, never>
  | { editorId: string };

export function getStrategicClientScope(
  userId: string | null | undefined,
  userRole: string | null | undefined
): StrategicClientScope | null {
  if (!userId) return null;
  if (userRole === "ADMIN") return {};
  if (userRole === "EDITOR") return { editorId: userId };
  return null;
}

export function canReadStrategicClientAnalytics(
  userId: string | null | undefined,
  userRole: string | null | undefined
) {
  return Boolean(userId) && userRole === "ADMIN";
}

export function getCurrentEcuadorMonthRange(referenceDate = new Date()) {
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "numeric",
  }).formatToParts(referenceDate);
  const year = Number(dateParts.find((part) => part.type === "year")?.value);
  const month = Number(dateParts.find((part) => part.type === "month")?.value);

  // Ecuador continental usa UTC-5 durante todo el año. Las 05:00 UTC son
  // medianoche local, lo que evita que el cambio de mes dependa del servidor.
  const start = new Date(Date.UTC(year, month - 1, 1, 5));
  const end = new Date(Date.UTC(year, month, 1, 5));

  return { start, end };
}
