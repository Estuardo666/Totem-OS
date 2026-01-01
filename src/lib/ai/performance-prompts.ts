export interface BrandDNA {
  businessDescription?: string;
  toneOfVoice?: string;
  audience?: string;
  values?: string;
  prohibitedTopics?: string;
}

export interface PerformanceMetrics {
  // Meta (Instagram/Facebook)
  metaMetrics: {
    totalReach: number;
    totalInteractions: number;
    averageER: number;
  };
  // TikTok
  tiktokMetrics: {
    totalViews: number;
    totalInteractions: number;
    averageER: number;
  };
  // Business Impact
  businessMetrics: {
    totalRevenue: number;
    totalConversions: number;
    totalSales: number;
    averageConversionRate: number;
    averageCPA: number;
    averageROAS: number;
  };
  // Global
  totalImpressions: number;
  totalCommunityGrowth: number;
  globalVirality: number;
  crossPlatformEfficiency: number;
}

export interface PerformanceContext {
  clientName: string;
  brandDNA: BrandDNA;
  metrics: PerformanceMetrics;
  month: string; // "Enero 2025"
}

/**
 * Construye el prompt del sistema para análisis de performance
 * Actúa como un Director de Marketing (CMO) analizando resultados
 */
export function buildPerformanceSystemPrompt(context: PerformanceContext): string {
  const { clientName, brandDNA, month } = context;

  let prompt = `Eres un Director de Marketing (CMO) experto en análisis de performance digital y estrategia de contenido para redes sociales.

Tu rol es analizar los resultados de performance del mes y proporcionar insights estratégicos, accionables y alentadores.

CONTEXTO DE LA MARCA:
- Cliente: ${clientName}
- Período analizado: ${month}
`;

  if (brandDNA.businessDescription) {
    prompt += `- Descripción del negocio: ${brandDNA.businessDescription}\n`;
  }

  if (brandDNA.audience) {
    prompt += `- Audiencia objetivo: ${brandDNA.audience}\n`;
  }

  if (brandDNA.toneOfVoice) {
    prompt += `- Tono de voz: ${brandDNA.toneOfVoice}\n`;
  }

  if (brandDNA.values) {
    prompt += `- Valores de marca: ${brandDNA.values}\n`;
  }

  prompt += `
INSTRUCCIONES CRÍTICAS PARA EL ANÁLISIS:

1. **NO repitas los números literalmente**. En lugar de decir "Tuviste 10,000 impresiones", explica QUÉ significa: "Tu contenido alcanzó a 10,000 personas potenciales, lo que representa una oportunidad significativa de conversión".

2. **Lenguaje humano y estratégico**: Escribe como un CMO hablando con el equipo/cliente. Usa un tono profesional pero cercano, alentador y orientado a resultados.

3. **Identifica la plataforma ganadora**: Compara Meta (Instagram/Facebook) vs TikTok y explica cuál funcionó mejor y POR QUÉ.

4. **3 Consejos Accionables**: Proporciona exactamente 3 recomendaciones concretas y ejecutables para el próximo mes. Cada consejo debe ser específico, medible y alineado con los objetivos de la marca.

5. **Estructura del análisis**:
   - Comienza con un resumen ejecutivo (2-3 líneas) destacando el logro principal del mes.
   - Analiza el rendimiento por plataforma (Meta vs TikTok).
   - Destaca métricas de negocio (conversiones, ventas, ROAS) y su impacto real.
   - Identifica oportunidades de mejora.
   - Concluye con los 3 consejos accionables para el próximo mes.

6. **Formato**: Usa markdown para estructurar el texto (## para títulos, ** para énfasis, listas con -). El texto debe ser fluido y fácil de leer.

7. **Longitud**: El análisis debe tener entre 300-500 palabras. Suficiente para ser completo pero conciso.

IMPORTANTE: Responde ÚNICAMENTE con el análisis. No incluyas explicaciones adicionales, metadatos o texto fuera del análisis solicitado.`;

  return prompt;
}

/**
 * Construye el prompt del usuario con las métricas del mes
 */
export function buildPerformanceUserPrompt(metrics: PerformanceMetrics): string {
  return `Analiza los siguientes datos de performance del mes:

## MÉTRICAS META (Instagram/Facebook)
- Alcance Total: ${metrics.metaMetrics.totalReach.toLocaleString()} personas
- Interacciones Totales: ${metrics.metaMetrics.totalInteractions.toLocaleString()}
- Engagement Rate Promedio: ${metrics.metaMetrics.averageER.toFixed(2)}%

## MÉTRICAS TIKTOK
- Visualizaciones Totales: ${metrics.tiktokMetrics.totalViews.toLocaleString()}
- Interacciones Totales: ${metrics.tiktokMetrics.totalInteractions.toLocaleString()}
- Engagement Rate Promedio: ${metrics.tiktokMetrics.averageER.toFixed(2)}%

## IMPACTO EN EL NEGOCIO
- Ingresos Generados: $${metrics.businessMetrics.totalRevenue.toLocaleString()}
- Conversiones Totales: ${metrics.businessMetrics.totalConversions.toLocaleString()}
- Ventas Realizadas: ${metrics.businessMetrics.totalSales.toLocaleString()}
- Tasa de Conversión Promedio: ${metrics.businessMetrics.averageConversionRate.toFixed(2)}%
- Costo por Adquisición (CPA): $${metrics.businessMetrics.averageCPA.toFixed(2)}
- Retorno de Inversión Publicitaria (ROAS): ${metrics.businessMetrics.averageROAS.toFixed(2)}x

## MÉTRICAS GLOBALES
- Impresiones Totales: ${metrics.totalImpressions.toLocaleString()}
- Crecimiento de Comunidad: ${metrics.totalCommunityGrowth.toLocaleString()} nuevos seguidores
- Índice de Viralidad Global: ${metrics.globalVirality.toFixed(2)}%
- Eficiencia Cross-Platform: ${metrics.crossPlatformEfficiency.toFixed(2)}%

Analiza estos datos y proporciona el análisis estratégico solicitado.`;
}

