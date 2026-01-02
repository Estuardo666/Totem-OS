import { TableSkeleton, PageHeaderSkeleton } from "@/components/ui/skeletons-composite";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminUsersLoading() {
  return (
    <div className="container mx-auto p-6">
      {/* Header Skeleton */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="flex-1">
            <PageHeaderSkeleton />
          </div>
        </div>
      </div>

      {/* Table Card Skeleton */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuarios</CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-32 inline-block" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TableSkeleton />
        </CardContent>
      </Card>
    </div>
  );
}

