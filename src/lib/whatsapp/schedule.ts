const ECUADOR_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type Schedule = { type?: unknown; days?: unknown; from?: unknown; to?: unknown } | number[];

export function ecuadorDayBounds(now = new Date()) {
  const shifted = new Date(now.getTime() - ECUADOR_OFFSET_MS);
  const day = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return { start: new Date(day + ECUADOR_OFFSET_MS), end: new Date(day + DAY_MS + ECUADOR_OFFSET_MS) };
}

export function isWhatsAppScheduleActive(value: unknown, now = new Date()): boolean {
  if (!value || typeof value !== "object") return false;
  const shifted = new Date(now.getTime() - ECUADOR_OFFSET_MS);
  const dayOfMonth = shifted.getUTCDate();
  const weekday = ((shifted.getUTCDay() + 6) % 7) + 1;
  const schedule = value as Schedule;
  const type = !Array.isArray(schedule) ? schedule.type : undefined;
  const days = !Array.isArray(schedule) ? schedule.days : schedule;

  if (type === "weekdays" || type === "weekdays-only") {
    return Array.isArray(days) && days.some((day) => Number(day) === weekday);
  }
  if (type === "monthRange" || type === "monthly-range") {
    const from = !Array.isArray(schedule) ? Number(schedule.from) : NaN;
    const to = !Array.isArray(schedule) ? Number(schedule.to) : NaN;
    return Number.isInteger(from) && Number.isInteger(to) && from >= 1 && to <= 31 && dayOfMonth >= from && dayOfMonth <= to;
  }
  if (type === "monthly-days") {
    const range = !Array.isArray(schedule) ? schedule.days : undefined;
    if (typeof range === "string") {
      const match = range.match(/^\s*(\d{1,2})\s*-\s*(\d{1,2})\s*$/);
      return Boolean(match && dayOfMonth >= Number(match[1]) && dayOfMonth <= Number(match[2]));
    }
  }
  return false;
}

export function isConfiguredTeamDailyMinute(now: Date, hour: string): boolean {
  const shifted = new Date(now.getTime() - ECUADOR_OFFSET_MS);
  const actual = `${String(shifted.getUTCHours()).padStart(2, "0")}:${String(shifted.getUTCMinutes()).padStart(2, "0")}`;
  return actual === hour;
}

export function nextWhatsAppReminderWindow(dueAt: Date, skipWeekends: boolean): Date {
  let local = new Date(dueAt.getTime() - ECUADOR_OFFSET_MS);
  const weekday = () => local.getUTCDay();
  const moveToNextDayAtEight = () => {
    local = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1, 8));
  };
  if (local.getUTCHours() < 8) {
    local.setUTCHours(8, 0, 0, 0);
  } else if (local.getUTCHours() > 19 || (local.getUTCHours() === 19 && local.getUTCMinutes() > 0)) {
    moveToNextDayAtEight();
  } else {
    const minutes = local.getUTCMinutes();
    local.setUTCMinutes(0, 0, 0);
    if (minutes > 0) local.setUTCHours(local.getUTCHours() + 1);
  }
  if (skipWeekends) {
    while (weekday() === 0 || weekday() === 6) moveToNextDayAtEight();
  }
  return new Date(local.getTime() + ECUADOR_OFFSET_MS);
}
