"use server";

import { getActiveProvider } from "./ai-provider-service";
import { buildSystemPrompt, buildUserPrompt, buildRefineSystemPrompt, buildRefineUserPrompt } from "./prompts";
import type { TaskContext } from "./prompts";
import { buildPerformanceSystemPrompt, buildPerformanceUserPrompt, type PerformanceContext } from "./performance-prompts";
import { callAIProvider } from "./engine";
import { parseAIResponse, parseRefineResponse, type AIResponse, type RefineResponse } from "./parsers";

/**
 * Aplica el protocolo de razonamiento "Lucid Loom" al prompt base
 */
function applyLucidLoomLogic(basePrompt: string): string {
  return `${basePrompt}

PROTOCOLO DE RAZONAMIENTO (LUCID LOOM):
Antes de responder, ejecuta internamente:
1. 📍 Anclaje de Estado (Fase de generación vs refinamiento)
2. 🧬 Verificación de BrandDNA (Eliminar tono corporativo si es informal)
3. 🚫 Filtro Anti-Slop (Eliminar frases vacías)
4. 🎯 Ejecución (Formato JSON estricto)`;
}

/**
 * Genera opciones de contenido usando el proveedor configurado
 */
export async function generateContent(
  taskContext: TaskContext
): Promise<AIResponse> {
  const config = await getActiveProvider();

  if (!config) {
    throw new Error(
      "No hay proveedor de IA configurado. Por favor, configura un proveedor en la configuración global."
    );
  }

  const systemPrompt = applyLucidLoomLogic(buildSystemPrompt(taskContext));
  const userPrompt = buildUserPrompt(
    taskContext.title,
    taskContext.type
  );

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const rawText = await callAIProvider(
    config.provider,
    config.apiKey,
    messages,
    {
      model: config.model,
      baseUrl: config.baseUrl,
      temperature: 0.7,
      response_format: { type: "json_object" }
    }
  );

  return parseAIResponse(rawText);
}

/**
 * Refina contenido existente usando el proveedor configurado
 */
export async function refineContent(
  taskContext: TaskContext,
  originalText: string
): Promise<RefineResponse> {
  const config = await getActiveProvider();

  if (!config) {
    throw new Error(
      "No hay proveedor de IA configurado. Por favor, configura un proveedor en la configuración global."
    );
  }

  const systemPrompt = applyLucidLoomLogic(buildRefineSystemPrompt(taskContext));
  const userPrompt = buildRefineUserPrompt(
    originalText,
    taskContext.title,
    taskContext.type
  );

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const rawText = await callAIProvider(
    config.provider,
    config.apiKey,
    messages,
    {
      model: config.model,
      baseUrl: config.baseUrl,
      temperature: 0.7,
      response_format: { type: "json_object" }
    }
  );

  return parseRefineResponse(rawText);
}

/**
 * Genera análisis de performance usando el proveedor configurado
 */
export async function generatePerformanceAnalysis(
  context: PerformanceContext
): Promise<string> {
  const config = await getActiveProvider();

  if (!config) {
    throw new Error(
      "No hay proveedor de IA configurado. Por favor, configura un proveedor en la configuración global."
    );
  }

  const systemPrompt = buildPerformanceSystemPrompt(context);
  const userPrompt = buildPerformanceUserPrompt(context.metrics);

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  // Performance analysis retorna texto plano, no requiere parsing JSON
  return await callAIProvider(
    config.provider,
    config.apiKey,
    messages,
    {
      model: config.model,
      baseUrl: config.baseUrl,
      temperature: 0.7
    }
  );
}
