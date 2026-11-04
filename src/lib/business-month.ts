/**
 * Mes de negocio para marcas de tiempo reales (`Transaction.createdAt`).
 *
 * La agencia opera en Ecuador (UTC-5 fijo, sin horario de verano) y el servidor
 * corre en UTC. Un pago registrado el 30 de septiembre a las 20:00 se guarda el
 * 1 de octubre en UTC: cortar el mes a medianoche UTC lo contaba en octubre,
 * mientras la lista de transacciones (en hora de Ecuador) lo muestra en
 * septiembre. Este rango corta a medianoche de Ecuador.
 *
 * No aplicar a fechas de calendario guardadas a medianoche UTC (fecha de un
 * gasto, mes devengado de una factura): para esas el corte UTC es el correcto.
 */
const ECUADOR_UTC_OFFSET_HOURS = 5;

/** `month` va de 1 a 12. `end` es inclusivo (último milisegundo del mes). */
export function ecuadorMonthTimestampRange(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1, ECUADOR_UTC_OFFSET_HOURS)),
    end: new Date(Date.UTC(year, month, 1, ECUADOR_UTC_OFFSET_HOURS) - 1),
  };
}
