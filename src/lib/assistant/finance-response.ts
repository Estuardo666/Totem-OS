import type { MonthlyFinancialSummaryData } from "../finance-monthly-summary-types";

export const FINANCIAL_RESPONSE_RULES = `Precisión financiera:
- En CADA turno sobre finanzas consulta nuevamente las herramientas, incluso si ya respondiste, si el usuario repite la pregunta o dice "reales", "no proyectados", "seguro" o corrige una cifra. El historial sirve para conservar el período y la intención, nunca como fuente vigente de montos. Si la consulta falla, indica que no puedes verificar; no reutilices la cifra anterior.
- Para ingresos del mes usa resumenMetricas. Por defecto, "ingresos", "ingresos reales", "cuánto entró" o "cuánto hemos cobrado" significan ingresosCobradosReales (executive.collectedCash). Responde primero con ese monto y el período. Nunca presentes recognizedRevenue, tarifas recurrentes, cierres pendientes ni cuentas por cobrar como dinero recibido.
- Solo si pide ingresos reconocidos, comprometidos o proyecciones, usa esos conceptos con su etiqueta explícita. No sumes lo pendiente a lo cobrado para llamarlo ingreso real. No calcules deuda restando ingreso comprometido menos cobrado: usa el saldo por cobrar de la herramienta, que puede incluir otros períodos.
- Para saldo disponible usa tesoreria.operatingEndingBalance, no ingresos cobrados ni utilidad. Para reembolsos pendientes usa tesoreria.pendingReimbursements y aclara su alcance acumulado; no los confundas con cuentas por cobrar a clientes ni con honorarios pendientes. Utilidad operativa y flujo de caja son conceptos distintos.
- Conserva exactamente los montos, signos y período devueltos por la consulta más reciente; al resumir en voz no cambies sus etiquetas. Si contradicen una respuesta anterior, corrígela explícitamente. Nunca afirmes saldo cero por ausencia de datos.`;

/** Explicit semantics at the model boundary; no independent financial arithmetic. */
export function financialResponseData(summary: MonthlyFinancialSummaryData) {
  return {
    consultadoEn: new Date().toISOString(),
    moneda: "USD",
    mes: summary.period.value,
    ingresosCobradosReales: summary.executive.collectedCash,
    ingresosReconocidosComprometidos: summary.executive.recognizedRevenue,
    definiciones: {
      ingresosCobradosReales: "Dinero cobrado registrado del período; respuesta por defecto para ingresos reales.",
      ingresosReconocidosComprometidos: "Incluye compromisos recurrentes aunque no se hayan cobrado; no equivale a dinero recibido.",
      porCobrar: "Saldo de cuentas por cobrar al corte; puede incluir deuda de meses anteriores.",
      reembolsosPendientes: "Gastos asignados pendientes de reembolso; compromisos acumulados al corte, no ingresos.",
    },
    tesoreria: summary.treasury,
    calidadIngresos: summary.quality,
  };
}
