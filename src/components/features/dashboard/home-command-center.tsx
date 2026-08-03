import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowUpRight as TrendUp,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  Clock3,
  FileCheck2,
  FileText,
  Gauge,
  Layers3,
  PanelTop,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { format, formatDistanceToNow, isToday, isTomorrow, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import type { UserWorkload } from "@/actions/workload-actions";
import type { FinancialStats } from "@/actions/finance-actions";
import { DashboardRefresh } from "@/components/features/content/dashboard-refresh";

type Feedback = {
  id: string;
  clientName: string;
  clientId: string;
  month: number;
  year: number;
  approved: boolean;
  comment: string | null;
  createdAt: Date;
};

type ClientRecord = { id: string; name: string; status: string; logo?: string | null; color?: string | null };
type ReceivablesSummary = { totalReceivable: number; clientsWithDebt: number; monthProjection: number };

export interface HomeCommandCenterProps {
  firstName: string;
  userRole: string | null | undefined;
  specialty: string | null | undefined;
  tasks: ContentTaskWithClient[];
  clients: ClientRecord[];
  workloads: UserWorkload[];
  feedbacks: Feedback[];
  finance: FinancialStats | null;
  receivables: ReceivablesSummary | null;
}

const STATUS_LABELS: Record<string, string> = {
  IDEA: "Idea",
  SCRIPT: "Guion",
  RECORDED: "Producción",
  EDITING: "Edición",
  REVIEW_INTERNAL: "Revisión interna",
  REVIEW_CLIENT: "Revisión cliente",
  CLIENT_APPROVED: "Aprobado",
  APPROVED: "Aprobado",
  PUBLISHED: "Publicado",
};

const PIPELINE_STAGES = [
  { key: "IDEA", label: "Ideas", color: "hsl(var(--theme-info))" },
  { key: "SCRIPT", label: "Guion", color: "hsl(var(--theme-peach))" },
  { key: "PRODUCTION", label: "Producción", color: "hsl(var(--chart-4))" },
  { key: "EDITING", label: "Edición", color: "hsl(var(--chart-2))" },
  { key: "REVIEW", label: "Revisión", color: "hsl(var(--theme-warning))" },
  { key: "PUBLISHED", label: "Publicado", color: "hsl(var(--theme-success))" },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function ClientMark({ name, logo, color }: { name: string; logo?: string | null; color?: string | null }) {
  return logo ? (
    <img src={logo} alt="" className="size-5 shrink-0 rounded-md object-cover ring-1 ring-border/60" />
  ) : (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-md text-[8px] font-bold text-white" style={{ backgroundColor: color || "hsl(var(--primary))" }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

function UserMark({ name, image, className = "size-5" }: { name: string; image?: string | null; className?: string }) {
  return image ? (
    <img src={image} alt="" className={`${className} shrink-0 rounded-full object-cover ring-1 ring-border/60`} />
  ) : (
    <span className={`flex ${className} shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-semibold text-muted-foreground`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

function relativeDate(date: Date | null | undefined) {
  if (!date) return "Sin fecha";
  if (isToday(date)) return "Hoy";
  if (isTomorrow(date)) return "Mañana";
  return format(date, "d MMM", { locale: es });
}

function getPipelineKey(status: string) {
  if (status === "IDEA") return "IDEA";
  if (status === "SCRIPT") return "SCRIPT";
  if (status === "RECORDED") return "PRODUCTION";
  if (status === "EDITING") return "EDITING";
  if (["REVIEW_INTERNAL", "REVIEW_CLIENT"].includes(status)) return "REVIEW";
  return "PUBLISHED";
}

function Sparkline({ points, color = "hsl(var(--primary))" }: { points: number[]; color?: string }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const path = points.map((point, index) => {
    const x = (index / Math.max(points.length - 1, 1)) * 96 + 2;
    const y = 28 - ((point - min) / range) * 22;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");

  return (
    <svg aria-hidden="true" className="h-8 w-24 shrink-0 overflow-visible" viewBox="0 0 100 32" fill="none">
      <path d="M2 29H98" stroke="currentColor" className="text-border" strokeWidth="1" />
      <path d={path} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionHeading({ icon: Icon, title, description, href, action }: {
  icon: typeof CalendarDays;
  title: string;
  description?: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4 sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-card-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {href && action && (
        <Link href={href} className="shrink-0 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          {action} <ChevronRight className="ml-0.5 inline size-3.5" />
        </Link>
      )}
    </div>
  );
}

function Metric({ label, value, delta, tone, points, icon: Icon, href }: {
  label: string;
  value: string | number;
  delta: string;
  tone: "success" | "warning" | "error" | "info" | "neutral";
  points: number[];
  icon: typeof TrendUp;
  href?: string;
}) {
  const toneClass = {
    success: "text-[hsl(var(--theme-success))]",
    warning: "text-[hsl(var(--theme-warning))]",
    error: "text-[hsl(var(--theme-error))]",
    info: "text-[hsl(var(--theme-info))]",
    neutral: "text-foreground",
  }[tone];
  const content = (
    <div className="group flex h-full min-w-0 flex-col rounded-2xl border border-border/70 bg-card p-4 shadow-[0_8px_30px_hsl(var(--foreground)/0.03)] transition-colors hover:border-border sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted ${toneClass}`}>
          <Icon className="size-4" strokeWidth={1.8} />
        </span>
        <Sparkline points={points} color={tone === "neutral" ? "hsl(var(--muted-foreground))" : `hsl(var(--theme-${tone}))`} />
      </div>
      <p className="mt-4 truncate text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className={`mt-1 truncate text-[22px] font-semibold tracking-[-0.045em] ${toneClass}`}>{value}</p>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">{delta}</p>
    </div>
  );
  return href ? <Link href={href} className="block h-full last:col-span-2 xl:last:col-span-1">{content}</Link> : <div className="last:col-span-2 xl:last:col-span-1">{content}</div>;
}

function getTaskOwner(task: ContentTaskWithClient) {
  return task.assignedEditor?.name || task.assignedCommunity?.name || "Sin asignar";
}

function getTaskOwnerRecord(task: ContentTaskWithClient) {
  return task.assignedEditor || task.assignedCommunity || null;
}

export function HomeCommandCenter({ firstName, userRole, specialty, tasks, clients, workloads, feedbacks, finance, receivables }: HomeCommandCenterProps) {
  const isAdmin = userRole === "ADMIN";
  const today = startOfDay(new Date());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthTasks = tasks.filter((task) => {
    const date = task.publishedAt || task.dueDate || task.createdAt;
    return date >= monthStart;
  });
  const overdueTasks = tasks.filter((task) => task.dueDate && startOfDay(new Date(task.dueDate)) < today && task.status !== "PUBLISHED");
  const scheduledToday = tasks
    .filter((task) => task.scheduledAt && isToday(new Date(task.scheduledAt)) && task.status !== "PUBLISHED")
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
    .slice(0, 6);
  const priorityTasks = tasks
    .filter((task) => task.dueDate && task.status !== "PUBLISHED" && new Date(task.dueDate) <= new Date(Date.now() + 1000 * 60 * 60 * 24 * 4))
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 6);
  const publishedThisMonth = monthTasks.filter((task) => task.status === "PUBLISHED").length;
  const completedWithDates = monthTasks.filter((task) => task.status === "PUBLISHED" && task.dueDate && task.publishedAt);
  const onTimeRate = completedWithDates.length > 0
    ? Math.round((completedWithDates.filter((task) => new Date(task.publishedAt!) <= new Date(task.dueDate!)).length / completedWithDates.length) * 100)
    : 0;
  const pipelineCounts = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    count: monthTasks.filter((task) => getPipelineKey(task.status) === stage.key).length,
  }));
  const totalPipeline = pipelineCounts.reduce((sum, stage) => sum + stage.count, 0);
  const blockedCount = tasks.filter((task) => task.status === "REVIEW_INTERNAL" || task.status === "REVIEW_CLIENT").length;
  const relevantWorkloads = workloads
    .filter((workload) => !/test|totem mass|sistema/i.test(workload.userName))
    .filter((workload) => workload.userRole === "ADMIN" || workload.userRole === "EDITOR")
    .filter((workload) => workload.pendingTasksCount > 0 || /editor|community/i.test(workload.userSpecialty || ""));
  const relevantFeedbacks = feedbacks.slice(0, 4);
  const approvalTasks = tasks
    .filter((task) => ["REVIEW_INTERNAL", "REVIEW_CLIENT", "CLIENT_APPROVED"].includes(task.status))
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
    .slice(0, 3);
  const projectedBalance = (finance?.netProfit || 0) + (finance?.closureControl?.pendingAmount || 0);
  const activeClients = clients.filter((client) => client.status === "ACTIVE").length;
  const activeRoleLabel = specialty?.replace(/\b\w/g, (letter) => letter.toUpperCase()) || (userRole === "ADMIN" ? "Administrador" : "Equipo de contenido");

  return (
    <main className="min-h-screen bg-muted/20 pb-10">
      <div className="mx-auto max-w-[1480px] px-4 pt-5 sm:px-6 sm:pt-7 lg:px-8">
        <header className="relative z-10 mb-9 flex flex-wrap items-center justify-between gap-4 pb-1">
          <div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-[25px] font-semibold tracking-[-0.045em] text-foreground sm:text-[29px]">Buenos días, {firstName}</h1>
              <span className="hidden text-sm text-muted-foreground sm:inline">{format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{scheduledToday.length} actividades y {priorityTasks.length} tareas requieren atención hoy.</p>
          </div>
          <div className="flex items-center gap-2">
            <DashboardRefresh />
          </div>
        </header>

        <section aria-label="Resumen ejecutivo" className="mb-5">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            {isAdmin && finance && <Metric label="Ingresos del mes" value={formatCurrency(finance.totalIncome)} delta={`${finance.incomeDeltaPct && finance.incomeDeltaPct >= 0 ? "+" : ""}${Math.round(finance.incomeDeltaPct || 0)}%`} tone="success" points={[4, 5, 4, 7, 8, 9, 11]} icon={WalletCards} href="/finance" />}
            {isAdmin && receivables && <Metric label="Saldo pendiente total" value={formatCurrency(receivables.totalReceivable)} delta={`${receivables.clientsWithDebt} clientes con deuda`} tone="warning" points={[8, 7, 8, 6, 5, 5, receivables.totalReceivable]} icon={FileText} href="/finance/receivables" />}
            <Metric label="Tareas vencidas" value={overdueTasks.length} delta={overdueTasks.length ? "requieren acción" : "todo al día"} tone={overdueTasks.length ? "error" : "success"} points={[7, 6, 6, 5, 4, 4, overdueTasks.length]} icon={CircleAlert} href="/content" />
            <Metric label="Contenido publicado" value={publishedThisMonth} delta="este mes" tone="info" points={[3, 4, 4, 6, 5, 8, publishedThisMonth]} icon={PanelTop} href="/content" />
            <Metric label={isAdmin ? "Clientes activos" : "Tareas asignadas"} value={isAdmin ? activeClients : tasks.length} delta={isAdmin ? "en el sistema" : activeRoleLabel} tone="neutral" points={[5, 6, 5, 7, 7, 8, 9]} icon={UsersRound} href={isAdmin ? "/clients" : "/content"} />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_8px_30px_hsl(var(--foreground)/0.03)] xl:col-span-5">
            <SectionHeading icon={CalendarDays} title="Agenda de hoy" description={`${scheduledToday.length} actividades programadas`} href="/content" action="Ver agenda" />
            <div className="px-5 py-3 sm:px-6">
              {scheduledToday.length > 0 ? scheduledToday.map((task, index) => (
                <div key={task.id} className="relative flex gap-3 border-b border-border/60 py-3 last:border-0">
                  <div className="relative flex w-12 shrink-0 flex-col items-end pt-0.5 text-right">
                    <span className="text-xs font-semibold tabular-nums text-foreground">{format(new Date(task.scheduledAt!), "HH:mm")}</span>
                    {index < scheduledToday.length - 1 && <span className="absolute right-[-13px] top-7 h-[calc(100%+1px)] w-px bg-border" />}
                  </div>
                  <span className="relative mt-1.5 size-2 shrink-0 rounded-full bg-[hsl(var(--theme-info))] ring-4 ring-[hsl(var(--theme-info)/0.12)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-card-foreground">{task.title}</p>
                    <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                      <ClientMark name={task.client.name} logo={task.client.logo} color={task.client.color} /><span className="truncate">{task.client.name}</span><span aria-hidden="true">·</span><span>{task.type}</span>
                    </div>
                  </div>
                  <span className="mt-0.5 shrink-0 text-[11px] text-muted-foreground">{STATUS_LABELS[task.status] || task.status}</span>
                </div>
              )) : <EmptyState icon={CalendarDays} title="Agenda despejada" description="No hay publicaciones ni entregas programadas para hoy." href="/content" action="Abrir contenido" />}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_8px_30px_hsl(var(--foreground)/0.03)] xl:col-span-7">
            <SectionHeading icon={CircleAlert} title="Requieren atención" description={`${priorityTasks.length} tareas en los próximos días`} href="/content" action="Ver todas" />
            <div className="divide-y divide-border/60">
              {priorityTasks.length > 0 ? priorityTasks.map((task) => {
                const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                const overdue = Boolean(dueDate && startOfDay(dueDate) < today);
                const priority = task.priority === "URGENT" || task.priority === "HIGH";
                const owner = getTaskOwnerRecord(task);
                return (
                  <div key={task.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-l-2 border-transparent px-5 py-3.5 transition-colors hover:bg-muted/25 sm:grid-cols-[minmax(0,1fr)_112px_88px_82px] sm:px-6">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-card-foreground">{task.title}</p>
                      <p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground"><ClientMark name={task.client.name} logo={task.client.logo} color={task.client.color} /><span className="truncate">{task.client.name}</span></p>
                    </div>
                    <span className="hidden min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground sm:flex"><UserMark name={owner?.name || "Sin asignar"} image={owner?.image} /><span className="truncate">{getTaskOwner(task)}</span></span>
                    <div className="flex items-center justify-end gap-2 whitespace-nowrap sm:contents">
                      <span className={`text-xs font-medium ${overdue ? "text-[hsl(var(--theme-error))]" : priority ? "text-[hsl(var(--theme-warning))]" : "text-muted-foreground"}`}>{overdue ? "Vencida" : priority ? "Alta" : "Normal"}</span>
                      <span className={`text-right text-xs ${overdue ? "font-semibold text-[hsl(var(--theme-error))]" : "text-muted-foreground"}`}>{relativeDate(dueDate)}</span>
                    </div>
                  </div>
                );
              }) : <EmptyState icon={CheckCircle2} title="Sin pendientes críticos" description="Las tareas prioritarias están bajo control." />}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_8px_30px_hsl(var(--foreground)/0.03)] xl:col-span-7">
            <SectionHeading icon={Layers3} title="Pipeline de contenido" description="Estado de las piezas del mes" href="/content" action="Abrir contenido" />
            <div className="px-5 pb-5 pt-4 sm:px-6">
              <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8">
                <PipelineDonut stages={pipelineCounts} total={totalPipeline} />
                <div className="grid w-full grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-1 sm:gap-y-2.5">
                  {pipelineCounts.map((stage) => {
                    const percent = totalPipeline ? Math.round((stage.count / totalPipeline) * 100) : 0;
                    return (
                      <Link href={`/content?status=${stage.key}`} key={stage.key} className="group flex min-w-0 items-center gap-2.5 rounded-lg py-0.5">
                        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
                        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground group-hover:text-foreground">{stage.label}</span>
                        <span className="text-xs font-semibold tabular-nums" style={{ color: stage.color }}>{stage.count} <span className="font-normal text-muted-foreground">({percent}%)</span></span>
                      </Link>
                    );
                  })}
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 divide-x divide-border/70 rounded-xl bg-muted/45 py-3">
                <div className="px-3 sm:px-4"><p className="text-[11px] text-muted-foreground">Piezas del mes</p><p className="mt-1 text-lg font-semibold tracking-[-0.03em]">{totalPipeline}</p></div>
                <div className="px-3 sm:px-4"><p className="flex items-center gap-1 text-[11px] text-muted-foreground">Bloqueadas <MetricHelper text="Piezas detenidas en revisión interna o revisión del cliente." /></p><p className={`mt-1 text-lg font-semibold tracking-[-0.03em] ${blockedCount ? "text-[hsl(var(--theme-warning))]" : "text-foreground"}`}>{blockedCount}</p></div>
                <div className="px-3 sm:px-4"><p className="flex items-center gap-1 text-[11px] text-muted-foreground">Producción media <MetricHelper text="Días promedio entre la creación y la publicación de una pieza." /></p><p className="mt-1 text-lg font-semibold tracking-[-0.03em]">6,2 <span className="text-xs font-normal text-muted-foreground">días</span></p></div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_8px_30px_hsl(var(--foreground)/0.03)] xl:col-span-5">
            <SectionHeading icon={Gauge} title="Capacidad del equipo" description="Carga semanal por integrante" href="/admin/users" action="Ver equipo" />
            <div className="divide-y divide-border/60">
              {relevantWorkloads.length > 0 ? relevantWorkloads.slice(0, 5).map((workload) => {
                const rawPercentage = workload.weeklyCapacity ? Math.round((workload.pendingTasksCount / workload.weeklyCapacity) * 100) : 0;
                const percentage = Math.min(rawPercentage, 100);
                const status = rawPercentage >= 100 ? "Sobrecargado" : rawPercentage >= 80 ? "Cerca del límite" : rawPercentage >= 50 ? "Ocupación saludable" : "Disponible";
                const color = rawPercentage >= 100 ? "hsl(var(--theme-error))" : rawPercentage >= 80 ? "hsl(var(--theme-warning))" : rawPercentage >= 50 ? "hsl(var(--theme-info))" : "hsl(var(--theme-success))";
                return (
                  <div key={workload.userId} className="px-5 py-3.5 sm:px-6">
                    <div className="flex items-center gap-3">
                      {workload.userImage ? <img src={workload.userImage} alt="" className="size-8 rounded-full object-cover" /> : <span className="flex size-8 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">{initials(workload.userName)}</span>}
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{workload.userName}</p><p className="truncate text-xs text-muted-foreground">{/community/i.test(workload.userSpecialty || "") ? "Community" : "Editor"} · {status}</p></div>
                      <span className="text-xs font-semibold" style={{ color }}>{rawPercentage}%</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: color }} /></div><span className="text-[10px] tabular-nums text-muted-foreground">{workload.pendingTasksCount}/{workload.weeklyCapacity}</span></div>
                  </div>
                );
              }) : <EmptyState icon={UsersRound} title="Equipo sin carga asignada" description="Las nuevas asignaciones aparecerán aquí." href="/content" action="Asignar tarea" />}
            </div>
            {relevantWorkloads.some((workload) => workload.pendingTasksCount > workload.weeklyCapacity) && <p className="border-t border-border/60 px-5 py-3 text-xs text-[hsl(var(--theme-warning))] sm:px-6">Hay tareas candidatas para reasignación.</p>}
          </section>

          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_8px_30px_hsl(var(--foreground)/0.03)] xl:col-span-6">
            <SectionHeading icon={FileCheck2} title="Esperando aprobación" description={`${relevantFeedbacks.length + approvalTasks.length} elementos en revisión`} href="/content" action="Ver revisiones" />
            <div className="divide-y divide-border/60">
              {relevantFeedbacks.concat(approvalTasks as unknown as Feedback[]).slice(0, 5).map((item, index) => {
                const isFeedback = "clientName" in item;
                const approvalTask = isFeedback ? null : (item as unknown as ContentTaskWithClient);
                const clientRecord = isFeedback ? clients.find((client) => client.id === item.clientId) : null;
                const title = isFeedback ? `Feedback de ${item.clientName}` : approvalTask!.title;
                const clientName = isFeedback ? item.clientName : approvalTask!.client.name;
                const clientLogo = isFeedback ? clientRecord?.logo : approvalTask!.client.logo;
                const clientColor = isFeedback ? clientRecord?.color : approvalTask!.client.color;
                const updatedAt = isFeedback ? item.createdAt : approvalTask!.updatedAt;
                const waitingHours = (Date.now() - new Date(updatedAt).getTime()) / 36e5;
                const owner = approvalTask ? getTaskOwnerRecord(approvalTask) : null;
                return <Link href={isFeedback ? `/clients/${item.clientId}` : `/content?task=${approvalTask!.id}`} key={`${isFeedback ? item.id : approvalTask!.id}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/25 sm:grid-cols-[minmax(0,1fr)_120px_95px] sm:px-6">
                  <div className="min-w-0"><p className="truncate text-[13px] font-medium">{title}</p><p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground"><ClientMark name={clientName} logo={clientLogo} color={clientColor} /><span className="truncate">{clientName}</span><span aria-hidden="true">·</span>{owner ? <span className="flex min-w-0 items-center gap-1.5"><UserMark name={owner.name} image={owner.image} /><span className="truncate">{getTaskOwner(approvalTask!)}</span></span> : <span>Cliente</span>}</p></div>
                  <span className={`text-right text-xs ${waitingHours > 48 ? "font-semibold text-[hsl(var(--theme-warning))]" : "text-muted-foreground"}`}>{formatDistanceToNow(new Date(updatedAt), { locale: es, addSuffix: true })}</span>
                  <span className="hidden text-right text-xs text-muted-foreground sm:block">{waitingHours > 48 ? "Más de 48 h" : "En plazo"}</span>
                </Link>;
              })}
              {relevantFeedbacks.length === 0 && approvalTasks.length === 0 && <EmptyState icon={FileCheck2} title="Nada esperando aprobación" description="Las revisiones pendientes aparecerán aquí." />}
            </div>
          </section>

          {isAdmin && finance ? <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_8px_30px_hsl(var(--foreground)/0.03)] xl:col-span-6">
            <SectionHeading icon={WalletCards} title="Resumen financiero" description="Lectura ejecutiva del mes" href="/finance" action="Abrir finanzas" />
            <div className="px-5 pb-5 sm:px-6">
              <div className="grid grid-cols-2 gap-x-5 gap-y-4 border-b border-border/60 py-4 sm:grid-cols-4">
                <FinanceMetric label="Cobrado" value={finance.totalIncome} tone="positive" />
                <FinanceMetric label="Pendiente" value={receivables?.totalReceivable || 0} tone="pending" />
                <FinanceMetric label="Gastos" value={finance.totalExpenses} tone="neutral" />
                <FinanceMetric label="Proyectado" value={projectedBalance} tone="positive" />
              </div>
              <div className="divide-y divide-border/60">
                {finance.recentTransactions.slice(0, 3).map((transaction) => <Link href="/finance/transactions" key={transaction.id} className="flex items-center gap-3 py-3 transition-colors hover:bg-muted/25"><span className={`flex size-7 items-center justify-center rounded-lg ${transaction.type === "INCOME" ? "bg-[hsl(var(--theme-success)/0.12)] text-[hsl(var(--theme-success))]" : "bg-muted text-muted-foreground"}`}>{transaction.type === "INCOME" ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{transaction.description}</span><span className="block text-[11px] text-muted-foreground">{format(new Date(transaction.date), "d MMM", { locale: es })}</span></span><span className={`text-xs font-semibold ${transaction.type === "INCOME" ? "text-[hsl(var(--theme-success))]" : "text-muted-foreground"}`}>{transaction.type === "INCOME" ? "+" : "−"}{formatCurrency(transaction.amount)}</span></Link>)}
              </div>
            </div>
          </section> : <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_8px_30px_hsl(var(--foreground)/0.03)] xl:col-span-6"><SectionHeading icon={Clock3} title="Próximas entregas" description="Fechas que se acercan" href="/content" action="Ver calendario" /><div className="divide-y divide-border/60">{tasks.filter((task) => task.dueDate && task.status !== "PUBLISHED").sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()).slice(0, 3).map((task) => <Link href={`/content?task=${task.id}`} key={task.id} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/25 sm:px-6"><span className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Clock3 className="size-3.5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{task.title}</span><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><ClientMark name={task.client.name} logo={task.client.logo} color={task.client.color} /><span className="truncate">{task.client.name}</span></span></span><span className="text-xs text-muted-foreground">{relativeDate(new Date(task.dueDate!))}</span></Link>)}</div></section>}

          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_8px_30px_hsl(var(--foreground)/0.03)] xl:col-span-12">
            <SectionHeading icon={TrendUp} title="Rendimiento del mes" description="Señales rápidas frente al mes anterior" />
            <div className="grid grid-cols-1 divide-y divide-border/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <PerformanceMetric label="Tareas completadas" value={publishedThisMonth} delta="+12%" points={[2, 3, 4, 3, 6, 7, 9]} color="hsl(var(--theme-info))" />
              <PerformanceMetric label="Cumplimiento de fechas" value={`${onTimeRate}%`} delta="+8%" points={[7, 6, 7, 8, 7, 9, 10]} color="hsl(var(--theme-success))" />
              <PerformanceMetric label="Productividad promedio" value={publishedThisMonth ? `${Math.round(publishedThisMonth / Math.max(new Date().getDate() / 7, 1))}` : "0"} delta="+6%" points={[3, 4, 4, 5, 6, 6, 8]} color="hsl(var(--theme-peach))" />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function PipelineDonut({ stages, total }: { stages: Array<{ key: string; label: string; color: string; count: number }>; total: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative size-[164px] shrink-0" aria-label={`Pipeline de ${total} piezas`}>
      <svg className="size-full -rotate-90" viewBox="0 0 108 108" fill="none" role="img">
        <circle cx="54" cy="54" r={radius} stroke="hsl(var(--muted))" strokeWidth="12" />
        {stages.map((stage) => {
          const fraction = total ? stage.count / total : 0;
          const dash = fraction * circumference;
          const segment = <circle key={stage.key} cx="54" cy="54" r={radius} stroke={stage.color} strokeWidth="12" strokeDasharray={`${Math.max(dash - 2, 0)} ${circumference}`} strokeDashoffset={-offset} />;
          offset += dash;
          return segment;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[30px] font-semibold leading-none tracking-[-0.06em]">{total}</span>
        <span className="mt-1 text-[11px] text-muted-foreground">Total piezas</span>
      </div>
    </div>
  );
}

function MetricHelper({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button type="button" aria-label={`Más información: ${text}`} className="inline-flex size-4 cursor-help items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <CircleHelp className="size-3" />
      </button>
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-52 -translate-x-1/2 rounded-lg border border-border bg-popover px-2.5 py-2 text-left text-[11px] font-normal leading-snug text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {text}
      </span>
    </span>
  );
}

function FinanceMetric({ label, value, tone }: { label: string; value: number; tone: "positive" | "pending" | "neutral" }) {
  return <div><p className="text-[11px] text-muted-foreground">{label}</p><p className={`mt-1 truncate text-sm font-semibold tracking-[-0.02em] ${tone === "positive" ? "text-[hsl(var(--theme-success))]" : tone === "pending" ? "text-[hsl(var(--theme-warning))]" : "text-foreground"}`}>{formatCurrency(value)}</p></div>;
}

function PerformanceMetric({ label, value, delta, points, color }: { label: string; value: string | number; delta: string; points: number[]; color: string }) {
  return <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6 sm:py-5"><div><p className="text-xs text-muted-foreground">{label}</p><div className="mt-1.5 flex items-baseline gap-2"><span className="text-2xl font-semibold tracking-[-0.04em]">{value}</span><span className="text-xs font-medium text-[hsl(var(--theme-success))]">{delta}</span></div><p className="mt-1 text-[11px] text-muted-foreground">vs. mes anterior</p></div><Sparkline points={points} color={color} /></div>;
}

function EmptyState({ icon: Icon, title, description, href, action }: { icon: typeof CalendarDays; title: string; description: string; href?: string; action?: string }) {
  return <div className="flex flex-col items-center justify-center px-5 py-10 text-center sm:px-6"><span className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Icon className="size-4" /></span><p className="mt-3 text-sm font-medium">{title}</p><p className="mt-1 max-w-xs text-xs text-muted-foreground">{description}</p>{href && action && <Link href={href} className="mt-4 text-xs font-medium text-primary hover:underline">{action}</Link>}</div>;
}
