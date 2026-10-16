/**
 * Herramientas de análisis del asistente: agregan en la base (groupBy/count)
 * y devuelven cifras ya calculadas, para que el modelo no tenga que sumar
 * filas ni adivinar. Todas son de solo lectura.
 *
 * Finanzas (cobros, ranking de clientes): solo admin.
 * Contenido (entregas, avance por cliente, métricas): admin ve todo; el resto
 * solo las tareas que tiene asignadas.
 */

import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { getReceivablesFromDb } from "@/lib/finance-transaction-service";
import type { AssistantUser } from "./tools";

const round = (n: number) => Math.round(n * 100) / 100;
const pct = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 100) : null);

const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .optional()
  .describe("Mes en formato YYYY-MM. Por defecto el mes en curso.");

/** Rango [inicio, fin) de un mes YYYY-MM en hora de Ecuador (UTC-5). */
function monthRange(month?: string, offset = 0): { start: Date; end: Date; value: string } {
  const now = new Date(Date.now() - 5 * 3600 * 1000);
  const [y0, m0] = month ? month.split("-").map(Number) : [now.getUTCFullYear(), now.getUTCMonth() + 1];
  const first = new Date(Date.UTC(y0, m0 - 1 + offset, 1));
  const y = first.getUTCFullYear();
  const m = first.getUTCMonth() + 1;
  return {
    start: new Date(Date.UTC(y, m - 1, 1, 5)),
    end: new Date(Date.UTC(y, m, 1, 5)),
    value: `${y}-${String(m).padStart(2, "0")}`,
  };
}

function adminOnly(user: AssistantUser) {
  return user.role === "ADMIN" ? null : { error: "Solo un administrador puede consultar esto." };
}

/** Filtro de tareas: el no-admin solo ve las suyas. */
function taskScope(user: AssistantUser) {
  return user.role === "ADMIN" ? {} : { OR: [{ assignedEditorId: user.id }, { assignedCommunityId: user.id }] };
}

async function clientNames(ids: string[]) {
  const clients = await db.client.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, logo: true },
  });
  return new Map(clients.map((c) => [c.id, c]));
}

function logosOf(rows: ({ name: string; logo: string | null } | undefined)[]) {
  return Object.fromEntries(
    rows.filter((r): r is { name: string; logo: string } => Boolean(r?.logo)).map((r) => [r.name, r.logo])
  );
}

const countBy = <T,>(rows: T[], key: (r: T) => string) => {
  const out: Record<string, number> = {};
  for (const r of rows) out[key(r)] = (out[key(r)] ?? 0) + 1;
  return out;
};

export function buildAnalysisTools(user: AssistantUser) {
  return {
    cobrosClientes: tool({
      description:
        "Cobros a clientes: quién ya pagó en el mes, quién falta pagar (monto y días de atraso) y el total por cobrar. Úsala para '¿cuántos clientes faltan de pagar?' o '¿quién me debe?'. Solo admin.",
      inputSchema: z.object({ mes: monthSchema }),
      execute: async ({ mes }) => {
        const denied = adminOnly(user);
        if (denied) return denied;
        const range = monthRange(mes);
        const now = new Date();
        // Para un mes pasado, la foto es al cierre de ese mes; para el actual, hoy.
        const reference = range.end < now ? new Date(range.end.getTime() - 1) : now;
        const [receivables, paidTx] = await Promise.all([
          getReceivablesFromDb(user.id, reference),
          db.transaction.groupBy({
            by: ["relatedClientId"],
            where: { type: "INCOME", status: "PAID", createdAt: { gte: range.start, lt: range.end } },
            _sum: { amount: true },
            _max: { createdAt: true },
          }),
        ]);
        if (!receivables.success || !receivables.data) return { error: receivables.error ?? "Sin datos de cobros" };

        const pending = receivables.data.pendingTransactions.filter((p) => p.status === "PENDING");
        const byClient = new Map<string, { monto: number; diasAtraso: number; logo: string | null; items: number }>();
        for (const p of pending) {
          const name = p.clientName ?? p.description;
          const d = byClient.get(name) ?? { monto: 0, diasAtraso: 0, logo: p.clientLogo ?? null, items: 0 };
          byClient.set(name, {
            monto: d.monto + p.amount,
            diasAtraso: Math.max(d.diasAtraso, p.daysOverdue),
            logo: d.logo,
            items: d.items + 1,
          });
        }
        const names = await clientNames(paidTx.flatMap((r) => (r.relatedClientId ? [r.relatedClientId] : [])));
        const paid = paidTx
          .filter((r) => r.relatedClientId)
          .map((r) => ({
            cliente: names.get(r.relatedClientId as string)?.name ?? "Cliente eliminado",
            monto: round(r._sum.amount ?? 0),
            ultimoPago: r._max.createdAt?.toISOString().slice(0, 10) ?? null,
          }))
          .sort((a, b) => b.monto - a.monto);

        return {
          mes: range.value,
          resumen: {
            clientesQuePagaron: paid.length,
            montoCobrado: round(paid.reduce((s, p) => s + p.monto, 0)),
            clientesQueFaltanPagar: byClient.size,
            montoPorCobrar: round(receivables.data.totalReceivable),
            vencidos: [...byClient.values()].filter((d) => d.diasAtraso > 0).length,
          },
          logos: {
            ...logosOf([...names.values()]),
            ...Object.fromEntries([...byClient.entries()].filter(([, d]) => d.logo).map(([n, d]) => [n, d.logo as string])),
          },
          faltanPorPagar: [...byClient.entries()]
            .sort((a, b) => b[1].monto - a[1].monto)
            .map(([cliente, d]) => ({
              cliente,
              monto: round(d.monto),
              diasAtraso: d.diasAtraso,
              cuotasPendientes: d.items,
            })),
          pagaron: paid,
        };
      },
    }),

    rankingClientes: tool({
      description:
        "Ranking de clientes en un mes por 'ingresos' (lo que pagó cada cliente) o por 'gastos' (lo que la agencia gastó en cada cliente: comida, transporte, etc.). Úsala para '¿qué cliente pagó más?' o '¿en qué cliente gastamos más?'. Solo admin.",
      inputSchema: z.object({
        mes: monthSchema,
        metrica: z.enum(["ingresos", "gastos"]),
      }),
      execute: async ({ mes, metrica }) => {
        const denied = adminOnly(user);
        if (denied) return denied;
        const range = monthRange(mes);
        const totals = new Map<string, number>();
        const add = (id: string | null, amount: number | null) => {
          if (id && amount) totals.set(id, (totals.get(id) ?? 0) + amount);
        };

        if (metrica === "ingresos") {
          const [invoices, income] = await Promise.all([
            db.invoice.groupBy({
              by: ["clientId"],
              where: { status: "PAID", paidAt: { gte: range.start, lt: range.end } },
              _sum: { amount: true },
            }),
            db.transaction.groupBy({
              by: ["relatedClientId"],
              where: { type: "INCOME", status: "PAID", createdAt: { gte: range.start, lt: range.end } },
              _sum: { amount: true },
            }),
          ]);
          invoices.forEach((r) => add(r.clientId, r._sum.amount));
          income.forEach((r) => add(r.relatedClientId, r._sum.amount));
        } else {
          const [expenses, txs] = await Promise.all([
            db.expense.groupBy({
              by: ["clientId"],
              where: { date: { gte: range.start, lt: range.end } },
              _sum: { amount: true },
            }),
            db.transaction.groupBy({
              by: ["relatedClientId"],
              where: { type: "EXPENSE", status: "PAID", createdAt: { gte: range.start, lt: range.end } },
              _sum: { amount: true },
            }),
          ]);
          expenses.forEach((r) => add(r.clientId, r._sum.amount));
          txs.forEach((r) => add(r.relatedClientId, r._sum.amount));
        }

        const names = await clientNames([...totals.keys()]);
        const ranking = [...totals.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
          .map(([id, total], i) => ({ puesto: i + 1, cliente: names.get(id)?.name ?? "Cliente eliminado", total: round(total) }));
        const sum = [...totals.values()].reduce((s, v) => s + v, 0);
        return {
          mes: range.value,
          metrica,
          total: round(sum),
          clientes: totals.size,
          logos: logosOf([...names.values()]),
          ranking: ranking.map((r) => ({ ...r, porcentaje: sum ? Math.round((r.total / sum) * 100) : 0 })),
        };
      },
    }),

    entregasDelMes: tool({
      description:
        "Productividad de contenido: piezas publicadas en un mes (por tipo, cliente y editor) comparadas con el mes anterior. Úsala para 'compara las tareas entregadas con el mes pasado' o '¿cuánto publicamos este mes?'.",
      inputSchema: z.object({
        mes: monthSchema,
        clientId: z.string().optional(),
      }),
      execute: async ({ mes, clientId }) => {
        const range = monthRange(mes);
        const prev = monthRange(range.value, -1);
        const base = { ...taskScope(user), ...(clientId && { clientId }) };
        const select = {
          type: true,
          client: { select: { name: true, logo: true } },
          assignedEditor: { select: { name: true } },
        } as const;
        const [current, before, createdNow, createdBefore] = await Promise.all([
          db.contentTask.findMany({ where: { ...base, publishedAt: { gte: range.start, lt: range.end } }, select }),
          db.contentTask.findMany({ where: { ...base, publishedAt: { gte: prev.start, lt: prev.end } }, select: { type: true } }),
          db.contentTask.count({ where: { ...base, createdAt: { gte: range.start, lt: range.end } } }),
          db.contentTask.count({ where: { ...base, createdAt: { gte: prev.start, lt: prev.end } } }),
        ]);
        const typesNow = countBy(current, (t) => t.type);
        const typesBefore = countBy(before, (t) => t.type);
        return {
          mes: range.value,
          mesAnterior: prev.value,
          alcance: user.role === "ADMIN" ? "todo el equipo" : "solo tus tareas",
          publicadas: { esteMes: current.length, mesAnterior: before.length, variacionPct: pct(current.length, before.length) },
          creadas: { esteMes: createdNow, mesAnterior: createdBefore },
          porTipo: Object.keys({ ...typesNow, ...typesBefore }).map((tipo) => ({
            tipo,
            esteMes: typesNow[tipo] ?? 0,
            mesAnterior: typesBefore[tipo] ?? 0,
          })),
          logos: logosOf(current.map((t) => t.client)),
          porCliente: Object.entries(countBy(current, (t) => t.client.name))
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([cliente, publicadas]) => ({ cliente, publicadas })),
          porEditor: Object.entries(countBy(current, (t) => t.assignedEditor?.name ?? "Sin editor"))
            .sort((a, b) => b[1] - a[1])
            .map(([editor, publicadas]) => ({ editor, publicadas })),
        };
      },
    }),

    avanceContenidoClientes: tool({
      description:
        "Avance del plan de contenido de cada cliente en un mes: reels y flyers contratados vs. publicados, cuántos faltan y en qué estado están los pendientes. Úsala para '¿cuántos videos faltan publicar de X este mes?' (pasa clientId) o '¿qué clientes van atrasados?'.",
      inputSchema: z.object({
        mes: monthSchema,
        clientId: z.string().optional().describe("Un cliente concreto; sin él, todos los activos"),
      }),
      execute: async ({ mes, clientId }) => {
        const range = monthRange(mes);
        const inMonth = { gte: range.start, lt: range.end };
        const clients = await db.client.findMany({
          where: clientId ? { id: clientId } : { status: { in: ["ACTIVE", "DEBT"] } },
          select: { id: true, name: true, logo: true, monthlyReels: true, monthlyFlyers: true },
        });
        const ids = clients.map((c) => c.id);
        const tasks = await db.contentTask.findMany({
          where: {
            ...taskScope(user),
            clientId: { in: ids },
            status: { notIn: ["CANCELLED", "REJECTED"] },
            OR: [{ publishedAt: inMonth }, { scheduledAt: inMonth }, { dueDate: inMonth }],
          },
          select: { clientId: true, type: true, status: true, publishedAt: true },
        });

        const rows = clients.map((c) => {
          const own = tasks.filter((t) => t.clientId === c.id);
          const published = own.filter((t) => t.status === "PUBLISHED" && t.publishedAt && t.publishedAt >= range.start && t.publishedAt < range.end);
          const open = own.filter((t) => t.status !== "PUBLISHED");
          const reels = published.filter((t) => t.type === "REEL").length;
          const flyers = published.filter((t) => t.type === "FLYER").length;
          return {
            cliente: c.name,
            reels: { contratados: c.monthlyReels, publicados: reels, faltan: Math.max(0, c.monthlyReels - reels) },
            flyers: { contratados: c.monthlyFlyers, publicados: flyers, faltan: Math.max(0, c.monthlyFlyers - flyers) },
            enProceso: open.length,
            pendientesPorEstado: countBy(open, (t) => t.status),
          };
        });
        const relevant = rows
          .filter((r) => clientId || r.reels.contratados + r.flyers.contratados + r.enProceso > 0)
          .sort((a, b) => b.reels.faltan + b.flyers.faltan - (a.reels.faltan + a.flyers.faltan));

        return {
          mes: range.value,
          alcance: user.role === "ADMIN" ? "todo el equipo" : "solo tus tareas",
          totales: {
            reelsFaltan: relevant.reduce((s, r) => s + r.reels.faltan, 0),
            flyersFaltan: relevant.reduce((s, r) => s + r.flyers.faltan, 0),
            clientesAlDia: relevant.filter((r) => r.reels.faltan + r.flyers.faltan === 0).length,
          },
          logos: logosOf(clients),
          clientes: relevant.slice(0, 20),
        };
      },
    }),

    utilidadesAcumuladas: tool({
      description:
        "Fondo de utilidades acumuladas (dinero apartado de caja y repartido 50/50 entre los socios a fin de año): saldo actual, total aportado, total retirado, cuánto le toca a cada socio y últimos movimientos. Úsala para '¿cuánto hay de utilidades?' o 'utilidades acumuladas'. Solo admin.",
      inputSchema: z.object({}),
      execute: async () => {
        const denied = adminOnly(user);
        if (denied) return denied;
        const [byType, last, movements] = await Promise.all([
          db.emergencyFundMovement.groupBy({ by: ["type"], _sum: { amount: true }, _count: true }),
          db.emergencyFundMovement.findFirst({ orderBy: { createdAt: "desc" }, select: { balanceAfter: true } }),
          db.emergencyFundMovement.findMany({
            orderBy: { createdAt: "desc" },
            take: 8,
            select: {
              type: true, amount: true, balanceAfter: true, year: true, month: true, reason: true, createdAt: true,
              authorizedBy: { select: { name: true } },
            },
          }),
        ]);
        const sumOf = (type: string) => byType.find((t) => t.type === type);
        const balance = last?.balanceAfter ?? 0;
        return {
          saldoActual: round(balance),
          totalAportado: round(sumOf("CONTRIBUTION")?._sum.amount ?? 0),
          aportes: sumOf("CONTRIBUTION")?._count ?? 0,
          totalRetirado: round(sumOf("WITHDRAWAL")?._sum.amount ?? 0),
          retiros: sumOf("WITHDRAWAL")?._count ?? 0,
          porSocio: round(balance / 2),
          reparto: "50/50 entre los socios, a fin de año",
          movimientos: movements.map((m) => ({
            fecha: m.createdAt.toISOString().slice(0, 10),
            tipo: m.type === "CONTRIBUTION" ? "aporte" : "retiro",
            monto: round(m.amount),
            saldoDespues: round(m.balanceAfter),
            mes: `${m.year}-${String(m.month).padStart(2, "0")}`,
            motivo: m.reason,
            autorizadoPor: m.authorizedBy?.name ?? null,
          })),
        };
      },
    }),

    metricasContenido: tool({
      description:
        "Rendimiento en redes de lo publicado en un mes: vistas, alcance, likes, guardados, conversiones y ventas, con las piezas top. Opcional por cliente. Úsala para análisis de métricas de contenido.",
      inputSchema: z.object({
        mes: monthSchema,
        clientId: z.string().optional(),
      }),
      execute: async ({ mes, clientId }) => {
        const range = monthRange(mes);
        const prev = monthRange(range.value, -1);
        const where = (r: { start: Date; end: Date }) => ({
          ...taskScope(user),
          ...(clientId && { clientId }),
          publishedAt: { gte: r.start, lt: r.end },
          metrics: { isNot: null },
        });
        const [tasks, before] = await Promise.all([
          db.contentTask.findMany({
            where: where(range),
            select: { title: true, type: true, client: { select: { name: true, logo: true } }, metrics: true },
          }),
          db.taskMetrics.aggregate({
            where: { task: where(prev) },
            _sum: { metaViews: true, ttViews: true, metaReach: true },
          }),
        ]);
        const sum = (f: (m: NonNullable<(typeof tasks)[number]["metrics"]>) => number) =>
          tasks.reduce((s, t) => s + (t.metrics ? f(t.metrics) : 0), 0);
        const views = sum((m) => m.metaViews + m.ttViews);
        const viewsBefore = (before._sum.metaViews ?? 0) + (before._sum.ttViews ?? 0);
        return {
          mes: range.value,
          piezasConMetricas: tasks.length,
          totales: {
            vistas: views,
            vistasMesAnterior: viewsBefore,
            variacionVistasPct: pct(views, viewsBefore),
            alcanceMeta: sum((m) => m.metaReach),
            likes: sum((m) => m.metaLikes + m.ttLikes),
            comentarios: sum((m) => m.metaComments + m.ttComments),
            compartidos: sum((m) => m.metaShares + m.ttShares),
            guardados: sum((m) => m.metaSaves + m.ttSaves),
            conversiones: sum((m) => m.conversions),
            ventas: sum((m) => m.salesCount),
            ingresosAtribuidos: round(sum((m) => m.revenue)),
          },
          logos: logosOf(tasks.map((t) => t.client)),
          top: tasks
            .map((t) => ({
              titulo: t.title,
              tipo: t.type,
              cliente: t.client.name,
              vistas: (t.metrics?.metaViews ?? 0) + (t.metrics?.ttViews ?? 0),
              engagementMeta: t.metrics?.erMeta ?? 0,
            }))
            .sort((a, b) => b.vistas - a.vistas)
            .slice(0, 5),
        };
      },
    }),
  };
}
