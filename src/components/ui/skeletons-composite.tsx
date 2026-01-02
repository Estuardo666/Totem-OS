import { Skeleton } from "./skeleton";

/**
 * Skeleton para tablas
 * Renderiza un encabezado y 5 filas vacías
 */
export function TableSkeleton() {
  return (
    <div className="w-full space-y-4">
      {/* Encabezado */}
      <div className="flex h-10 items-center rounded-md border bg-muted/50 px-4">
        <Skeleton className="h-4 w-24" />
      </div>
      
      {/* Filas */}
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex h-12 items-center rounded-md border bg-muted/30 px-4">
            <Skeleton className="h-4 w-32 mr-4" />
            <Skeleton className="h-4 w-48 mr-4" />
            <Skeleton className="h-4 w-20 mr-4" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton para tarjetas con imagen y texto
 * Renderiza un rectángulo de imagen y 3 líneas de texto
 */
export function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Imagen */}
      <Skeleton className="h-48 w-full rounded-t-lg" />
      
      {/* Contenido */}
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}

/**
 * Skeleton para métricas/KPIs
 * Cuadro pequeño para dashboard
 */
export function MetricSkeleton() {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4">
      <div className="flex flex-col space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

/**
 * Skeleton para encabezado de página
 * Título grande y subtítulo
 */
export function PageHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-4 w-96" />
    </div>
  );
}

/**
 * Skeleton para formulario simple
 * Renderiza 3 campos de texto
 */
export function FormSkeleton() {
  return (
    <div className="space-y-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-32 rounded-lg" />
    </div>
  );
}

/**
 * Skeleton para lista de items
 * Renderiza 6 items simples
 */
export function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center space-x-4 rounded-md border p-4 bg-muted/30">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton para dashboard completo
 * Grid de métricas y gráficos
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Fila de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
      </div>
      
      {/* Fila de contenido */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border bg-card p-4">
          <Skeleton className="h-6 w-40 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <Skeleton className="h-6 w-40 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}

