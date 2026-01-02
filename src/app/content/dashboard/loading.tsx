import { PageHeaderSkeleton, MetricSkeleton, TableSkeleton } from "@/components/ui/skeletons-composite";

export default function ContentDashboardLoading() {
  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <PageHeaderSkeleton />
      </div>

      {/* KPIs Rápidos - 3 métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
      </div>

      {/* Lista de Tareas/Contenidos */}
      <TableSkeleton />
    </div>
  );
}

