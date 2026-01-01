"use client";

import { useState, useEffect } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const loadingMessages = [
  "Estructurando método PAS...",
  "Inyectando tono de marca...",
  "Aplicando framework AIDA...",
  "Creando narrativa emocional...",
  "Optimizando para redes sociales...",
  "Alineando con valores de marca...",
];

export function AiLoadingState() {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="border-dashed">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="relative">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <Sparkles className="h-4 w-4 absolute -top-1 -right-1 text-primary animate-pulse" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {loadingMessages[currentMessageIndex]}
            </p>
            <div className="flex gap-1 justify-center">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-2 w-2 rounded-full delay-75" />
              <Skeleton className="h-2 w-2 rounded-full delay-150" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

