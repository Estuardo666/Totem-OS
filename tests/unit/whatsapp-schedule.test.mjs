import assert from "node:assert/strict";
import test from "node:test";
import {
  ecuadorDayBounds,
  isConfiguredTeamDailyMinute,
  isSupportedWhatsAppSchedule,
  isWhatsAppScheduleActive,
  nextWhatsAppReminderWindow,
} from "../../src/lib/whatsapp/schedule.ts";

test("activeSchedule usa día ISO y fecha local de Ecuador", () => {
  const fridayAtEcuador = new Date("2026-10-16T13:00:00.000Z"); // viernes, 08:00 en Guayaquil
  assert.equal(isWhatsAppScheduleActive({ type: "weekdays", days: [5] }, fridayAtEcuador), true);
  assert.equal(isWhatsAppScheduleActive({ type: "weekdays", days: [1, 2, 3, 4] }, fridayAtEcuador), false);
  assert.equal(isWhatsAppScheduleActive({ type: "monthRange", from: 1, to: 15 }, fridayAtEcuador), false);
  assert.equal(isWhatsAppScheduleActive({ type: "monthRange", from: 1, to: 31 }, fridayAtEcuador), true);
  assert.equal(isWhatsAppScheduleActive({ type: "monthly-days", days: "1-15" }, fridayAtEcuador), false);
  assert.equal(isWhatsAppScheduleActive(null, fridayAtEcuador), false);
});

test("fechas específicas se validan como fechas reales y usan el día de Ecuador", () => {
  const schedule = { type: "dates", dates: ["2026-10-15"] };
  // 04:30Z ya es 23:30 del día anterior en Ecuador.
  assert.equal(isWhatsAppScheduleActive(schedule, new Date("2026-10-16T04:30:00.000Z")), true);
  assert.equal(isWhatsAppScheduleActive(schedule, new Date("2026-10-16T05:00:00.000Z")), false);
  assert.equal(isSupportedWhatsAppSchedule({ type: "dates", dates: [] }), true);
  assert.equal(isSupportedWhatsAppSchedule({ type: "dates", dates: ["2026-02-29"] }), false);
  assert.equal(isSupportedWhatsAppSchedule({ type: "dates", dates: ["2024-02-29"] }), true);
  assert.equal(isSupportedWhatsAppSchedule({ type: "dates", dates: ["2026-1-05"] }), false);
});

test("resumen diario y límites de día respetan UTC-5", () => {
  const atEight = new Date("2026-10-16T13:00:00.000Z");
  assert.equal(isConfiguredTeamDailyMinute(atEight, "08:00"), true);
  assert.equal(isConfiguredTeamDailyMinute(new Date("2026-10-16T13:01:00.000Z"), "08:00"), false);
  const bounds = ecuadorDayBounds(new Date("2026-10-16T04:59:00.000Z"));
  assert.equal(bounds.start.toISOString(), "2026-10-15T05:00:00.000Z");
  assert.equal(bounds.end.toISOString(), "2026-10-16T05:00:00.000Z");
});

test("recordatorio de aprobación se mueve a ventana permitida y salta fines de semana", () => {
  const afterHours = new Date("2026-10-17T00:30:00.000Z"); // viernes 19:30 en Ecuador
  assert.equal(nextWhatsAppReminderWindow(afterHours, false).toISOString(), "2026-10-17T13:00:00.000Z");
  const saturday = new Date("2026-10-17T16:15:00.000Z"); // sábado 11:15 en Ecuador
  assert.equal(nextWhatsAppReminderWindow(saturday, true).toISOString(), "2026-10-19T13:00:00.000Z");
  assert.equal(nextWhatsAppReminderWindow(saturday, false).toISOString(), "2026-10-17T17:00:00.000Z");
});
