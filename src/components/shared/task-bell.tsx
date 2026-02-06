"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPendingTasksCount } from "@/actions/content-actions";

export function TaskBell() {
  const { data: session } = useSession();
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!session?.user?.id) return;

    const loadCount = async () => {
      try {
        const result = await getPendingTasksCount();
        if (result.success && typeof result.data === "number") {
          setPendingCount(result.data);
        }
      } catch (error) {
        console.error("Error al cargar tareas pendientes:", error);
      }
    };

    loadCount();
  }, [session?.user?.id]);

  if (!session?.user?.id) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      aria-label="Tareas pendientes"
      onClick={() => router.push("/content")}
    >
      <CheckSquare className="h-5 w-5" />
      {pendingCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
          {pendingCount > 9 ? "9+" : pendingCount}
        </span>
      )}
    </Button>
  );
}
