import { DashboardSkeleton } from "@/components/ui/skeletons-composite";

// Muestra el esqueleto al instante mientras el home carga sus datos en el servidor.
export default function HomeLoading() {
  return <DashboardSkeleton />;
}
