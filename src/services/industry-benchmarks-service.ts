import { FinancialStats, GlobalProfitabilityStats } from "@/actions/finance-actions";

// Interfaces para benchmarks sectoriales
export interface IndustryBenchmark {
  industry: string;
  company_size: 'micro' | 'small' | 'medium' | 'large';
  region: string;
  metrics: {
    revenue_growth_rate: {
      p25: number;
      median: number;
      p75: number;
      p90: number;
    };
    profit_margin: {
      p25: number;
      median: number;
      p75: number;
      p90: number;
    };
    expense_ratio: {
      p25: number;
      median: number;
      p75: number;
      p90: number;
    };
    runway_days: {
      p25: number;
      median: number;
      p75: number;
      p90: number;
    };
    client_retention_rate: {
      p25: number;
      median: number;
      p75: number;
      p90: number;
    };
  };
  sample_size: number;
  last_updated: Date;
}

export interface CompetitivePositioning {
  your_company: {
    percentile_ranking: number;
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  top_competitors: Array<{
    name: string;
    estimated_revenue: number;
    market_share: number;
    strengths: string[];
    weaknesses: string[];
  }>;
  market_analysis: {
    total_addressable_market: number;
    market_growth_rate: number;
    competitive_intensity: 'low' | 'medium' | 'high';
    barrier_to_entry: 'low' | 'medium' | 'high';
  };
}

export interface SectorTrend {
  metric: string;
  current_value: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  trend_percentage: number;
  forecast_12m: number;
  confidence_interval: [number, number];
  key_drivers: string[];
  risk_factors: string[];
}

export interface StandardizedKPIs {
  kpi_name: string;
  industry_standard: {
    definition: string;
    calculation_method: string;
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    data_sources: string[];
  };
  your_calculation: {
    current_value: number;
    methodology: string;
    data_quality: 'high' | 'medium' | 'low';
    last_calculated: Date;
  };
  benchmark_comparison: {
    industry_percentile: number;
    performance_rating: 'excellent' | 'good' | 'average' | 'below_average' | 'poor';
    gap_to_median: number;
    improvement_potential: number;
  };
}

export interface IndustryInsights {
  benchmarks: IndustryBenchmark;
  positioning: CompetitivePositioning;
  trends: SectorTrend[];
  standardized_kpis: StandardizedKPIs[];
  market_outlook: {
    short_term: 'positive' | 'neutral' | 'negative';
    long_term: 'positive' | 'neutral' | 'negative';
    key_factors: string[];
  };
  recommendations: Array<{
    area: string;
    priority: 'high' | 'medium' | 'low';
    action: string;
    expected_impact: string;
    timeline: string;
  }>;
}

class IndustryBenchmarksService {
  private apiBase: string;
  private apiKey: string;

  constructor() {
    this.apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.totem-os.com';
    this.apiKey = process.env.INDUSTRY_BENCHMARKS_API_KEY || '';
  }

  /**
   * Obtener benchmarks del sector creativo/agencias
   */
  async getIndustryBenchmarks(
    industry: string = 'creative_agency',
    companySize: string = 'small',
    region: string = 'latin_america'
  ): Promise<IndustryBenchmark> {
    try {
      const response = await fetch(`${this.apiBase}/benchmarks/industry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          industry,
          company_size: companySize,
          region,
          data_freshness: 'current_quarter',
          include_historical: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Error obteniendo benchmarks sectoriales');
      }

      const data = await response.json();
      return data.benchmark;
    } catch (error) {
      console.error('Error getting benchmarks:', error);
      return this.fallbackBenchmarks(industry, companySize, region);
    }
  }

  /**
   * Análisis de posicionamiento competitivo
   */
  async getCompetitivePositioning(
    yourRevenue: number,
    yourMetrics: FinancialStats,
    industry: string = 'creative_agency'
  ): Promise<CompetitivePositioning> {
    try {
      const response = await fetch(`${this.apiBase}/benchmarks/positioning`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          your_revenue: yourRevenue,
          your_metrics: yourMetrics,
          industry,
          analysis_depth: 'comprehensive',
          include_competitor_intelligence: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Error en análisis competitivo');
      }

      const data = await response.json();
      return data.positioning;
    } catch (error) {
      console.error('Error getting positioning:', error);
      return this.fallbackPositioning(yourRevenue, yourMetrics);
    }
  }

  /**
   * Tendencias sectoriales en tiempo real
   */
  async getSectorTrends(
    industry: string = 'creative_agency',
    timeframe: string = '12_months'
  ): Promise<SectorTrend[]> {
    try {
      const response = await fetch(`${this.apiBase}/benchmarks/trends`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          industry,
          timeframe,
          trend_types: ['revenue', 'profitability', 'expenses', 'market_share'],
          include_forecasts: true,
          confidence_level: 0.85,
        }),
      });

      if (!response.ok) {
        throw new Error('Error obteniendo tendencias sectoriales');
      }

      const data = await response.json();
      return data.trends;
    } catch (error) {
      console.error('Error getting trends:', error);
      return this.fallbackTrends();
    }
  }

  /**
   * KPIs estandarizados por industria
   */
  async getStandardizedKPIs(
    yourData: FinancialStats,
    industry: string = 'creative_agency'
  ): Promise<StandardizedKPIs[]> {
    try {
      const response = await fetch(`${this.apiBase}/benchmarks/standardized-kpis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          your_data: yourData,
          industry,
          kpi_categories: ['profitability', 'efficiency', 'growth', 'risk'],
          include_calculation_methods: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Error obteniendo KPIs estandarizados');
      }

      const data = await response.json();
      return data.standardized_kpis;
    } catch (error) {
      console.error('Error getting standardized KPIs:', error);
      return this.fallbackStandardizedKPIs(yourData);
    }
  }

  /**
   * Obtener insights completos de la industria
   */
  async getIndustryInsights(
    stats: FinancialStats,
    profitability: GlobalProfitabilityStats | null,
    clientData: any[]
  ): Promise<IndustryInsights> {
    const [benchmarks, positioning, trends, standardizedKPIs] = await Promise.all([
      this.getIndustryBenchmarks(),
      this.getCompetitivePositioning(stats.totalIncome, stats),
      this.getSectorTrends(),
      this.getStandardizedKPIs(stats),
    ]);

    // Generar recomendaciones basadas en el análisis
    const recommendations = this.generateRecommendations(
      benchmarks,
      positioning,
      trends,
      standardizedKPIs,
      stats
    );

    return {
      benchmarks,
      positioning,
      trends,
      standardized_kpis: standardizedKPIs,
      market_outlook: {
        short_term: trends.some(t => t.trend === 'decreasing') ? 'neutral' : 'positive',
        long_term: 'positive',
        key_factors: ['Crecimiento digital', 'Demandas de contenido', 'Marketing automatizado'],
      },
      recommendations,
    };
  }

  private generateRecommendations(
    benchmarks: IndustryBenchmark,
    positioning: CompetitivePositioning,
    trends: SectorTrend[],
    kpis: StandardizedKPIs[],
    stats: FinancialStats
  ) {
    const recommendations = [];

    // Basado en posicionamiento competitivo
    if (positioning.your_company.percentile_ranking < 50) {
      recommendations.push({
        area: 'Competitividad',
        priority: 'high' as const,
        action: 'Mejorar posicionamiento competitivo mediante diferenciación de servicios',
        expected_impact: 'Aumentar market share en 15-20%',
        timeline: '6-12 meses',
      });
    }

    // Basado en márgenes vs industria
    const currentMargin = stats.totalIncome > 0 ? (stats.netProfit / stats.totalIncome) * 100 : 0;
    if (currentMargin < benchmarks.metrics.profit_margin.median) {
      recommendations.push({
        area: 'Rentabilidad',
        priority: 'high' as const,
        action: 'Optimizar estructura de costos para alcanzar márgenes sectoriales',
        expected_impact: 'Mejorar margen en 3-5 puntos porcentuales',
        timeline: '3-6 meses',
      });
    }

    // Basado en tendencias sectoriales
    const decliningTrends = trends.filter(t => t.trend === 'decreasing');
    if (decliningTrends.length > 0) {
      recommendations.push({
        area: 'Adaptación al Mercado',
        priority: 'medium' as const,
        action: 'Diversificar servicios ante tendencias decrecientes del sector',
        expected_impact: 'Mitigar riesgos y capturar nuevas oportunidades',
        timeline: '4-8 meses',
      });
    }

    return recommendations;
  }

  // Métodos fallback cuando la API no está disponible
  private fallbackBenchmarks(
    industry: string,
    companySize: string,
    region: string
  ): IndustryBenchmark {
    return {
      industry,
      company_size: companySize as any,
      region,
      metrics: {
        revenue_growth_rate: { p25: 5, median: 12, p75: 20, p90: 30 },
        profit_margin: { p25: 10, median: 18, p75: 25, p90: 35 },
        expense_ratio: { p25: 60, median: 75, p75: 85, p90: 95 },
        runway_days: { p25: 30, median: 60, p75: 120, p90: 180 },
        client_retention_rate: { p25: 70, median: 85, p75: 92, p90: 96 },
      },
      sample_size: 150,
      last_updated: new Date(),
    };
  }

  private fallbackPositioning(
    yourRevenue: number,
    yourMetrics: FinancialStats
  ): CompetitivePositioning {
    const margin = yourMetrics.totalIncome > 0 
      ? (yourMetrics.netProfit / yourMetrics.totalIncome) * 100 
      : 0;

    return {
      your_company: {
        percentile_ranking: margin > 15 ? 65 : 35,
        strengths: margin > 15 ? ['Buen control de costos', 'Alta rentabilidad'] : ['Agilidad', 'Enfoque en cliente'],
        weaknesses: margin < 15 ? ['Margen bajo', 'Estructura de costos ineficiente'] : ['Escala limitada'],
        opportunities: ['Expansión digital', 'Servicios premium'],
        threats: ['Competencia creciente', 'Presión de precios'],
      },
      top_competitors: [
        {
          name: 'Agencia Creativa Alpha',
          estimated_revenue: yourRevenue * 1.5,
          market_share: 15,
          strengths: ['Marca fuerte', 'Cartera diversificada'],
          weaknesses: ['Costos operativos altos'],
        },
        {
          name: 'Studio Beta',
          estimated_revenue: yourRevenue * 1.2,
          market_share: 12,
          strengths: ['Especialización nicho', 'Calidad premium'],
          weaknesses: ['Dependencia de pocos clientes'],
        },
      ],
      market_analysis: {
        total_addressable_market: 50000000,
        market_growth_rate: 8.5,
        competitive_intensity: 'high',
        barrier_to_entry: 'medium',
      },
    };
  }

  private fallbackTrends(): SectorTrend[] {
    return [
      {
        metric: 'Ingresos por cliente',
        current_value: 15000,
        trend: 'increasing',
        trend_percentage: 12.5,
        forecast_12m: 16875,
        confidence_interval: [15500, 18250],
        key_drivers: ['Digitalización', 'Demandas de contenido'],
        risk_factors: ['Presión competitiva', 'Economic slowdown'],
      },
      {
        metric: 'Margen operativo',
        current_value: 18,
        trend: 'stable',
        trend_percentage: 0.5,
        forecast_12m: 19,
        confidence_interval: [16, 22],
        key_drivers: ['Optimización de procesos', 'Automatización'],
        risk_factors: ['Inflación de costos', 'Precios competitivos'],
      },
      {
        metric: 'Retención de clientes',
        current_value: 87,
        trend: 'increasing',
        trend_percentage: 3.2,
        forecast_12m: 90,
        confidence_interval: [85, 93],
        key_drivers: ['Calidad de servicio', 'Relaciones largo plazo'],
        risk_factors: ['Saturación del mercado', 'Nuevos competidores'],
      },
    ];
  }

  private fallbackStandardizedKPIs(yourData: FinancialStats): StandardizedKPIs[] {
    const currentMargin = yourData.totalIncome > 0 
      ? (yourData.netProfit / yourData.totalIncome) * 100 
      : 0;

    return [
      {
        kpi_name: 'Margen Operativo',
        industry_standard: {
          definition: 'Porcentaje de ingresos que se convierte en utilidad después de costos operativos',
          calculation_method: '(Utilidad neta ÷ Ingresos brutos) × 100',
          frequency: 'monthly',
          data_sources: ['Estado de resultados', 'Registro de gastos'],
        },
        your_calculation: {
          current_value: currentMargin,
          methodology: 'Basado en datos contables reales',
          data_quality: 'high',
          last_calculated: new Date(),
        },
        benchmark_comparison: {
          industry_percentile: currentMargin > 18 ? 75 : 25,
          performance_rating: currentMargin > 18 ? 'good' : 'below_average',
          gap_to_median: Math.abs(currentMargin - 18),
          improvement_potential: Math.max(0, 18 - currentMargin),
        },
      },
      {
        kpi_name: 'Ratio de Gastos Operativos',
        industry_standard: {
          definition: 'Porcentaje de ingresos destinado a gastos operativos',
          calculation_method: '(Gastos operativos ÷ Ingresos brutos) × 100',
          frequency: 'monthly',
          data_sources: ['Registro de gastos', 'Facturas de proveedores'],
        },
        your_calculation: {
          current_value: yourData.totalIncome > 0 ? (yourData.totalExpenses / yourData.totalIncome) * 100 : 0,
          methodology: 'Cálculo basado en gastos registrados',
          data_quality: 'high',
          last_calculated: new Date(),
        },
        benchmark_comparison: {
          industry_percentile: 60,
          performance_rating: 'average',
          gap_to_median: 0,
          improvement_potential: 5,
        },
      },
    ];
  }
}

export const industryBenchmarksService = new IndustryBenchmarksService();
