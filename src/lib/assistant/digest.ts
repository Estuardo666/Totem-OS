/**
 * Digest inteligente del home: un turno del asistente que consulta datos con
 * herramientas de solo lectura y entrega el resultado llamando a
 * `entregarDigest` (salida estructurada vía tool-call, válida en cualquier
 * proveedor). Nunca recibe herramientas que escriban o envíen mensajes.
 *
 * Skills propias del digest:
 * - pulsoFinanciero: mes en curso vs anterior, margen y proyección a cierre.
 * - riesgoTareas: vencidas por responsable, próximas 7 días y revisiones
 *   estancadas.
 */

import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAssistantModel } from "./config";
import { buildAnalysisTools } from "./analysis-tools";
import { buildAssistantTools, type AssistantUser } from "./tools";

const round = (n: number) => Math.round(n * 100) / 100;
const DAY = 86_400_000;

/** Herramientas de lectura que el digest puede usar (además de sus skills). */
const READ_ONLY_TOOLS = ["listarTareas", "resumenMetricas", "aprobacionesPendientes", "listarGastos"] as const;

const insightSchema = z.object({
  tono: z.enum(["positivo", "atencion", "riesgo", "neutral"]),
  titulo: z.string().max(90),
  detalle: z.string().max(240),
  enlace: z.string().optional().describe("Ruta interna relacionada, p. ej. /finance/receivables o /content"),
});

export const digestSchema = z.object({
  titular: z.string().max(140).describe("Una frase que resume el día, con la cifra más importante."),
  finanzas: z.array(insightSchema).max(3),
  tareas: z.array(insightSchema).max(3),
  acciones: z.array(z.string().max(120)).max(3).describe("Siguientes pasos concretos, en imperativo."),
});

export type Digest = z.infer<typeof digestSchema> & { generadoEn: string };

/** Rango [inicio, fin) del mes con desplazamiento, en hora de Ecuador (UTC-5). */
function monthRange(offset = 0) {
  const now = new Date(Date.now() - 5 * 3600 * 1000);
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const y = first.getUTCFullYear();
  const m = first.getUTCMonth();
  return { start: new Date(Date.UTC(y, m, 1, 5)), end: new Date(Date.UTC(y, m + 1, 1, 5)) };
}

async function sumMonth(offset: number) {
  const { start, end } = monthRange(offset);
  const [invoices, income, expenses, outflows] = await Promise.all([
    db.invoice.aggregate({ where: { status: "PAID", paidAt: { gte: start, lt: end } }, _sum: { amount: true } }),
    db.transaction.aggregate({ where: { type: "INCOME", status: "PAID", createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
    db.expense.aggregate({ where: { date: { gte: start, lt: end } }, _sum: { amount: true } }),
    db.transaction.aggregate({ where: { type: { in: ["EXPENSE", "HONORARIOS"] }, status: "PAID", createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
  ]);
  const ingresos = (invoices._sum.amount ?? 0) + (income._sum.amount ?? 0);
  const egresos = (expenses._sum.amount ?? 0) + (outflows._sum.amount ?? 0);
  return { ingresos, egresos, start, end };
}

function buildDigestSkills(user: AssistantUser) {
  const isAdmin = user.role === "ADMIN";
  const scope = isAdmin ? {} : { OR: [{ assignedEditorId: user.id }, { assignedCommunityId: user.id }] };

  return {
    ...(isAdmin
      ? {
          pulsoFinanciero: tool({
            description:
              "Pulso financiero del mes en curso frente al anterior: ingresos cobrados, egresos, utilidad, margen y proyección lineal al cierre del mes. Solo admin.",
            inputSchema: z.object({}),
            execute: async () => {
              const [now, prev] = await Promise.all([sumMonth(0), sumMonth(-1)]);
              const elapsed = Math.max((Date.now() - now.start.getTime()) / DAY, 1);
              const total = (now.end.getTime() - now.start.getTime()) / DAY;
              const utilidad = now.ingresos - now.egresos;
              const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : null);
              return {
                diasTranscurridos: Math.round(elapsed),
                diasDelMes: Math.round(total),
                ingresos: round(now.ingresos),
                egresos: round(now.egresos),
                utilidad: round(utilidad),
                margenPct: now.ingresos ? Math.round((utilidad / now.ingresos) * 100) : null,
                proyeccionIngresosCierre: round((now.ingresos / elapsed) * total),
                proyeccionEgresosCierre: round((now.egresos / elapsed) * total),
                mesAnterior: { ingresos: round(prev.ingresos), egresos: round(prev.egresos), utilidad: round(prev.ingresos - prev.egresos) },
                variacionIngresosPct: pct(now.ingresos, prev.ingresos),
                variacionEgresosPct: pct(now.egresos, prev.egresos),
              };
            },
          }),
        }
      : {}),

    riesgoTareas: tool({
      description:
        "Riesgo operativo de contenido: tareas vencidas agrupadas por responsable y cliente, entregas de los próximos 7 días y piezas estancadas en revisión más de 48 h.",
      inputSchema: z.object({}),
      execute: async () => {
        const now = new Date();
        const tasks = await db.contentTask.findMany({
          where: { ...scope, status: { not: "PUBLISHED" }, dueDate: { not: null, lt: new Date(now.getTime() + 7 * DAY) } },
          select: {
            title: true,
            status: true,
            dueDate: true,
            updatedAt: true,
            client: { select: { name: true } },
            assignedEditor: { select: { name: true } },
            assignedCommunity: { select: { name: true } },
          },
          orderBy: { dueDate: "asc" },
          take: 200,
        });
        const owner = (t: (typeof tasks)[number]) => t.assignedEditor?.name ?? t.assignedCommunity?.name ?? "Sin asignar";
        const overdue = tasks.filter((t) => t.dueDate! < now);
        const upcoming = tasks.filter((t) => t.dueDate! >= now);
        const byOwner: Record<string, number> = {};
        const byClient: Record<string, number> = {};
        for (const t of overdue) {
          byOwner[owner(t)] = (byOwner[owner(t)] ?? 0) + 1;
          byClient[t.client.name] = (byClient[t.client.name] ?? 0) + 1;
        }
        const stuck = await db.contentTask.count({
          where: { ...scope, status: { in: ["REVIEW_INTERNAL", "REVIEW_CLIENT"] }, updatedAt: { lt: new Date(now.getTime() - 2 * DAY) } },
        });
        return {
          vencidas: overdue.length,
          vencidasPorResponsable: byOwner,
          vencidasPorCliente: byClient,
          masAtrasadas: overdue.slice(0, 5).map((t) => ({
            titulo: t.title,
            cliente: t.client.name,
            responsable: owner(t),
            diasAtraso: Math.floor((now.getTime() - t.dueDate!.getTime()) / DAY),
            estado: t.status,
          })),
          proximos7Dias: upcoming.length,
          proximas: upcoming.slice(0, 5).map((t) => ({ titulo: t.title, cliente: t.client.name, vence: t.dueDate!.toISOString().slice(0, 10) })),
          estancadasEnRevisionMas48h: stuck,
        };
      },
    }),
  };
}

function digestPrompt(user: AssistantUser) {
  const today = new Intl.DateTimeFormat("es-EC", { dateStyle: "full", timeZone: "America/Guayaquil" }).format(new Date());
  const finance =
    user.role === "ADMIN"
      ? "Primero llama a pulsoFinanciero, cobrosClientes y riesgoTareas (en paralelo si puedes). Si hace falta, usa rankingClientes o utilidadesAcumuladas."
      : "No tienes acceso a finanzas: deja `finanzas` vacío. Llama a riesgoTareas y, si hace falta, listarTareas.";
  return [
    `Eres el analista de Totem, una agencia de contenido en Ecuador. Hoy es ${today}. Preparas el digest del home para ${user.name}.`,
    finance,
    "Reglas: usa solo cifras devueltas por las herramientas; nunca inventes ni redondees de forma engañosa. Moneda USD con formato $1,234.56.",
    "Prioriza lo accionable: atrasos, cobros vencidos, desvíos de margen, concentración de riesgo en una persona o cliente.",
    "Escribe en español neutro, frases cortas, sin emojis. Cada insight: título con la cifra clave, detalle con el porqué.",
    "Termina SIEMPRE llamando a entregarDigest una sola vez. No escribas texto fuera de esa llamada.",
  ].join("\n");
}

export async function generateDigest(user: AssistantUser): Promise<Digest | { error: string }> {
  const resolved = await getAssistantModel();
  if ("error" in resolved) return resolved;

  const all = buildAssistantTools(user);
  const analysis = buildAnalysisTools(user);
  const readOnly = Object.fromEntries(READ_ONLY_TOOLS.map((name) => [name, all[name]]));

  let delivered: z.infer<typeof digestSchema> | null = null;
  const entregarDigest = tool({
    description: "Entrega el digest final. Llamar exactamente una vez al terminar.",
    inputSchema: digestSchema,
    execute: async (input) => {
      delivered = input;
      return { ok: true };
    },
  });

  const tools = {
    ...readOnly,
    cobrosClientes: analysis.cobrosClientes,
    rankingClientes: analysis.rankingClientes,
    utilidadesAcumuladas: analysis.utilidadesAcumuladas,
    entregasDelMes: analysis.entregasDelMes,
    ...buildDigestSkills(user),
    entregarDigest,
  };

  await generateText({
    model: resolved.model,
    system: digestPrompt(user),
    prompt: "Genera el digest de hoy.",
    tools,
    stopWhen: [stepCountIs(8), ({ steps }) => steps.some((s) => s.toolCalls.some((c) => c?.toolName === "entregarDigest"))],
    maxOutputTokens: 2500,
  });

  const result = delivered as z.infer<typeof digestSchema> | null;
  if (!result) return { error: "El asistente no devolvió un digest. Intenta de nuevo." };
  return { ...result, generadoEn: new Date().toISOString() };
}
