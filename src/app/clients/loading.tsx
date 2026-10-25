import { Skeleton } from "@/components/ui/skeleton";

// Mismo esqueleto que la página: encabezado, barra de filtros y tarjetas.
export default function ClientsLoading() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 pb-4 pt-4 md:pt-6">
        <Skeleton className="h-7 w-40 rounded-full" />
        <Skeleton className="mt-2 h-4 w-56 rounded-full" />
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-6 pt-4">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-10 rounded-full sm:w-72" />
          <Skeleton className="h-10 rounded-full sm:w-96" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="space-y-5 rounded-2xl bg-card p-5">
              <div className="flex items-center gap-3.5">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3 rounded-full" />
                  <Skeleton className="h-3 w-1/3 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-6 w-1/2 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
