"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  Target, 
  BarChart3, 
  Users, 
  Zap,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Minus
} from "lucide-react";
import { financialAIService, type AIFinancialInsights } from "@/services/financial-ai-service";
import { industryBenchmarksService, type IndustryInsights } from "@/services/industry-benchmarks-service";
import type { FinancialStats, GlobalProfitabilityStats, StrategicClientPlan } from "@/actions/finance-actions";

interface AIInsightsDashboardProps {
  stats: FinancialStats;
  profitability?: GlobalProfitabilityStats | null;
  clientPlans: StrategicClientPlan[];
  historicalData?: FinancialStats[];
}

export function AIInsightsDashboard({ 
  stats, 
  profitability, 
  clientPlans, 
  historicalData = [] 
}: AIInsightsDashboardProps) {
  const [aiInsights, setAiInsights] = useState<AIFinancialInsights | null>(null);
  const [industryInsights, setIndustryInsights] = useState<IndustryInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    loadInsights();
  }, [stats, profitability, clientPlans]);

  const loadInsights = async () => {
    setIsLoading(true);
    try {
      // Cargar insights de IA
      const aiData = await financialAIService.getFinancialInsights(
        stats,
        profitability || null,
        clientPlans,
        historicalData
      );

      // Cargar benchmarks sectoriales
      const industryData = await industryBenchmarksService.getIndustryInsights(
        stats,
        profitability || null,
        clientPlans
      );

      setAiInsights(aiData);
      setIndustryInsights(industryData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error loading insights:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTrendIcon = (trend: 'increasing' | 'decreasing' | 'stable') => {
    switch (trend) {
      case 'increasing': return <ChevronUp className="h-4 w-4 text-green-600" />;
      case 'decreasing': return <ChevronDown className="h-4 w-4 text-red-600" />;
      case 'stable': return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getSeverityColor = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
    }
  };

  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Insights de IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Benchmarks Sectoriales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-blue-600" />
            Inteligencia Financiera Avanzada
          </h2>
          <p className="text-muted-foreground">
            Insights predictivos y análisis competitivo impulsados por IA
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Actualizado {getTimeAgo(lastUpdated)}
          </Badge>
          <Button variant="outline" size="sm" onClick={loadInsights}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* AI Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-600" />
              Insights de IA
              <Badge variant="secondary" className="text-xs">
                {aiInsights?.model_accuracy ? `${Math.round(aiInsights.model_accuracy * 100)}% precisión` : '85% precisión'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Predicciones de Ingresos */}
            {aiInsights?.revenue_predictions && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Predicciones de Ingresos
                </h4>
                <div className="space-y-2">
                  {aiInsights.revenue_predictions.slice(0, 3).map((prediction, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm">{prediction.period}</span>
                      <div className="text-right">
                        <div className="font-medium">${(prediction.predicted / 1000000).toFixed(1)}M</div>
                        <div className="text-xs text-muted-foreground">
                          {Math.round(prediction.confidence * 100)}% confianza
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Anomalías Detectadas */}
            {aiInsights?.anomalies && aiInsights.anomalies.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Anomalías Detectadas
                </h4>
                <div className="space-y-2">
                  {aiInsights.anomalies.slice(0, 2).map((anomaly, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{anomaly.description}</span>
                        <Badge className={getSeverityColor(anomaly.severity)}>
                          {anomaly.severity === 'high' ? 'Alto' : anomaly.severity === 'medium' ? 'Medio' : 'Bajo'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{anomaly.recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Recomendaciones */}
            {aiInsights?.recommendations && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Recomendaciones de Optimización
                </h4>
                <div className="space-y-2">
                  {aiInsights.recommendations.slice(0, 2).map((rec, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{rec.title}</span>
                        <Badge className={getPriorityColor(rec.priority)}>
                          {rec.priority === 'high' ? 'Alta' : rec.priority === 'medium' ? 'Media' : 'Baja'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{rec.description}</p>
                      <div className="flex items-center justify-between text-xs">
                        <span>Ahorro potencial: ${(rec.potential_savings / 1000000).toFixed(1)}M</span>
                        <span>Timeline: {rec.timeline}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Industry Benchmarks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-green-600" />
              Benchmarks Sectoriales
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Posicionamiento Competitivo */}
            {industryInsights?.positioning && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Posicionamiento Competitivo
                </h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">Ranking Percentil</span>
                      <span className="font-medium">{industryInsights.positioning.your_company.percentile_ranking}%</span>
                    </div>
                    <Progress value={industryInsights.positioning.your_company.percentile_ranking} className="h-2" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="font-medium text-green-600">Fortalezas:</span>
                      <ul className="mt-1 space-y-1">
                        {industryInsights.positioning.your_company.strengths.slice(0, 2).map((strength, index) => (
                          <li key={index}>• {strength}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="font-medium text-red-600">Debilidades:</span>
                      <ul className="mt-1 space-y-1">
                        {industryInsights.positioning.your_company.weaknesses.slice(0, 2).map((weakness, index) => (
                          <li key={index}>• {weakness}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* Tendencias Sectoriales */}
            {industryInsights?.trends && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Tendencias Sectoriales
                </h4>
                <div className="space-y-2">
                  {industryInsights.trends.slice(0, 3).map((trend, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        {getTrendIcon(trend.trend)}
                        <span className="text-sm">{trend.metric}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-sm">
                          {trend.trend === 'increasing' ? '+' : trend.trend === 'decreasing' ? '-' : ''}
                          {trend.trend_percentage}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Próx. 12m: {trend.forecast_12m}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* KPIs Estandarizados */}
            {industryInsights?.standardized_kpis && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  KPIs vs Industria
                </h4>
                <div className="space-y-3">
                  {industryInsights.standardized_kpis.slice(0, 2).map((kpi, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{kpi.kpi_name}</span>
                        <Badge 
                          variant={
                            kpi.benchmark_comparison.performance_rating === 'excellent' || 
                            kpi.benchmark_comparison.performance_rating === 'good' 
                              ? 'default' 
                              : 'secondary'
                          }
                        >
                          {kpi.benchmark_comparison.performance_rating === 'excellent' ? 'Excelente' :
                           kpi.benchmark_comparison.performance_rating === 'good' ? 'Bueno' :
                           kpi.benchmark_comparison.performance_rating === 'average' ? 'Promedio' :
                           kpi.benchmark_comparison.performance_rating === 'below_average' ? 'Bajo' : 'Pobre'}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span>Tu valor:</span>
                          <span className="font-medium">{kpi.your_calculation.current_value.toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span>Percentil industria:</span>
                          <span>{kpi.benchmark_comparison.industry_percentile}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recomendaciones Estratégicas */}
      {industryInsights?.recommendations && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-600" />
              Recomendaciones Estratégicas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {industryInsights.recommendations.map((rec, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{rec.area}</span>
                    <Badge className={getPriorityColor(rec.priority)}>
                      {rec.priority === 'high' ? 'Alta' : rec.priority === 'medium' ? 'Media' : 'Baja'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{rec.action}</p>
                  <div className="space-y-1 text-xs">
                    <div><strong>Impacto esperado:</strong> {rec.expected_impact}</div>
                    <div><strong>Timeline:</strong> {rec.timeline}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return "ahora";
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)}h`;
  return `hace ${Math.floor(seconds / 86400)}d`;
}
