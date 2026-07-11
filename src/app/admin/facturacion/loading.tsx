import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeletons-composite";

export default function FacturacionLoading() {
  return (
    <div className="container mx-auto p-3">
      <div className="mb-6">
        <PageHeaderSkeleton />
      </div>

      <TableSkeleton />
    </div>
  );
}
