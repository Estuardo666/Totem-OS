/**
 * Wrappers lazy para diálogos pesados de Shoots
 * Mejora performance al no cargar estos componentes hasta que se necesiten
 */

import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load de diálogos pesados
const LazyShootingForm = lazy(() =>
  import("./shooting-form").then((m) => ({ default: m.ShootingForm }))
);

const LazyShootingDetail = lazy(() =>
  import("./shooting-detail").then((m) => ({ default: m.ShootingDetail }))
);

// Fallback skeleton para formularios
const FormSkeletonFallback = () => (
  <div className="space-y-4 p-6">
    <Skeleton className="h-10 w-3/4" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-20 w-full" />
  </div>
);

interface LazyShootingFormWrapperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shooting?: any;
  clients: any[];
  onCreated?: (shooting: any) => void;
  prefilledDate?: Date;
  prefilledStartTime?: string;
  prefilledEndTime?: string;
}

/**
 * Wrapper lazy para ShootingForm
 * Se carga solo cuando el diálogo se abre
 */
export function LazyShootingFormWrapper({
  open,
  onOpenChange,
  shooting,
  clients,
  onCreated,
  prefilledDate,
  prefilledStartTime,
  prefilledEndTime,
}: LazyShootingFormWrapperProps) {
  if (!open) return null;

  return (
    <Suspense fallback={<FormSkeletonFallback />}>
      <LazyShootingForm
        open={open}
        onOpenChange={onOpenChange}
        shooting={shooting}
        clients={clients}
        onCreated={onCreated}
        initialDate={prefilledDate}
        initialStartTime={prefilledStartTime}
        initialEndTime={prefilledEndTime}
      />
    </Suspense>
  );
}

interface LazyShootingDetailWrapperProps {
  shooting: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onCancel?: () => void;
}

/**
 * Wrapper lazy para ShootingDetail
 * Se carga solo cuando se selecciona un rodaje
 */
export function LazyShootingDetailWrapper({
  shooting,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onCancel,
}: LazyShootingDetailWrapperProps) {
  if (!open || !shooting) return null;

  return (
    <Suspense fallback={<FormSkeletonFallback />}>
      <LazyShootingDetail
        shooting={shooting}
        open={open}
        onOpenChange={onOpenChange}
        onEdit={onEdit || (() => {})}
        onDelete={onDelete || (() => {})}
        onCancel={onCancel || (() => {})}
      />
    </Suspense>
  );
}
