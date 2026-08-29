"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, CloudOff, DollarSign, LayoutDashboard, RefreshCw, Users, WifiOff } from "lucide-react";
import { useDashboard } from "@/hooks/use-totem-api";
import { TotemApiError, type DashboardData, type DashboardTask } from "@/generated/api-client";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Sin fecha" : dateFormatter.format(date);
}

function TaskRow({ task }: { task: DashboardTask }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/45 p-3 transition-colors motion-reduce:transition-none hover:bg-background/75">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
        <Clock3 className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
        <p className="truncate text-xs text-muted-foreground">{task.client.name} · {formatDate(task.scheduledAt ?? task.dueDate)}</p>
      </div>
      <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{task.priority}</span>
    </li>
  );
}

function SummaryCard({ label, value, detail, icon: Icon, tone = "text-foreground" }: { label: string; value: string | number; detail: string; icon: typeof Users; tone?: string }) {
  return (
    <article className="rounded-3xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur-xl sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex size-9 items-center justify-center rounded-2xl bg-muted text-muted-foreground" aria-hidden="true"><Icon className="size-4" /></span>
        <span className={`text-2xl font-semibold tracking-tight ${tone}`}>{value}</span>
      </div>
      <p className="mt-4 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function DashboardContent({ dashboard }: { dashboard: DashboardData }) {
  const { summary } = dashboard;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Clientes activos" value={summary.activeClients} detail="Cuentas en operación" icon={Users} />
        <SummaryCard label="Tareas asignadas" value={summary.assignedTasks} detail={`${summary.priorityTasks} requieren atención`} icon={LayoutDashboard} tone={summary.priorityTasks ? "text-amber-600 dark:text-amber-400" : undefined} />
        <SummaryCard label="Aprobaciones" value={summary.pendingApprovals} detail="Feedback y publicaciones" icon={CheckCircle2} tone={summary.pendingApprovals ? "text-blue-600 dark:text-blue-400" : undefined} />
        <SummaryCard label="Publicadas este mes" value={summary.publishedThisMonth} detail="Contenido entregado" icon={CheckCircle2} tone="text-emerald-600 dark:text-emerald-400" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-3xl border border-border/60 bg-card/70 p-5 shadow-sm backdrop-blur-xl sm:p-6" aria-labelledby="dashboard-agenda-title">
          <div className="flex items-start justify-between gap-4">
            <div><h2 id="dashboard-agenda-title" className="text-base font-semibold">Agenda de hoy</h2><p className="mt-1 text-sm text-muted-foreground">{summary.scheduledToday} actividades programadas</p></div>
            <Clock3 className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
          {dashboard.agenda.length ? <ul className="mt-5 space-y-2">{dashboard.agenda.map((task) => <TaskRow key={task.id} task={task} />)}</ul> : <p className="mt-6 rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">No hay actividades programadas para hoy.</p>}
        </section>

        <section className="rounded-3xl border border-border/60 bg-card/70 p-5 shadow-sm backdrop-blur-xl sm:p-6" aria-labelledby="dashboard-pipeline-title">
          <div className="flex items-start justify-between gap-4"><div><h2 id="dashboard-pipeline-title" className="text-base font-semibold">Pipeline</h2><p className="mt-1 text-sm text-muted-foreground">Producción del mes</p></div><LayoutDashboard className="size-5 text-muted-foreground" aria-hidden="true" /></div>
          <div className="mt-5 space-y-3">{dashboard.pipeline.map((stage) => <div key={stage.key} className="flex items-center gap-3"><span className="w-24 truncate text-xs text-muted-foreground">{stage.label}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${Math.min(100, stage.count * 12)}%` }} /></div><span className="w-6 text-right text-sm font-medium">{stage.count}</span></div>)}</div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-border/60 bg-card/70 p-5 shadow-sm backdrop-blur-xl sm:p-6" aria-labelledby="dashboard-priority-title">
          <div className="flex items-start justify-between gap-4"><div><h2 id="dashboard-priority-title" className="text-base font-semibold">Requieren atención</h2><p className="mt-1 text-sm text-muted-foreground">Próximos cuatro días</p></div><AlertCircle className="size-5 text-amber-500" aria-hidden="true" /></div>
          {dashboard.priorityTasks.length ? <ul className="mt-5 space-y-2">{dashboard.priorityTasks.map((task) => <TaskRow key={task.id} task={task} />)}</ul> : <p className="mt-6 rounded-2xl bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">Todo al día por ahora.</p>}
        </section>

        <section className="rounded-3xl border border-border/60 bg-card/70 p-5 shadow-sm backdrop-blur-xl sm:p-6" aria-labelledby="dashboard-capacity-title">
          <div className="flex items-start justify-between gap-4"><div><h2 id="dashboard-capacity-title" className="text-base font-semibold">Capacidad del equipo</h2><p className="mt-1 text-sm text-muted-foreground">Tareas pendientes por persona</p></div><Users className="size-5 text-muted-foreground" aria-hidden="true" /></div>
          {dashboard.workloads.length ? <ul className="mt-5 space-y-4">{dashboard.workloads.map((workload) => <li key={workload.userId}><div className="flex justify-between gap-3 text-sm"><span className="truncate">{workload.userName}</span><span className="text-muted-foreground">{workload.pendingTasksCount}/{workload.weeklyCapacity}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${workload.utilizationPct >= 80 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${Math.min(100, workload.utilizationPct)}%` }} /></div></li>)}</ul> : <p className="mt-6 rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">No hay carga registrada.</p>}
        </section>
      </div>

      {dashboard.user.role === "ADMIN" && <section className="rounded-3xl border border-border/60 bg-card/70 p-5 shadow-sm backdrop-blur-xl sm:p-6" aria-labelledby="dashboard-finance-title"><div className="flex items-start justify-between gap-4"><div><h2 id="dashboard-finance-title" className="text-base font-semibold">Resumen financiero</h2><p className="mt-1 text-sm text-muted-foreground">Visión administrativa del mes</p></div><DollarSign className="size-5 text-muted-foreground" aria-hidden="true" /></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Ingresos</p><p className="mt-1 text-xl font-semibold">{summary.totalIncome === null ? "—" : currency.format(summary.totalIncome)}</p></div><div className="rounded-2xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Por cobrar</p><p className="mt-1 text-xl font-semibold">{summary.totalReceivable === null ? "—" : currency.format(summary.totalReceivable)}</p></div></div></section>}
    </div>
  );
}

function Skeleton() {
  return <div data-testid="dashboard-loading" className="space-y-6" aria-busy="true" aria-label="Cargando dashboard"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-3xl bg-muted motion-reduce:animate-none" />)}</div><div className="grid gap-6 xl:grid-cols-2"><div className="h-72 animate-pulse rounded-3xl bg-muted motion-reduce:animate-none" /><div className="h-72 animate-pulse rounded-3xl bg-muted motion-reduce:animate-none" /></div></div>;
}

export function ApiDashboardView() {
  const query = useDashboard();
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  const isApiOffline = query.error instanceof TotemApiError && query.error.status === 0;
  const isEmpty = useMemo(() => {
    const dashboard = query.data?.data;
    return Boolean(dashboard && dashboard.summary.activeClients === 0 && dashboard.summary.assignedTasks === 0 && dashboard.pipeline.every((stage) => stage.count === 0));
  }, [query.data]);

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 pb-10 pt-6 sm:px-6 lg:px-8" data-testid="api-dashboard">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-muted-foreground">Command center</p><h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Buenos días, {query.data?.data.user.name.split(" ")[0] ?? "Usuario"}</h1><p className="mt-2 text-sm text-muted-foreground">Una vista tranquila de lo que merece tu atención.</p></div><button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-2 text-sm font-medium shadow-sm backdrop-blur-xl transition-transform active:scale-[.98] motion-reduce:transition-none disabled:opacity-60" aria-label="Actualizar dashboard" data-testid="dashboard-refresh"><RefreshCw className={`size-4 ${query.isFetching ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />Actualizar</button></header>

      {(offline || isApiOffline) && <div className="mb-5 flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200" role="status" data-testid="dashboard-offline"><WifiOff className="size-4 shrink-0" />Sin conexión. Mostrando datos cacheados cuando están disponibles.</div>}
      {(offline || isApiOffline) && !query.data && !query.isLoading && <div className="rounded-3xl border border-border/60 bg-card/70 p-10 text-center shadow-sm backdrop-blur-xl" role="status" data-testid="dashboard-offline-empty"><WifiOff className="mx-auto size-10 text-amber-500" /><h2 className="mt-4 text-xl font-semibold">Sin conexión</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Conecta el dispositivo para cargar el dashboard por primera vez.</p><button type="button" onClick={() => query.refetch()} className="mt-5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background">Reintentar</button></div>}
      {query.isLoading && !query.data && <Skeleton />}
      {query.isError && !query.data && !offline && !isApiOffline && <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-6" role="alert" data-testid="dashboard-error"><div className="flex items-start gap-3"><CloudOff className="mt-0.5 size-5 text-destructive" /><div><h2 className="font-semibold">No se pudo cargar el dashboard</h2><p className="mt-1 text-sm text-muted-foreground">Revisa tu sesión o intenta nuevamente.</p><button type="button" onClick={() => query.refetch()} className="mt-4 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background">Reintentar</button></div></div></div>}
      {query.data && isEmpty && <div className="rounded-3xl border border-border/60 bg-card/70 p-10 text-center shadow-sm backdrop-blur-xl" data-testid="dashboard-empty"><CheckCircle2 className="mx-auto size-10 text-emerald-500" /><h2 className="mt-4 text-xl font-semibold">Todo despejado</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Todavía no hay clientes ni tareas para mostrar. Cuando llegue el primer trabajo aparecerá aquí.</p></div>}
      {query.data && !isEmpty && <DashboardContent dashboard={query.data.data} />}
      {query.isFetching && query.data && <p className="mt-4 text-center text-xs text-muted-foreground" role="status">Actualizando…</p>}
    </main>
  );
}
