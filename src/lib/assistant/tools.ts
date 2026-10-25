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
import { buildMetaTools } from "./meta-tools";
import { fuzzyMatch } from "./fuzzy";
import { getWhatsAppConfig, getWhatsAppStatus } from "@/lib/whatsapp";
import { approvalReminderText, paymentReminderText, shootReminderText } from "@/lib/whatsapp/templates";

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
  const tools = {
    ...buildAnalysisTools(user),
    ...buildMetaTools(user),

    // ─────────────────────────── LECTURA ───────────────────────────
    buscarClientes: tool({
      description:
        "Busca clientes por nombre. Tolera tildes, mayúsculas y errores de transcripción (\"Audisense\" encuentra \"Audisens\"), así que pásale el nombre tal como lo dijo el usuario o una parte. Úsala SIEMPRE para obtener el clientId antes de crear algo para un cliente.",
      inputSchema: z.object({
        nombre: z.string().optional().describe("Parte del nombre del cliente"),
        estado: z.enum(["ACTIVE", "PAUSED", "DEBT", "INACTIVE"]).optional(),
      }),
      execute: async ({ nombre, estado }) => {
        const select = { id: true, name: true, logo: true, status: true, monthlyRate: true, paymentDay: true } as const;
        const toRow = (c: { id: string; name: string; status: string; monthlyRate: number; paymentDay: number | null }) => ({
          clientId: c.id,
          nombre: c.name,
          estado: c.status,
          ...(user.role === "ADMIN" && { tarifaMensual: c.monthlyRate, diaDePago: c.paymentDay }),
        });

        if (nombre?.trim()) {
          // Pocos clientes: se comparan todos en memoria con búsqueda tolerante.
          const all = await db.client.findMany({ where: estado ? { status: estado } : {}, select });
          const matches = fuzzyMatch(nombre, all);
          // Los inactivos solo aparecen si no hay ningún activo parecido.
          const active = matches.filter((c) => c.status !== "INACTIVE");
          const found = (active.length ? active : matches).slice(0, 8);
          return {
            total: found.length,
            mostrando: found.length,
            logos: logosOf(found),
            clientes: found.map(toRow),
            ...(found.length > 1 && found[0].score - found[1].score < 0.05
              ? { nota: "Varios nombres parecidos: pregunta cuál es." }
              : {}),
            ...(found.length === 0 && { nota: "Ningún cliente se parece; pide que lo deletree o lista los clientes." }),
          };
        }

        const where = estado ? { status: estado } : { status: { not: "INACTIVE" } };
        const [total, clients] = await Promise.all([
          db.client.count({ where }),
          db.client.findMany({ where, select, orderBy: { name: "asc" }, take: MAX_ROWS }),
        ]);
        return {
          total,
          mostrando: clients.length,
          logos: logosOf(clients),
          clientes: clients.map(toRow),
        };
      },
    }),

    buscarUsuarios: tool({
      description:
        "Busca miembros del equipo por nombre. Úsala para obtener el userId (honorarios, asignar tareas).",
      inputSchema: z.object({ nombre: z.string().optional() }),
      execute: async ({ nombre }) => {
        const all = await db.user.findMany({
          select: { id: true, name: true, specialty: true, roleCode: true, baseSalary: true },
          orderBy: { name: "asc" },
        });
        const users = nombre?.trim()
          ? fuzzyMatch(nombre, all.map((u) => ({ ...u, name: u.name ?? "" }))).slice(0, 8)
          : all.slice(0, MAX_ROWS);
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
          cierresPendientes: {
            cantidad: s.closureControl.pendingCount,
            monto: s.closureControl.pendingAmount,
            // Clientes recurrentes cuyo mes aún no se cerró (sin cobro ni factura registrados).
            clientes: s.closureControl.pendingClients.map((c) => ({ cliente: c.name, tarifa: c.monthlyRate })),
          },
          logos: Object.fromEntries(
            s.closureControl.pendingClients.filter((c) => c.logo).map((c) => [c.name, c.logo as string])
          ),
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

    crearRodaje: tool({
      description:
        "Prepara un rodaje (sesión de grabación) para que el usuario lo confirme. NO lo guarda. Al confirmar se crea en Totem OS y en Google Calendar. Requiere clientId (usa buscarClientes); para el equipo usa buscarUsuarios.",
      inputSchema: z.object({
        clientId: z.string(),
        titulo: z.string().min(1).describe("Ej.: 'Rodaje reels octubre'"),
        fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("YYYY-MM-DD"),
        hora: z.string().regex(/^\d{2}:\d{2}$/).describe("Hora de inicio HH:mm en 24 h, hora de Ecuador"),
        duracionMinutos: z.number().int().min(15).max(720).optional().describe("Por defecto 60"),
        direccion: z.string().optional(),
        notas: z.string().optional(),
        equipoUserIds: z.array(z.string()).optional().describe("userIds del equipo que va al rodaje"),
      }),
      execute: async ({ clientId, titulo, fecha, hora, duracionMinutos = 60, direccion, notas, equipoUserIds }) => {
        const [client, crew] = await Promise.all([
          findClient(clientId),
          equipoUserIds?.length
            ? db.user.findMany({ where: { id: { in: equipoUserIds } }, select: { id: true, name: true } })
            : [],
        ]);
        if (!client) return { error: "Cliente no encontrado; usa buscarClientes." };
        if (equipoUserIds?.length && crew.length !== equipoUserIds.length) {
          return { error: "Alguien del equipo no se encontró; usa buscarUsuarios." };
        }
        const start = new Date(`${fecha}T${hora}:00-05:00`);
        if (Number.isNaN(start.getTime())) return { error: "Fecha u hora inválida." };
        if (start.getTime() < Date.now() - 60 * 60 * 1000) return { error: "Esa fecha ya pasó; confirma la fecha del rodaje." };
        const end = new Date(start.getTime() + duracionMinutos * 60 * 1000);
        const input = {
          title: titulo,
          clientId: client.id,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          ...(direccion && { address: direccion }),
          ...(notas && { notes: notas }),
          ...(crew.length && { crewIds: crew.map((u) => u.id) }),
        };
        const fmt = new Intl.DateTimeFormat("es-EC", {
          timeZone: "America/Guayaquil", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
        });
        return draft(user, "crearRodaje", input, {
          Título: titulo,
          Cliente: client.name,
          Cuándo: fmt.format(start),
          Duración: duracionMinutos >= 60 ? `${duracionMinutos / 60} h` : `${duracionMinutos} min`,
          Lugar: direccion ?? null,
          Equipo: crew.map((u) => u.name).join(", ") || null,
          Notas: notas ?? null,
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

    registrarIngreso: tool({
      description:
        "Prepara el registro de un ingreso (pago de un cliente u otro ingreso) para que el usuario lo confirme. NO lo guarda. Solo admin. Si es de un cliente, pasa clientId (usa buscarClientes); si no, describe de quién o de qué es.",
      inputSchema: z.object({
        monto: z.number().positive(),
        clientId: z.string().optional().describe("Cliente que pagó"),
        descripcion: z.string().optional().describe("Obligatoria si no es de un cliente: persona, trabajo extra, etc."),
        mes: monthSchema.describe("Mes al que corresponde el pago (YYYY-MM). Por defecto el mes en curso."),
        pendiente: z.boolean().optional().describe("true si aún no se cobró (queda por cobrar). Por defecto ya cobrado."),
      }),
      execute: async ({ monto, clientId, descripcion, mes, pendiente }) => {
        const denied = adminOnly(user);
        if (denied) return denied;
        const client = clientId ? await findClient(clientId) : null;
        if (clientId && !client) return { error: "Cliente no encontrado; usa buscarClientes." };
        if (!client && !descripcion?.trim()) return { error: "Falta de quién o de qué es el ingreso." };
        const period = monthRange(mes).value;
        // Igual que el formulario de la app: la descripción es el nombre del cliente.
        const input = {
          type: "INCOME",
          status: pendiente ? "PENDING" : "PAID",
          amount: monto,
          description: client ? (descripcion?.trim() ? `${client.name} · ${descripcion.trim()}` : client.name) : descripcion!.trim(),
          ...(client && { clientId: client.id, relatedClientId: client.id }),
          periodMonth: period,
        };
        const check = createTransactionSchema.safeParse(input);
        if (!check.success) return { error: check.error.issues.map((i) => i.message).join("; ") };
        return draft(user, "registrarIngreso", input, {
          Cliente: client?.name ?? null,
          Concepto: client ? descripcion?.trim() || null : input.description,
          Monto: monto,
          Mes: period,
          Estado: pendiente ? "Por cobrar" : "Cobrado",
        });
      },
    }),

    aprobacionesPendientes: tool({
      description: "Lista solicitudes de aprobación pendientes de WhatsApp. Solo admin.",
      inputSchema: z.object({ clientId: z.string().optional() }),
      execute: async ({ clientId }) => {
        const denied = adminOnly(user);
        if (denied) return denied;
        const groups = await db.whatsAppGroup.findMany({ where: { ...(clientId ? { clientId } : {}) }, select: { jid: true, name: true } });
        const rows = await db.whatsAppApprovalRequest.findMany({
          where: { status: "PENDING", ...(clientId ? { groupJid: { in: groups.map((g) => g.jid) } } : {}) },
          select: { id: true, groupJid: true, fileName: true, sentAt: true, task: { select: { title: true, status: true } } },
          orderBy: { sentAt: "asc" }, take: 20,
        });
        return rows.map((r) => ({ id: r.id, grupo: groups.find((g) => g.jid === r.groupJid)?.name ?? r.groupJid, titulo: r.task?.title ?? r.fileName, estado: r.task?.status ?? "sin tarea", fecha: r.sentAt.toISOString() }));
      },
    }),

    historialWhatsApp: tool({
      description: "Consulta historial reciente de WhatsApp por nombre de cliente o de grupo. Incluye mensajes entrantes y salientes; solo admin.",
      inputSchema: z.object({ clienteOGrupo: z.string().min(1), dias: z.number().int().min(1).max(30).default(7) }),
      execute: async ({ clienteOGrupo, dias }) => {
        const denied = adminOnly(user);
        if (denied) return denied;
        const since = new Date(Date.now() - dias * 86_400_000);
        const [clients, groups] = await Promise.all([
          db.client.findMany({ select: { id: true, name: true, whatsappPhone: true } }),
          db.whatsAppGroup.findMany({ select: { jid: true, name: true, clientId: true } }),
        ]);
        const directGroup = groups.find((group) => group.jid === clienteOGrupo);
        const directClient = clients.find((client) => client.id === clienteOGrupo);
        const clientMatches = directClient ? [{ ...directClient, score: 1 }] : fuzzyMatch(clienteOGrupo, clients).slice(0, 4);
        const groupMatches = directGroup ? [{ ...directGroup, score: 1 }] : fuzzyMatch(clienteOGrupo, groups).slice(0, 4);
        const bestClient = clientMatches[0];
        const bestGroup = groupMatches[0];
        const clientIsClear = bestClient && (clientMatches.length === 1 || bestClient.score - clientMatches[1].score >= 0.05);
        const groupIsClear = bestGroup && (groupMatches.length === 1 || bestGroup.score - groupMatches[1].score >= 0.05);
        const selectedClient = clientIsClear && (!groupIsClear || bestClient.score >= bestGroup.score) ? bestClient : null;
        const selectedGroup = groupIsClear && (!clientIsClear || bestGroup.score > bestClient.score) ? bestGroup : null;
        if (!selectedClient && !selectedGroup) {
          const names = [...clientMatches.slice(0, 3).map((row) => row.name), ...groupMatches.slice(0, 3).map((row) => row.name)];
          return { error: names.length ? `Hay varios destinos posibles: ${names.join(", ")}. Pregunta cuál.` : "No encontré ese cliente o grupo." };
        }

        const jids = new Set<string>();
        let destino = selectedGroup?.name ?? selectedClient?.name ?? clienteOGrupo;
        if (selectedGroup) jids.add(selectedGroup.jid);
        if (selectedClient) {
          groups.filter((group) => group.clientId === selectedClient.id).forEach((group) => jids.add(group.jid));
          if (selectedClient.whatsappPhone) {
            const { normalizePhone } = await import("@/lib/whatsapp/enqueue");
            jids.add(`${normalizePhone(selectedClient.whatsappPhone)}@s.whatsapp.net`);
          }
        }
        const [outbound, inbound] = await Promise.all([
          db.whatsAppMessage.findMany({ where: { to: { in: [...jids] }, createdAt: { gte: since } }, select: { to: true, body: true, kind: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 30 }),
          db.whatsAppInbound.findMany({ where: { chatJid: { in: [...jids] }, ts: { gte: since } }, select: { chatJid: true, type: true, text: true, fileName: true, isTeam: true, ts: true }, orderBy: { ts: "desc" }, take: 30 }),
        ]);
        const messages = [
          ...outbound.map((row) => ({ direccion: "saliente", mensaje: row.body, tipo: row.kind, estado: row.status, fecha: row.createdAt })),
          ...inbound.map((row) => ({ direccion: row.isTeam ? "entrante del equipo" : "entrante del cliente", mensaje: row.text ?? row.fileName ?? `[${row.type}]`, tipo: row.type, estado: "RECIBIDO", fecha: row.ts })),
        ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime()).slice(0, 40);
        return { destino, mensajes: messages.map(({ fecha, ...row }) => ({ ...row, fecha: fecha.toISOString() })) };
      },
    }),

    estadoBot: tool({
      description: "Consulta estado, cola y pausa del bot de WhatsApp. Solo admin.",
      inputSchema: z.object({}),
      execute: async () => adminOnly(user) ?? await getWhatsAppStatus(),
    }),

    preguntasSinResponder: tool({
      description: "Lista los prompts abiertos que esperan respuesta del dueño. Solo admin.",
      inputSchema: z.object({}),
      execute: async () => {
        const denied = adminOnly(user);
        if (denied) return denied;
        const rows = await db.whatsAppOwnerPrompt.findMany({ where: { status: "OPEN", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "asc" }, take: 20 });
        return rows.map(({ id, type, payload, options, expiresAt }) => ({ id, tipo: type, detalle: payload, opciones: options, vence: expiresAt.toISOString() }));
      },
    }),

    enviarWhatsApp: tool({
      description: "Prepara un borrador de WhatsApp firmado que requiere confirmación. Solo admin. Para recordatorios usa datos guardados; para mensajes libres usa texto y exactamente un destinatario: teamUserId (equipo con opt-in) o clientId (grupo habilitado, luego teléfono personal).",
      inputSchema: z.object({ tipo: z.enum(["recordatorio_pago", "recordatorio_rodaje", "recordatorio_aprobacion", "libre"]), clientId: z.string().optional(), teamUserId: z.string().optional(), texto: z.string().max(1000).optional() }),
      execute: async ({ tipo, clientId, teamUserId, texto }) => {
        const denied = adminOnly(user);
        if (denied) return denied;
        let to: string | null = null;
        let destinationLabel = "";
        let body = "";
        let quotedId: string | null = null;
        let dedupeKey = `assistant:${user.id}:${Date.now()}`;
        if (tipo === "libre") {
          if (!texto?.trim()) return { error: "Escribe el mensaje libre que quieres preparar." };
          if ((teamUserId && clientId) || (!teamUserId && !clientId)) return { error: "Para un mensaje libre indica exactamente una persona del equipo o un cliente." };
          if (teamUserId) {
            const teammate = await db.user.findUnique({ where: { id: teamUserId }, select: { phone: true, whatsappOptIn: true, name: true } });
            if (!teammate?.phone || !teammate.whatsappOptIn) return { error: "El miembro no tiene WhatsApp habilitado." };
            const { normalizePhone } = await import("@/lib/whatsapp/enqueue");
            to = `${normalizePhone(teammate.phone)}@s.whatsapp.net`;
            destinationLabel = `Equipo · ${teammate.name || "persona"}`;
          } else if (clientId) {
            const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true, name: true, whatsappPhone: true } });
            if (!client) return { error: "Cliente no encontrado; usa buscarClientes." };
            const group = await db.whatsAppGroup.findFirst({ where: { clientId: client.id, enabled: true }, orderBy: { name: "asc" }, select: { jid: true, name: true } });
            if (group) {
              to = group.jid;
              destinationLabel = `Grupo ${group.name} · ${client.name}`;
            } else if (client.whatsappPhone) {
              const { normalizePhone } = await import("@/lib/whatsapp/enqueue");
              to = `${normalizePhone(client.whatsappPhone)}@s.whatsapp.net`;
              destinationLabel = `${client.name} · WhatsApp personal`;
            } else {
              return { error: "El cliente no tiene un grupo habilitado ni un teléfono WhatsApp." };
            }
          }
          body = texto.trim();
        } else {
          if (!clientId) return { error: "Busca al cliente y pasa clientId." };
          const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true, name: true, whatsappPhone: true, paymentReminderTarget: true } });
          if (!client) return { error: "Cliente no encontrado." };
          if (tipo === "recordatorio_pago") {
            const invoice = await db.invoice.findFirst({ where: { clientId, status: { in: ["PENDING", "SENT", "OVERDUE"] } }, orderBy: { dueDate: "asc" }, select: { id: true, amount: true, dueDate: true } });
            if (!invoice) return { error: "No hay facturas pendientes para ese cliente." };
            dedupeKey = `assistant:pay:${invoice.id}`;
            const waConfig = await getWhatsAppConfig();
            body = paymentReminderText({
              clientName: client.name,
              timing: "está pendiente",
              dueDate: invoice.dueDate?.toLocaleDateString("es-EC", { timeZone: "America/Guayaquil" }),
              amount: invoice.amount,
              isGroup: client.paymentReminderTarget !== "PERSONAL",
              amountsInGroups: waConfig.amountsInGroups,
              variantKey: dedupeKey,
            });
            if (client.paymentReminderTarget === "PERSONAL") {
              if (!client.whatsappPhone) return { error: "El cliente está configurado para recibir cobros personalmente, pero no tiene teléfono WhatsApp." };
              const { normalizePhone } = await import("@/lib/whatsapp/enqueue");
              to = `${normalizePhone(client.whatsappPhone)}@s.whatsapp.net`;
              destinationLabel = `${client.name} · WhatsApp personal`;
            } else {
              const group = await db.whatsAppGroup.findFirst({ where: { clientId, enabled: true, purposes: { has: "PAYMENT" } }, select: { jid: true, name: true } });
              to = group?.jid ?? null;
              if (group) destinationLabel = `Grupo ${group.name} · ${client.name}`;
            }
          } else if (tipo === "recordatorio_rodaje") {
            const shoot = await db.shoot.findFirst({ where: { clientId, status: "SCHEDULED", startTime: { gte: new Date() } }, orderBy: { startTime: "asc" }, select: { id: true, title: true, startTime: true } });
            if (!shoot) return { error: "No hay rodajes próximos para ese cliente." };
            dedupeKey = `assistant:shoot:${shoot.id}`;
            body = shootReminderText({ title: shoot.title, date: shoot.startTime.toLocaleString("es-EC", { timeZone: "America/Guayaquil" }), variantKey: dedupeKey });
            const group = await db.whatsAppGroup.findFirst({ where: { clientId, enabled: true, purposes: { has: "SHOOT" } }, select: { jid: true, name: true } });
            to = group?.jid ?? null;
            if (group) destinationLabel = `Grupo ${group.name} · ${client.name}`;
          } else {
            const group = await db.whatsAppGroup.findFirst({ where: { clientId, enabled: true, purposes: { has: "APPROVAL" } }, select: { jid: true, name: true } });
            const request = group ? await db.whatsAppApprovalRequest.findFirst({ where: { groupJid: group.jid, status: "PENDING" }, orderBy: { sentAt: "asc" }, select: { id: true, messageId: true, task: { select: { title: true } } } }) : null;
            if (!group || !request) return { error: "No hay aprobación pendiente en un grupo habilitado." };
            to = group.jid;
            destinationLabel = `Grupo ${group.name} · ${client.name}`;
            quotedId = request.messageId;
            dedupeKey = `assistant:approval:${request.id}`;
            body = approvalReminderText({ title: request.task?.title ?? "el contenido enviado", variantKey: dedupeKey });
          }
        }
        if (!to) return { error: "No hay destino habilitado para este cliente." };
        const { canSendToWhatsAppDestination } = await import("@/lib/whatsapp/enqueue");
        if (!(await canSendToWhatsAppDestination(to))) return { error: "WhatsApp está pausado o este destino no está habilitado." };
        const kind = tipo === "recordatorio_pago" ? "PAYMENT_REMINDER" : tipo === "recordatorio_rodaje" ? "SHOOT_REMINDER" : tipo === "recordatorio_aprobacion" ? "APPROVAL_REMINDER" : "MANUAL";
        return draft(user, "enviarWhatsApp", { to, body, kind, dedupeKey, quotedId }, { Destino: destinationLabel || "Destino autorizado", Mensaje: body, Tipo: tipo });
      },
    }),

    pausarBot: tool({
      description: "Prepara el cambio de pausa del bot; solo se aplica al confirmar el borrador. Solo admin.",
      inputSchema: z.object({ pausado: z.boolean() }),
      execute: async ({ pausado }) => {
        const denied = adminOnly(user);
        if (denied) return denied;
        return draft(user, "pausarBot", { pausado }, { Bot: pausado ? "Pausar" : "Reanudar" });
      },
    }),

    marcarAprobado: tool({
      description: "Prepara la aprobación de una tarea de cliente; requiere confirmación explícita. Solo admin.",
      inputSchema: z.object({ taskId: z.string() }),
      execute: async ({ taskId }) => {
        const denied = adminOnly(user);
        if (denied) return denied;
        const task = await db.contentTask.findUnique({ where: { id: taskId }, select: { id: true, title: true, status: true, client: { select: { name: true } } } });
        if (!task || !["REVIEW_CLIENT", "CLIENT_APPROVED"].includes(task.status)) return { error: "La tarea no está pendiente de aprobación del cliente." };
        if (task.status === "CLIENT_APPROVED") return { error: "La tarea ya está aprobada." };
        return draft(user, "marcarAprobado", { taskId }, { Tarea: task.title, Cliente: task.client.name, Estado: "CLIENT_APPROVED" });
      },
    }),
  };
  if (user.role === "ADMIN") return tools;
  const allowed = new Set(["listarTareas", "listarGastos"]);
  return Object.fromEntries(Object.entries(tools).map(([name, definition]) => [name,
    allowed.has(name) ? definition : { ...definition, execute: async () => ({ error: "No autorizado" }) },
  ])) as typeof tools;
}

export type AssistantTools = ReturnType<typeof buildAssistantTools>;
