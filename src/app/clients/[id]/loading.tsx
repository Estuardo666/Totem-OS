import { PageHeaderSkeleton, DashboardSkeleton } from "@/components/ui/skeletons-composite";

export default function ClientDetailLoading() {
  return (
    <div className="container mx-auto p-3">
      <div className="mb-6">
        <PageHeaderSkeleton />
      </div>

      <DashboardSkeleton />
    </div>
  );
}
