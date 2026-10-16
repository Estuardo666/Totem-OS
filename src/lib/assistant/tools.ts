/**
 * Herramientas del asistente.
 *
 * Lectura: consultan la base y devuelven resúmenes acotados (máx. ~20 filas)
 * para que cada llamada sea barata. Respetan el rol de quien pregunta.
 *
 * Escritura: no escriben. Validan, resuelven nombres y devuelven un borrador
 * firmado que el usuario confirma en la UI (ver drafts.ts y
 * confirmAssistantDraft).
 */

import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import type { CanonicalRole } from "@/lib/roles";
import { createExpenseSchema, createTransactionSchema } from "@/schemas/finance";
import { createContentTaskSchema } from "@/schemas/content";
import { getMonthlyFinancialSummaryFromDb } from "@/lib/finance-monthly-summary-service";
import { createDraftToken, type DraftAction } from "./drafts";
import { buildAnalysisTools } from "./analysis-tools";

export interface AssistantUser {
  id: string;
  name: string;
  role: CanonicalRole;
}

const MAX_ROWS = 20;
const EXPENSE_CATEGORIES = ["COMIDA", "TRANSPORTE", "INVITACIONES", "SOFTWARE", "OFICINA", "EQUIPOS", "OTROS"] as const;
const TASK_STATUSES = [
  "IDEA", "SCRIPT", "RECORDED", "EDITING", "REVIEW_INTERNAL", "REVIEW_CLIENT",
  "CLIENT_APPROVED", "APPROVED", "PAUSED", "CANCELLED", "REJECTED", "PUBLISHED",
] as const;
const OPEN_TASK_STATUSES = TASK_STATUSES.filter(
  (s) => !["PUBLISHED", "CANCELLED", "REJECTED"].includes(s)
);

const round = (n: number) => Math.round(n * 100) / 100;
const isoDay = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .optional()
  .describe("Mes en formato YYYY-MM. Por defecto el mes en curso.");

/** Rango [inicio, fin) de un mes YYYY-MM en hora de Ecuador (UTC-5). */
function monthRange(month?: string): { start: Date; end: Date; value: string } {
  const now = new Date(Date.now() - 5 * 3600 * 1000);
  const [y, m] = month
    ? month.split("-").map(Number)
    : [now.getUTCFullYear(), now.getUTCMonth() + 1];
  return {
    start: new Date(Date.UTC(y, m - 1, 1, 5)),
    end: new Date(Date.UTC(y, m, 1, 5)),
    value: `${y}-${String(m).padStart(2, "0")}`,
  };
}

/** Mapa nombre de cliente → logo, para que la UI muestre la foto junto al nombre. */
function logosOf(rows: { name: string; logo: string | null }[]): Record<string, string> {
  return Object.fromEntries(rows.filter((r) => r.logo).map((r) => [r.name, r.logo as string]));
}

function adminOnly(user: AssistantUser) {
  return user.role === "ADMIN" ? null : { error: "Solo un administrador puede consultar esto." };
}

function draft(
  user: AssistantUser,
  action: DraftAction,
  input: Record<string, unknown>,
  summary: Record<string, string | number | null>
) {
  return {
    status: "requires_confirmation" as const,
    action,
    summary,
    draftToken: createDraftToken(action, input, user.id),
    instructions:
      "NO está guardado. Muestra el resumen y pide al usuario que confirme con el botón. No repitas el draftToken.",
  };
}

async function findClient(clientId: string) {
  return db.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } });
}

export function buildAssistantTools(user: AssistantUser) {
  return {
    ...buildAnalysisTools(user),

    // ─────────────────────────── LECTURA ───────────────────────────
    buscarClientes: tool({
      description:
        "Busca clientes por nombre (coincidencia parcial). Úsala SIEMPRE para obtener el clientId antes de crear algo para un cliente.",
      inputSchema: z.object({
        nombre: z.string().optional().describe("Parte del nombre del cliente"),
        estado: z.enum(["ACTIVE", "PAUSED", "DEBT", "INACTIVE"]).optional(),
      }),
      execute: async ({ nombre, estado }) => {
        const where = {
          ...(nombre && { name: { contains: nombre, mode: "insensitive" as const } }),
          ...(estado ? { status: estado } : { status: { not: "INACTIVE" } }),
        };
        const [total, clients] = await Promise.all([
          db.client.count({ where }),
          db.client.findMany({
            where,
            select: { id: true, name: true, logo: true, status: true, monthlyRate: true, paymentDay: true },
            orderBy: { name: "asc" },
            take: MAX_ROWS,
          }),
        ]);
        return {
          total,
          mostrando: clients.length,
          logos: logosOf(clients),
          clientes: clients.map((c) => ({
            clientId: c.id,
            nombre: c.name,
            estado: c.status,
            ...(user.role === "ADMIN" && { tarifaMensual: c.monthlyRate, diaDePago: c.paymentDay }),
          })),
        };
      },
    }),

    buscarUsuarios: tool({
      description:
        "Busca miembros del equipo por nombre. Úsala para obtener el userId (honorarios, asignar tareas).",
      inputSchema: z.object({ nombre: z.string().optional() }),
      execute: async ({ nombre }) => {
        const users = await db.user.findMany({
          where: nombre ? { name: { contains: nombre, mode: "insensitive" } } : {},
          select: { id: true, name: true, specialty: true, roleCode: true, baseSalary: true },
          orderBy: { name: "asc" },
          take: MAX_ROWS,
        });
        return users.map((u) => ({
          userId: u.id,
          nombre: u.name,
          especialidad: u.specialty,
          rol: u.roleCode,
          ...(user.role === "ADMIN" && { honorarioBase: u.baseSalary }),
        }));
      },
    }),

    listarTareas: tool({
      description:
        "Lista tareas de contenido. Por defecto: solo las asignadas al usuario (como editor o community) y solo las abiertas. Usa delEquipo=true SOLO si pide las de todo el equipo, de otra persona o de un cliente en general.",
      inputSchema: z.object({
        clientId: z.string().optional(),
        estado: z.enum(TASK_STATUSES).optional(),
        incluirCerradas: z.boolean().optional(),
        venceDesde: z.string().optional().describe("Fecha YYYY-MM-DD (inclusive). Para 'hoy' usa la misma fecha en venceDesde y venceAntesDe."),
        venceAntesDe: z.string().optional().describe("Fecha YYYY-MM-DD (inclusive)"),
        delEquipo: z.boolean().optional().describe("true = tareas de todo el equipo (solo admin)"),
      }),
      execute: async ({ clientId, estado, incluirCerradas, venceDesde, venceAntesDe, delEquipo }) => {
        const mine = !(delEquipo && user.role === "ADMIN");
        const where = {
          ...(clientId && { clientId }),
          ...(estado
            ? { status: estado }
            : incluirCerradas
              ? {}
              : { status: { in: [...OPEN_TASK_STATUSES] } }),
          ...((venceDesde || venceAntesDe) && {
            dueDate: {
              ...(venceDesde && { gte: new Date(`${venceDesde}T00:00:00-05:00`) }),
              ...(venceAntesDe && { lte: new Date(`${venceAntesDe}T23:59:59-05:00`) }),
            },
          }),
          ...(mine && {
            OR: [{ assignedEditorId: user.id }, { assignedCommunityId: user.id }],
          }),
        };
        const [total, tasks] = await Promise.all([
          db.contentTask.count({ where }),
          db.contentTask.findMany({
            where,
            select: {
              id: true, title: true, type: true, status: true, priority: true, dueDate: true,
              client: { select: { name: true, logo: true } },
              assignedEditor: { select: { name: true } },
            },
            orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
            take: MAX_ROWS,
          }),
        ]);
        return {
          total,
          mostrando: tasks.length,
          logos: logosOf(tasks.map((t) => t.client)),
          tareas: tasks.map((t) => ({
            titulo: t.title,
            tipo: t.type,
            estado: t.status,
            prioridad: t.priority,
            vence: isoDay(t.dueDate),
            cliente: t.client.name,
            editor: t.assignedEditor?.name ?? null,
          })),
        };
      },
    }),

    listarGastos: tool({
      description: "Lista gastos de un mes, con total y desglose por categoría. Los no-admin solo ven los suyos.",
      inputSchema: z.object({
        mes: monthSchema,
        categoria: z.enum(EXPENSE_CATEGORIES).optional(),
        clientId: z.string().optional(),
      }),
      execute: async ({ mes, categoria, clientId }) => {
        const range = monthRange(mes);
        const where = {
          date: { gte: range.start, lt: range.end },
          ...(categoria && { category: categoria }),
          ...(clientId && { clientId }),
          ...(user.role !== "ADMIN" && { paidByUserId: user.id }),
        };
        const [byCategory, expenses] = await Promise.all([
          db.expense.groupBy({ by: ["category"], where, _sum: { amount: true }, _count: true }),
          db.expense.findMany({
            where,
            select: { description: true, amount: true, category: true, date: true, client: { select: { name: true, logo: true } } },
            orderBy: { date: "desc" },
            take: MAX_ROWS,
          }),
        ]);
        return {
          mes: range.value,
          total: round(byCategory.reduce((s, c) => s + (c._sum.amount ?? 0), 0)),
          logos: logosOf(expenses.flatMap((e) => (e.client ? [e.client] : []))),
          porCategoria: byCategory.map((c) => ({ categoria: c.category, total: round(c._sum.amount ?? 0), cantidad: c._count })),
          ultimos: expenses.map((e) => ({
            descripcion: e.description,
            monto: e.amount,
            categoria: e.category,
            fecha: isoDay(e.date),
            cliente: e.client?.name ?? null,
          })),
        };
      },
    }),

    listarHonorarios: tool({
      description: "Honorarios del mes por persona: base acordada, pagado y pendiente. Solo admin.",
      inputSchema: z.object({ mes: monthSchema }),
      execute: async ({ mes }) => {
        const denied = adminOnly(user);
        if (denied) return denied;
        const range = monthRange(mes);
        const [users, paid] = await Promise.all([
          db.user.findMany({ select: { id: true, name: true, baseSalary: true }, orderBy: { name: "asc" } }),
          db.transaction.groupBy({
            by: ["userId"],
            where: {
              status: "PAID",
              createdAt: { gte: range.start, lt: range.end },
              OR: [{ type: "HONORARIOS" }, { type: "EXPENSE", category: "SALARY" }],
            },
            _sum: { amount: true },
          }),
        ]);
        const paidBy = new Map(paid.map((p) => [p.userId, p._sum.amount ?? 0]));
        return {
          mes: range.value,
          personas: users
            .filter((u) => (u.baseSalary ?? 0) > 0 || paidBy.has(u.id))
            .map((u) => ({
              nombre: u.name,
              base: u.baseSalary ?? 0,
              pagado: round(paidBy.get(u.id) ?? 0),
              pendiente: round(Math.max(0, (u.baseSalary ?? 0) - (paidBy.get(u.id) ?? 0))),
            })),
        };
      },
    }),

    resumenMetricas: tool({
      description:
        "Resumen financiero del mes: ingresos reconocidos, cobrado, costos, honorarios, utilidad, por cobrar y alertas. Solo admin.",
      inputSchema: z.object({ mes: monthSchema }),
      execute: async ({ mes }) => {
        const denied = adminOnly(user);
        if (denied) return denied;
        const result = await getMonthlyFinancialSummaryFromDb(monthRange(mes).value);
        if (!result.success || !result.data) return { error: result.error ?? "Sin datos" };
        const s = result.data;
        return {
          periodo: s.periodLabel,
          esMesEnCurso: s.period.isCurrentMonth,
          ejecutivo: s.executive,
          cierresPendientes: { cantidad: s.closureControl.pendingCount, monto: s.closureControl.pendingAmount },
          alertas: (s.alerts ?? []).map((a) => `${a.title}: ${a.description}`),
        };
      },
    }),

    // ─────────────────────────── ESCRITURA (con confirmación) ───────────────────────────
    crearGasto: tool({
      description:
        "Prepara un gasto para que el usuario lo confirme. NO lo guarda. Si menciona un cliente, primero obtén su clientId con buscarClientes.",
      inputSchema: z.object({
        descripcion: z.string().min(1),
        monto: z.number().positive(),
        categoria: z.enum(EXPENSE_CATEGORIES),
        fecha: z.string().optional().describe("YYYY-MM-DD; por defecto hoy"),
        clientId: z.string().optional(),
      }),
      execute: async ({ descripcion, monto, categoria, fecha, clientId }) => {
        const client = clientId ? await findClient(clientId) : null;
        if (clientId && !client) return { error: "Cliente no encontrado; usa buscarClientes." };
        const input = {
          description: descripcion,
          amount: monto,
          category: categoria,
          ...(fecha && { date: `${fecha}T12:00:00-05:00` }),
          ...(client && { clientId: client.id }),
        };
        const check = createExpenseSchema.safeParse(input);
        if (!check.success) return { error: check.error.issues.map((i) => i.message).join("; ") };
        return draft(user, "crearGasto", input, {
          Descripción: descripcion,
          Monto: monto,
          Categoría: categoria,
          Fecha: fecha ?? "hoy",
          Cliente: client?.name ?? null,
        });
      },
    }),

    crearTarea: tool({
      description:
        "Prepara una tarea de contenido para que el usuario la confirme. NO la guarda. Requiere clientId (usa buscarClientes).",
      inputSchema: z.object({
        titulo: z.string().min(1),
        tipo: z.enum(["REEL", "FLYER", "STORY"]),
        clientId: z.string(),
        fechaEntrega: z.string().optional().describe("YYYY-MM-DD"),
        prioridad: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
        editorUserId: z.string().optional().describe("userId del editor asignado (usa buscarUsuarios)"),
      }),
      execute: async ({ titulo, tipo, clientId, fechaEntrega, prioridad, editorUserId }) => {
        const [client, editor] = await Promise.all([
          findClient(clientId),
          editorUserId
            ? db.user.findUnique({ where: { id: editorUserId }, select: { id: true, name: true } })
            : null,
        ]);
        if (!client) return { error: "Cliente no encontrado; usa buscarClientes." };
        if (editorUserId && !editor) return { error: "Editor no encontrado; usa buscarUsuarios." };
        const input = {
          title: titulo,
          type: tipo,
          clientId: client.id,
          ...(fechaEntrega && { dueDate: fechaEntrega }),
          ...(prioridad && { priority: prioridad }),
          ...(editor && { assignedEditorId: editor.id }),
        };
        const check = createContentTaskSchema.safeParse(input);
        if (!check.success) return { error: check.error.issues.map((i) => i.message).join("; ") };
        return draft(user, "crearTarea", input, {
          Título: titulo,
          Tipo: tipo,
          Cliente: client.name,
          Entrega: fechaEntrega ?? null,
          Prioridad: prioridad ?? "MEDIUM",
          Editor: editor?.name ?? null,
        });
      },
    }),

    registrarHonorario: tool({
      description:
        "Prepara el registro de un pago de honorarios para que el usuario lo confirme. NO lo guarda. Solo admin. Requiere userId (usa buscarUsuarios).",
      inputSchema: z.object({
        userId: z.string(),
        monto: z.number().positive(),
        mes: monthSchema.describe("Mes al que corresponde el honorario (YYYY-MM). Por defecto el mes en curso."),
        descripcion: z.string().optional(),
      }),
      execute: async ({ userId, monto, mes, descripcion }) => {
        const denied = adminOnly(user);
        if (denied) return denied;
        const recipient = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
        if (!recipient) return { error: "Usuario no encontrado; usa buscarUsuarios." };
        const period = monthRange(mes).value;
        const input = {
          type: "HONORARIOS",
          status: "PAID",
          amount: monto,
          userId: recipient.id,
          description: descripcion ?? `Honorarios ${recipient.name} ${period}`,
          periodMonth: period,
        };
        const check = createTransactionSchema.safeParse(input);
        if (!check.success) return { error: check.error.issues.map((i) => i.message).join("; ") };
        return draft(user, "registrarHonorario", input, {
          Persona: recipient.name,
          Monto: monto,
          Mes: period,
          Descripción: input.description,
        });
      },
    }),
  };
}

export type AssistantTools = ReturnType<typeof buildAssistantTools>;
