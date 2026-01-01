"use client";

import { useState, useTransition } from "react";
import React from "react";
import { generateClientPerformanceOverview } from "@/actions/metrics-actions";
import { AiOverviewSkeleton } from "./ai-overview-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Simple markdown renderer sin dependencias externas
function renderMarkdown(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentParagraph: string[] = [];
  let listItems: string[] = [];
  let listKey = 0;

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const paragraphText = currentParagraph.join(' ');
      // Procesar negritas
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      const boldRegex = /\*\*(.*?)\*\*/g;
      let match;
      
      while ((match = boldRegex.exec(paragraphText)) !== null) {
        if (match.index > lastIndex) {
          parts.push(paragraphText.substring(lastIndex, match.index));
        }
        parts.push(
          <strong key={`bold-${match.index}`} className="font-semibold text-foreground">
            {match[1]}
          </strong>
        );
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < paragraphText.length) {
        parts.push(paragraphText.substring(lastIndex));
      }
      
      elements.push(
        <p key={`p-${elements.length}`} className="text-sm leading-relaxed mb-3 text-muted-foreground">
          {parts.length > 0 ? parts : paragraphText}
        </p>
      );
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${listKey++}`} className="list-disc list-inside space-y-1 mb-3 text-sm text-muted-foreground">
          {listItems.map((item, idx) => {
            const parts: React.ReactNode[] = [];
            let lastIndex = 0;
            const boldRegex = /\*\*(.*?)\*\*/g;
            let match;
            
            while ((match = boldRegex.exec(item)) !== null) {
              if (match.index > lastIndex) {
                parts.push(item.substring(lastIndex, match.index));
              }
              parts.push(
                <strong key={`bold-${match.index}`} className="font-semibold text-foreground">
                  {match[1]}
                </strong>
              );
              lastIndex = match.index + match[0].length;
            }
            if (lastIndex < item.length) {
              parts.push(item.substring(lastIndex));
            }
            
            return (
              <li key={`li-${idx}`} className="ml-4">
                {parts.length > 0 ? parts : item}
              </li>
            );
          })}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('## ')) {
      flushList();
      flushParagraph();
      elements.push(
        <h2 key={`h2-${index}`} className="text-lg font-semibold mt-4 mb-2 text-foreground">
          {trimmed.substring(3)}
        </h2>
      );
      return;
    }
    
    if (trimmed.startsWith('### ')) {
      flushList();
      flushParagraph();
      elements.push(
        <h3 key={`h3-${index}`} className="text-base font-semibold mt-3 mb-2 text-foreground">
          {trimmed.substring(4)}
        </h3>
      );
      return;
    }
    
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushParagraph();
      listItems.push(trimmed.substring(2));
      return;
    }
    
    if (trimmed === '' && listItems.length > 0) {
      flushList();
      return;
    }
    
    if (trimmed !== '') {
      if (listItems.length > 0) {
        flushList();
      }
      currentParagraph.push(trimmed);
    } else {
      flushParagraph();
    }
  });
  
  flushList();
  flushParagraph();
  
  return elements;
}

interface AiOverviewCardProps {
  clientId: string;
  initialOverview?: string | null;
  initialOverviewDate?: Date | null;
  userRole?: "ADMIN" | "EDITOR" | "VIEWER";
}

export function AiOverviewCard({
  clientId,
  initialOverview,
  initialOverviewDate,
  userRole,
}: AiOverviewCardProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [overview, setOverview] = useState<string | null>(initialOverview || null);
  const [overviewDate, setOverviewDate] = useState<Date | null>(
    initialOverviewDate ? new Date(initialOverviewDate) : null
  );
  const [isGenerating, setIsGenerating] = useState(false);

  const canGenerate = userRole === "ADMIN" || userRole === "EDITOR";

  const handleGenerate = () => {
    if (!canGenerate) {
      toast({
        variant: "destructive",
        title: "No autorizado",
        description: "Solo ADMIN y EDITOR pueden generar análisis de IA.",
      });
      return;
    }

    setIsGenerating(true);
    startTransition(async () => {
      try {
        const result = await generateClientPerformanceOverview(clientId);
        if (result.success && result.data) {
          setOverview(result.data.overview);
          setOverviewDate(result.data.generatedAt);
          toast({
            title: "Análisis generado",
            description: "El análisis de performance ha sido generado exitosamente.",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: result.error || "Error al generar el análisis de performance.",
          });
        }
      } catch (error) {
        console.error("Error al generar análisis:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Error inesperado al generar el análisis.",
        });
      } finally {
        setIsGenerating(false);
      }
    });
  };

  const isLoading = isPending || isGenerating;

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5 relative overflow-hidden">
      {/* Efecto de borde animado */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 animate-pulse"></div>
      
      <CardHeader className="relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Análisis de Performance con IA
            </CardTitle>
            <CardDescription className="mt-1">
              {overviewDate
                ? `Análisis generado el ${format(overviewDate, "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}`
                : "Análisis estratégico de métricas del mes"}
            </CardDescription>
          </div>
          {canGenerate && (
            <Button
              onClick={handleGenerate}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="shrink-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generar Análisis
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative z-10">
        {isLoading ? (
          <AiOverviewSkeleton />
        ) : overview ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {renderMarkdown(overview)}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">
              {canGenerate
                ? "Haz clic en 'Generar Análisis' para obtener un análisis estratégico de las métricas del mes."
                : "No hay análisis disponible. Contacta a un administrador para generar uno."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

