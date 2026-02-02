"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export function GoogleCalendarSuccessToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const hasShownRef = useRef(false);

  useEffect(() => {
    const success = searchParams.get("success");
    if (success !== "google_calendar_connected" || hasShownRef.current) {
      return;
    }

    hasShownRef.current = true;
    toast({
      title: "Google Calendar conectado",
      description: (
        <span className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span>La integración se realizó correctamente.</span>
        </span>
      ),
    });

    router.replace("/admin/settings");
  }, [router, searchParams, toast]);

  return null;
}
