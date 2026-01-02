import { PageHeaderSkeleton, CardSkeleton } from "@/components/ui/skeletons-composite";

export default function ChronosLoading() {
  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <PageHeaderSkeleton />
      </div>

      {/* Lista de Registros de Tiempo - 3 Cards */}
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

