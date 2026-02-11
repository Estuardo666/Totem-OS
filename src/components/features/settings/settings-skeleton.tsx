import { Skeleton } from "@/components/ui/skeleton";
import { Settings } from "lucide-react";

export function SettingsSkeleton() {
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Configuración</h1>
              <p className="text-xs text-muted-foreground">Personaliza tu experiencia</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* Sección: Apariencia y Preferencias */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Card Apariencia */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              </div>
              <div className="divide-y">
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-11 rounded-full" />
                </div>
                <div className="px-4 py-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                  <Skeleton className="h-32 w-full rounded-lg" />
                </div>
              </div>
              <div className="px-4 py-3 border-t bg-muted/30">
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            </div>

            {/* Card Notificaciones */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </div>
              </div>
              <div className="divide-y">
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-3 w-44" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-11 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Sección: Integraciones */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          </div>
        </section>

        {/* Sección: Identidad de Marca */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-3.5 w-3.5 rounded" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="w-full aspect-video rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
            <div className="px-4 py-3 border-t bg-muted/30">
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          </div>
        </section>

        <div className="h-8" />
      </div>
    </div>
  );
}

