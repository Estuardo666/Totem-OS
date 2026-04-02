import { ClipboardList, CheckCircle2 } from "lucide-react";
import { getCurrentMonthTaskSummary } from "@/actions/dashboard-task-actions";

export async function CurrentMonthTaskSummary() {
  const summaryResult = await getCurrentMonthTaskSummary();
  const summary = summaryResult.success
    ? summaryResult.data ?? { totalTasks: 0, publishedTasks: 0, reelsCount: 0, flyerCount: 0, publishedReelsCount: 0, publishedFlyerCount: 0, publishedStoryCount: 0 }
    : { totalTasks: 0, publishedTasks: 0, reelsCount: 0, flyerCount: 0, publishedReelsCount: 0, publishedFlyerCount: 0, publishedStoryCount: 0 };

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <ClipboardList className="h-5 w-5 text-foreground" />
        <div>
          <h2 className="font-semibold">Resumen del mes actual</h2>
          <p className="text-xs text-muted-foreground">Visibilidad rápida de producción del mes en curso</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-background p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Total tareas del mes</span>
            <ClipboardList className="h-5 w-5 text-foreground" />
          </div>
          <div className="text-4xl font-bold text-sky-600">{summary.totalTasks}</div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700 border border-sky-100">
              REELS: {summary.reelsCount}
            </span>
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-700 border border-violet-100">
              FLYER: {summary.flyerCount}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Incluye tareas programadas, con vencimiento o creadas este mes</p>
        </div>
        <div className="rounded-2xl border bg-background p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Tareas publicadas del mes</span>
            <CheckCircle2 className="h-5 w-5 text-foreground" />
          </div>
          <div className="text-4xl font-bold text-emerald-600">{summary.publishedTasks}</div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 border border-emerald-100">
              REELS: {summary.publishedReelsCount}
            </span>
            <span className="rounded-full bg-lime-50 px-2.5 py-1 text-lime-700 border border-lime-100">
              FLYERS: {summary.publishedFlyerCount}
            </span>
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-teal-700 border border-teal-100">
              STORIES: {summary.publishedStoryCount}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Total de tareas completadas y publicadas durante el mes actual</p>
        </div>
      </div>
    </div>
  );
}
