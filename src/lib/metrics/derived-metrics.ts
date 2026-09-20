/**
 * Métricas que Meta no entrega y hay que calcular.
 *
 * Funciones puras, sin base de datos, para poder probarlas con el harness de
 * `node --test`. Dos reglas gobiernan todo el archivo:
 *
 * 1. Nunca se devuelve `Infinity` ni `NaN`: cuando el denominador es cero la
 *    respuesta es `null`, y la interfaz muestra "—". Un 0% y un "no se puede
 *    calcular" significan cosas distintas para el cliente.
 * 2. Los ratios se derivan de numeradores y denominadores ya sumados, nunca
 *    promediando ratios diarios: un día con 10 visualizaciones no puede pesar
 *    lo mismo que uno con 10.000.
 */

import { ratio } from "../reports/social-report-math.ts";

/** Porcentaje protegido: `part / whole * 100`, o null si no hay base. */
export function percentage(part: number, whole: number): number | null {
  const value = ratio(part, whole);
  return value === null ? null : value * 100;
}

/**
 * Engagement rate sobre alcance: qué porcentaje de las personas alcanzadas
 * interactuó. Es el ER que usan las agencias para comparar contenido.
 */
export function engagementRateByReach(interactions: number, reach: number): number | null {
  return percentage(interactions, reach);
}

/**
 * Engagement rate sobre seguidores: qué tan activa es la comunidad propia.
 * Se separa del anterior porque responden preguntas distintas — uno mide el
 * contenido, el otro la audiencia.
 */
export function engagementRateByFollowers(
  interactions: number,
  followers: number
): number | null {
  return percentage(interactions, followers);
}

/** Crecimiento porcentual de la comunidad entre el inicio y el fin del período. */
export function communityGrowthRate(
  followersEnd: number,
  followersStart: number
): number | null {
  return percentage(followersEnd - followersStart, followersStart);
}

/** Seguidores netos: altas menos bajas. Siempre calculable. */
export function netFollowers(gained: number, lost: number): number {
  return gained - lost;
}

/**
 * Retención de seguidores: qué proporción de las altas sobrevive a las bajas.
 * Puede ser negativa cuando se pierde más de lo que se gana, y eso es
 * información, no un error.
 */
export function followerRetentionRate(gained: number, lost: number): number | null {
  return percentage(gained - lost, gained);
}

/** Índice de viralidad: compartidos sobre alcance. */
export function viralityIndex(shares: number, reach: number): number | null {
  return percentage(shares, reach);
}

/** Tasa de guardado: guardados sobre alcance. Señal de contenido de valor. */
export function saveRate(saves: number, reach: number): number | null {
  return percentage(saves, reach);
}

/**
 * Conversión de perfil: de quienes visitaron el perfil, cuántos hicieron clic
 * hacia afuera (web, WhatsApp, enlace en bio).
 */
export function profileConversionRate(
  linkClicks: number,
  profileViews: number
): number | null {
  return percentage(linkClicks, profileViews);
}

/** Alcance medio por publicación del período. */
export function reachPerPost(reach: number, posts: number): number | null {
  return ratio(reach, posts);
}

/** Interacciones medias por publicación del período. */
export function interactionsPerPost(interactions: number, posts: number): number | null {
  return ratio(interactions, posts);
}

/**
 * Consistencia de publicación: porcentaje de días del período con al menos una
 * publicación. Mide el hábito, no el volumen — publicar cinco piezas el mismo
 * día no es lo mismo que publicar cinco días seguidos.
 */
export function publishingConsistency(
  daysWithPosts: number,
  totalDays: number
): number | null {
  return percentage(daysWithPosts, totalDays);
}

/**
 * Costo por interacción orgánica.
 *
 * La tarifa mensual se prorratea a los días del período: comparar el fee de un
 * mes contra las interacciones de 7 días daría un costo cuatro veces mayor que
 * el real.
 */
export function costPerInteraction(
  monthlyRate: number,
  interactions: number,
  periodDays: number
): number | null {
  const prorated = proratedFee(monthlyRate, periodDays);
  return ratio(prorated, interactions);
}

/** Tarifa mensual prorrateada a los días del período (mes de 30 días). */
export function proratedFee(monthlyRate: number, periodDays: number): number {
  if (!Number.isFinite(monthlyRate) || monthlyRate <= 0) return 0;
  if (!Number.isFinite(periodDays) || periodDays <= 0) return 0;
  return (monthlyRate / 30) * periodDays;
}

/**
 * Porcentaje del alcance total que proviene de contenido orgánico.
 *
 * El alcance pagado llega de la cuenta publicitaria y el orgánico de los
 * insights de página; son fuentes distintas y pueden solaparse en personas
 * reales, así que esto es una proporción de volumen, no de público único.
 */
export function organicShare(organicReach: number, paidReach: number): number | null {
  return percentage(organicReach, organicReach + paidReach);
}

/**
 * Saturación publicitaria: cuántas veces vio el anuncio, de media, cada
 * persona alcanzada. Por encima de ~3 suele indicar desgaste del creativo.
 */
export function adSaturation(impressions: number, reach: number): number | null {
  return ratio(impressions, reach);
}

/**
 * Costo total por resultado: inversión publicitaria más el fee prorrateado,
 * dividido por las conversiones. Es el número que responde "¿cuánto me costó
 * de verdad cada cliente?", que el CPA de Meta por sí solo no contesta.
 */
export function totalCostPerResult(
  adSpend: number,
  monthlyRate: number,
  conversions: number,
  periodDays: number
): number | null {
  return ratio(adSpend + proratedFee(monthlyRate, periodDays), conversions);
}

/**
 * Proyección lineal a fin de mes de un acumulado parcial.
 *
 * Deliberadamente simple: extrapola el ritmo diario observado. Devuelve null
 * si el mes ya terminó o no hay días transcurridos, porque entonces no hay
 * nada que proyectar — el dato real ya está.
 */
export function projectToMonthEnd(
  accumulated: number,
  daysElapsed: number,
  daysInMonth: number
): number | null {
  if (!Number.isFinite(accumulated)) return null;
  if (daysElapsed <= 0 || daysInMonth <= 0) return null;
  if (daysElapsed >= daysInMonth) return null;
  return (accumulated / daysElapsed) * daysInMonth;
}

export interface HealthScoreInput {
  /** ER sobre alcance, en porcentaje. */
  engagementRate: number | null;
  /** Crecimiento de comunidad, en porcentaje. */
  growthRate: number | null;
  /** Consistencia de publicación, en porcentaje. */
  consistency: number | null;
  /** Variación de alcance frente al período anterior, en porcentaje. */
  reachTrend: number | null;
}

/**
 * Score de salud de la cuenta, de 0 a 100.
 *
 * Es un resumen ponderado, no una medida de la industria: sirve para ordenar
 * clientes entre sí y para ver si una cuenta mejora o empeora, no para
 * compararse con terceros. Los topes de normalización se eligieron sobre
 * valores habituales en cuentas pequeñas (ER 5%, crecimiento 10%).
 *
 * Los componentes sin dato no cuentan ni a favor ni en contra: se reparte su
 * peso entre los presentes. Con ninguno disponible devuelve null en vez de
 * fabricar un 0 que parecería un mal desempeño.
 */
export function healthScore(input: HealthScoreInput): number | null {
  const components: Array<{ value: number; weight: number }> = [];

  const normalize = (value: number, cap: number) => Math.max(0, Math.min(1, value / cap));

  if (input.engagementRate !== null) {
    components.push({ value: normalize(input.engagementRate, 5), weight: 0.35 });
  }
  if (input.growthRate !== null) {
    // El crecimiento negativo hunde el componente, no lo deja en cero neutro.
    components.push({ value: normalize(input.growthRate + 2, 12), weight: 0.2 });
  }
  if (input.consistency !== null) {
    components.push({ value: normalize(input.consistency, 100), weight: 0.25 });
  }
  if (input.reachTrend !== null) {
    components.push({ value: normalize(input.reachTrend + 20, 60), weight: 0.2 });
  }

  if (components.length === 0) return null;

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const weighted = components.reduce((sum, c) => sum + c.value * c.weight, 0);

  return Math.round((weighted / totalWeight) * 100);
}

/** Etiqueta del score, para no dejar un número suelto sin lectura. */
export function healthLabel(score: number | null): string {
  if (score === null) return "Sin datos suficientes";
  if (score >= 75) return "Saludable";
  if (score >= 50) return "Estable";
  if (score >= 25) return "Necesita atención";
  return "Crítico";
}
