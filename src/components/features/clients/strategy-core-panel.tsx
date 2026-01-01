"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, Share2, Zap, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

interface StrategyCorePanelProps {
  totalImpressions: number;
  totalCommunityGrowth: number;
  globalVirality: number;
  crossPlatformEfficiency: number;
  metaMetrics: {
    totalReach: number;
    totalInteractions: number;
    averageER: number;
  };
  tiktokMetrics: {
    totalViews: number;
    totalInteractions: number;
    averageER: number;
  };
}

export function StrategyCorePanel({
  totalImpressions,
  totalCommunityGrowth,
  globalVirality,
  crossPlatformEfficiency,
  metaMetrics,
  tiktokMetrics,
}: StrategyCorePanelProps) {
  // Generar insights IA basados en los datos
  const generateInsights = (): string => {
    const hasMeta = metaMetrics.totalReach > 0 || metaMetrics.totalInteractions > 0;
    const hasTikTok = tiktokMetrics.totalViews > 0 || tiktokMetrics.totalInteractions > 0;

    if (!hasMeta && !hasTikTok) {
      return "No hay suficientes datos para generar insights. Ingresa métricas de al menos una plataforma.";
    }

    if (hasMeta && hasTikTok) {
      // Comparar ambas plataformas
      const metaER = metaMetrics.averageER;
      const ttER = tiktokMetrics.averageER;
      const metaInteractions = metaMetrics.totalInteractions;
      const ttInteractions = tiktokMetrics.totalInteractions;

      if (metaER > ttER && metaInteractions > ttInteractions) {
        return "📊 Meta (Instagram/Facebook) está generando mejor rendimiento. El contenido resuena más con la audiencia de Meta, con mayor engagement rate y más interacciones. Considera aumentar la inversión en esta plataforma.";
      } else if (ttER > metaER && ttInteractions > metaInteractions) {
        return "🎵 TikTok está superando a Meta en rendimiento. El formato de video corto está funcionando mejor en TikTok. Considera adaptar el contenido de Meta al estilo de TikTok o aumentar la presencia en esta plataforma.";
      } else if (metaER > ttER) {
        return "📈 Meta tiene mejor engagement rate, pero TikTok genera más interacciones totales. Estrategia recomendada: Optimizar contenido de Meta para aumentar volumen, y mejorar calidad en TikTok para aumentar engagement.";
      } else {
        return "🚀 TikTok tiene mejor engagement rate, pero Meta genera más interacciones. Estrategia recomendada: Aplicar técnicas de TikTok a Meta para mejorar engagement, y escalar el formato exitoso de TikTok.";
      }
    } else if (hasMeta) {
      return "📱 Solo tienes datos de Meta. El engagement rate es " + metaMetrics.averageER.toFixed(2) + "%. Considera expandir a TikTok para diversificar tu audiencia y comparar rendimiento entre plataformas.";
    } else {
      return "🎬 Solo tienes datos de TikTok. El engagement rate es " + tiktokMetrics.averageER.toFixed(2) + "%. Considera expandir a Meta (Instagram/Facebook) para alcanzar una audiencia diferente y maximizar tu presencia social.";
    }
  };

  const insights = generateInsights();

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          The Core - Estrategia Global
        </CardTitle>
        <CardDescription>
          KPIs clave y análisis estratégico cross-platform
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 4 KPIs principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Impressions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Total Impressions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatNumber(totalImpressions)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Reach Meta + Views TikTok
              </p>
            </CardContent>
          </Card>

          {/* Total Community Growth */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Community Growth
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatNumber(totalCommunityGrowth)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Likes + Comentarios promedio
              </p>
            </CardContent>
          </Card>

          {/* Global Virality */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Share2 className="h-4 w-4 text-muted-foreground" />
                Global Virality
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{globalVirality.toFixed(2)}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                Shares vs Views
              </p>
            </CardContent>
          </Card>

          {/* Cross-Platform Efficiency */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                Efficiency Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{crossPlatformEfficiency.toFixed(2)}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                ER promedio ponderado
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Insights IA */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              Insights Estratégicos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{insights}</p>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}

