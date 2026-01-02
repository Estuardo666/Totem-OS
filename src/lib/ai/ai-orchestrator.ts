"use server";

import { getActiveProvider } from "./ai-provider-service";
import { buildSystemPrompt, buildUserPrompt, buildRefineSystemPrompt, buildRefineUserPrompt } from "./prompts";
import type { TaskContext } from "./prompts";
import { buildPerformanceSystemPrompt, buildPerformanceUserPrompt, type PerformanceContext } from "./performance-prompts";

interface AIOption {
  framework: "AIDA" | "PAS" | "Storytelling";
  content: string;
}

interface AIResponse {
  options: AIOption[];
}

interface RefineResponse {
  refinedContent: string;
}

/**
 * Parsea la respuesta de la IA y valida el formato
 */
function parseAIResponse(content: string): AIResponse {
  try {
    // Limpiar el contenido (puede tener markdown code blocks)
    let cleanedContent = content.trim();
    
    // Remover markdown code blocks
    if (cleanedContent.startsWith("```json")) {
      cleanedContent = cleanedContent.replace(/^```json\s*/i, "").replace(/\s*```$/g, "");
    } else if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent.replace(/^```\s*/i, "").replace(/\s*```$/g, "");
    }

    // Intentar extraer JSON si está dentro de texto
    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedContent = jsonMatch[0];
    }

    const parsed = JSON.parse(cleanedContent) as AIResponse;

    // Validar estructura
    if (!parsed.options || !Array.isArray(parsed.options)) {
      console.error("[AI Parser] Invalid structure - no options array:", parsed);
      throw new Error("La respuesta no tiene el formato esperado: falta el array 'options'");
    }

    if (parsed.options.length !== 3) {
      console.error("[AI Parser] Wrong number of options:", parsed.options.length);
      throw new Error(`Se esperaban exactamente 3 opciones, pero se recibieron ${parsed.options.length}`);
    }

    // Validar que cada opción tenga framework y content
    for (let i = 0; i < parsed.options.length; i++) {
      const option = parsed.options[i];
      if (!option.framework || !option.content) {
        console.error("[AI Parser] Invalid option at index", i, ":", option);
        throw new Error(`La opción ${i + 1} no tiene 'framework' o 'content'`);
      }
    }

    const frameworks = parsed.options.map((opt) => opt.framework) as ("AIDA" | "PAS" | "Storytelling")[];
    const requiredFrameworks: ("AIDA" | "PAS" | "Storytelling")[] = ["AIDA", "PAS", "Storytelling"];

    for (const required of requiredFrameworks) {
      if (!frameworks.includes(required)) {
        console.error("[AI Parser] Missing framework:", required, "Found:", frameworks);
        throw new Error(`Falta el framework ${required}. Frameworks encontrados: ${frameworks.join(", ")}`);
      }
    }

    return parsed;
  } catch (error) {
    console.error("[AI Parser] Parse error:", error);
    if (error instanceof SyntaxError) {
      throw new Error(`Error al parsear JSON: ${error.message}. Contenido recibido: ${content.substring(0, 200)}`);
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Error desconocido al parsear respuesta: ${String(error)}`);
  }
}

/**
 * Helper para intentar múltiples modelos de OpenAI con fallback
 * @param endpoint - URL del endpoint
 * @param apiKey - API Key
 * @param messages - Mensajes para la API
 * @param responseFormat - Formato de respuesta
 * @param configuredModel - Modelo configurado por el usuario (opcional)
 * @param isCustomEndpoint - Si es un endpoint personalizado (diferente a OpenAI oficial)
 */
async function tryOpenAIModels(
  endpoint: string,
  apiKey: string,
  messages: any[],
  responseFormat: any,
  configuredModel?: string,
  isCustomEndpoint: boolean = false
): Promise<{ data: any; model: string }> {
    // Si hay modelo configurado y es endpoint personalizado, usa SOLO ese modelo
    if (configuredModel && isCustomEndpoint) {
      try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: configuredModel,
          messages: messages,
          response_format: responseFormat,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Unknown error" }));
        const errorMsg = error.error?.message || error.message || "Unknown error";
        throw new Error(`Modelo ${configuredModel} no soportado: ${errorMsg}`);
      }

      const data = await response.json();

      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        throw new Error(`Modelo ${configuredModel} no devolvió estructura válida`);
      }

      const content = data.choices[0]?.message?.content;
      if (!content) {
        throw new Error(`Modelo ${configuredModel} no devolvió contenido`);
      }

      return { data, model: configuredModel };

    } catch (error) {
      // En endpoint personalizado, NO hacer fallback, lanzar error inmediatamente
      throw error;
    }
  }

  // Si hay modelo configurado pero es endpoint oficial, intenta con ese primero
  const modelsToTry = configuredModel 
    ? [configuredModel, "gpt-4o-mini", "gpt-3.5-turbo", "gpt-4", "gpt-4-turbo", "gpt-3.5-turbo-1106"]
    : ["gpt-4o-mini", "gpt-3.5-turbo", "gpt-4", "gpt-4-turbo", "gpt-3.5-turbo-1106"];

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          response_format: responseFormat,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Unknown error" }));
        const errorMsg = error.error?.message || error.message || "Unknown error";
        
        // Si es error de modelo no soportado, intenta con el siguiente
        if (errorMsg.toLowerCase().includes("not supported") || 
            errorMsg.toLowerCase().includes("model") ||
            errorMsg.toLowerCase().includes("param")) {
          lastError = new Error(`Modelo ${model} no soportado: ${errorMsg}`);
          continue; // Intentar siguiente modelo
        }
        
        // Otro tipo de error, lanzar inmediatamente
        throw new Error(`OpenAI API error: ${errorMsg}`);
      }

      const data = await response.json();

      // Validación defensiva de la estructura
      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        console.error("Respuesta inválida de OpenAI:", data);
        lastError = new Error(`Modelo ${model} no devolvió estructura válida`);
        continue;
      }

      const content = data.choices[0]?.message?.content;

      if (!content) {
        lastError = new Error(`Modelo ${model} no devolvió contenido`);
        continue;
      }

      return { data, model };

    } catch (error) {
      // Si es un error de red o timeout, lanzar inmediatamente
      if (error instanceof Error && (error.message.includes("Failed to fetch") || error.message.includes("timeout"))) {
        throw error;
      }
      
      lastError = error as Error;
      continue; // Intentar siguiente modelo
    }
  }

  // Si llegamos aquí, ningún modelo funcionó
  if (lastError) {
    throw lastError;
  }

  throw new Error("No se pudo generar contenido. Error desconocido.");
}

/**
 * Llamada a OpenAI con soporte para múltiples modelos y fallback
 * @param apiKey - API Key
 * @param systemPrompt - Prompt del sistema
 * @param userPrompt - Prompt del usuario
 * @param baseUrl - Base URL personalizado (opcional)
 * @param configuredModel - Modelo configurado por el usuario (opcional)
 */
async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  baseUrl?: string,
  configuredModel?: string
): Promise<AIResponse> {
  // Corregir barras duplicadas en la URL
  const cleanBaseUrl = (baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  const endpoint = `${cleanBaseUrl}/chat/completions`;
  
  // Determinar si es endpoint personalizado
  const isCustomEndpoint = cleanBaseUrl !== "https://api.openai.com/v1";
  
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  try {
    const { data, model } = await tryOpenAIModels(
      endpoint, 
      apiKey, 
      messages, 
      { type: "json_object" },
      configuredModel,
      isCustomEndpoint
    );
    
    const content = data.choices[0]?.message?.content;
    return parseAIResponse(content);

  } catch (error) {
    // Mejorar el mensaje de error con sugerencias
    let errorMessage = `No se pudo generar contenido.\n\n`;
    
    if (error instanceof Error) {
      errorMessage += `Error: ${error.message}\n\n`;
    }
    
    if (isCustomEndpoint) {
      errorMessage += `💡 Sugerencias para "${cleanBaseUrl}":\n`;
      errorMessage += `   1. Verifica que la URL sea correcta\n`;
      errorMessage += `   2. Verifica que el modelo "${configuredModel}" sea correcto\n`;
      errorMessage += `   3. Revisa qué modelos soporta este endpoint\n`;
      errorMessage += `   4. Contacta al proveedor del endpoint\n`;
      errorMessage += `   5. Verifica que tu API Key sea válida para este endpoint\n`;
    } else {
      errorMessage += `💡 Sugerencias para OpenAI:\n`;
      errorMessage += `   1. Verifica que tu API Key sea válida\n`;
      errorMessage += `   2. Asegúrate de tener crédito disponible\n`;
      errorMessage += `   3. Revisa tu quota en la cuenta de OpenAI\n`;
      errorMessage += `   4. Verifica que tu plan soporte el modelo configurado\n`;
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * Llamada a Grok (xAI)
 * Nota: Grok no soporta response_format en su API actual, por lo que se refuerza el prompt
 */
async function callGrok(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<AIResponse> {
  // Reforzar el prompt para asegurar respuesta JSON
  const enhancedSystemPrompt = `${systemPrompt}

CRÍTICO: Debes responder ÚNICAMENTE con un JSON válido. No incluyas markdown, no incluyas explicaciones, solo el JSON puro.`;

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-3",
        messages: [
          { role: "system", content: enhancedSystemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Grok API] Error response:", errorText);
      
      let errorMessage = "Failed to generate content";
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error?.message || error.message || error.error?.code || errorMessage;
      } catch {
        errorMessage = errorText.substring(0, 200) || errorMessage;
      }
      throw new Error(`Grok API error: ${errorMessage}`);
    }

    const data = await response.json();

    // Validación defensiva de la estructura
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      console.error("[Grok API] Invalid response structure:", data);
      throw new Error(
        `La API de Grok no devolvió la estructura esperada. ` +
        `Respuesta recibida: ${JSON.stringify(data, null, 2)}`
      );
    }

    const content = data.choices[0]?.message?.content;

    if (!content || typeof content !== "string") {
      console.error("[Grok API] No content in response:", data);
      throw new Error("No se recibió contenido válido de Grok");
    }

    return parseAIResponse(content);
  } catch (error) {
    // Re-lanzar errores ya formateados
    if (error instanceof Error && error.message.startsWith("Grok API error:")) {
      throw error;
    }
    
    // Manejar otros errores (red, parsing, etc.)
    console.error("[Grok API] Unexpected error:", error);
    throw new Error(
      `Grok API error: ${error instanceof Error ? error.message : "Error desconocido"}`
    );
  }
}

/**
 * Llamada a DeepSeek
 */
async function callDeepSeek(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<AIResponse> {
  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(
      `DeepSeek API error: ${error.error?.message || "Failed to generate content"}`
    );
  }

  const data = await response.json();

  // Validación defensiva
  if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
    console.error("Respuesta inválida de DeepSeek:", data);
    throw new Error(
      `La API de DeepSeek no devolvió la estructura esperada. ` +
      `Respuesta recibida: ${JSON.stringify(data, null, 2)}`
    );
  }

  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error("No se recibió contenido de DeepSeek");
  }

  return parseAIResponse(content);
}

/**
 * Llamada a Google Gemini
 */
async function callGoogle(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<AIResponse> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\n${userPrompt}` },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(
      `Google API error: ${error.error?.message || "Failed to generate content"}`
    );
  }

  const data = await response.json();

  // Validación defensiva
  if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
    console.error("Respuesta inválida de Google:", data);
    throw new Error(
      `La API de Google no devolvió la estructura esperada. ` +
      `Respuesta recibida: ${JSON.stringify(data, null, 2)}`
    );
  }

  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    throw new Error("No se recibió contenido de Google");
  }

  return parseAIResponse(content);
}

/**
 * Parsea la respuesta de refinamiento de la IA
 */
function parseRefineResponse(content: string): RefineResponse {
  try {
    // Limpiar el contenido (puede tener markdown code blocks)
    let cleanedContent = content.trim();
    
    // Remover markdown code blocks
    if (cleanedContent.startsWith("```json")) {
      cleanedContent = cleanedContent.replace(/^```json\s*/i, "").replace(/\s*```$/g, "");
    } else if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent.replace(/^```\s*/i, "").replace(/\s*```$/g, "");
    }

    // Intentar extraer JSON si está dentro de texto
    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedContent = jsonMatch[0];
    }

    const parsed = JSON.parse(cleanedContent) as RefineResponse;

    // Validar estructura
    if (!parsed.refinedContent || typeof parsed.refinedContent !== "string") {
      throw new Error("La respuesta no tiene el formato esperado: falta 'refinedContent'");
    }

    return parsed;
  } catch (error) {
    console.error("[AI Parser] Parse error:", error);
    if (error instanceof SyntaxError) {
      throw new Error(`Error al parsear JSON: ${error.message}. Contenido recibido: ${content.substring(0, 200)}`);
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Error desconocido al parsear respuesta: ${String(error)}`);
  }
}

/**
 * Llama a la API de IA para refinamiento (reutiliza las funciones existentes pero con diferente parsing)
 */
async function callRefineAPI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  provider: "openai" | "grok" | "deepseek" | "google",
  baseUrl?: string,
  configuredModel?: string
): Promise<RefineResponse> {
  let response: Response;
  let data: any;

  switch (provider) {
    case "openai":
      const cleanBaseUrl = (baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
      const endpoint = `${cleanBaseUrl}/chat/completions`;
      const isCustomEndpoint = cleanBaseUrl !== "https://api.openai.com/v1";
      
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];

      try {
        const { data, model } = await tryOpenAIModels(
          endpoint, 
          apiKey, 
          messages, 
          { type: "json_object" },
          configuredModel,
          isCustomEndpoint
        );
        
        const content = data.choices[0]?.message?.content || "";
        return parseRefineResponse(content);

      } catch (error) {
        // Mejorar mensaje de error
        let errorMessage = `No se pudo refinar contenido.\n\n`;
        
        if (error instanceof Error) {
          errorMessage += `Error: ${error.message}\n\n`;
        }
        
        if (isCustomEndpoint) {
          errorMessage += `💡 Sugerencias para "${cleanBaseUrl}":\n`;
          errorMessage += `   1. Verifica que la URL sea correcta\n`;
          errorMessage += `   2. Verifica que el modelo "${configuredModel}" sea correcto\n`;
          errorMessage += `   3. Revisa qué modelos soporta este endpoint\n`;
          errorMessage += `   4. Verifica tu API Key\n`;
        } else {
          errorMessage += `💡 Sugerencias para OpenAI:\n`;
          errorMessage += `   1. Verifica tu API Key y crédito\n`;
          errorMessage += `   2. Revisa tu quota\n`;
        }
        
        throw new Error(errorMessage);
      }

    case "grok":
      const enhancedSystemPrompt = `${systemPrompt}

CRÍTICO: Debes responder ÚNICAMENTE con un JSON válido. No incluyas markdown, no incluyas explicaciones, solo el JSON puro.`;
      response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-3",
          messages: [
            { role: "system", content: enhancedSystemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Failed to refine content";
        try {
          const error = JSON.parse(errorText);
          errorMessage = error.error?.message || error.message || error.error?.code || errorMessage;
        } catch {
          errorMessage = errorText.substring(0, 200) || errorMessage;
        }
        throw new Error(`Grok API error: ${errorMessage}`);
      }
      data = await response.json();

      // Validación defensiva
      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        console.error("Respuesta inválida de Grok (refine):", data);
        throw new Error(
          `La API de Grok no devolvió la estructura esperada. ` +
          `Respuesta recibida: ${JSON.stringify(data, null, 2)}`
        );
      }
      
      return parseRefineResponse(data.choices[0]?.message?.content || "");

    case "deepseek":
      response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(`DeepSeek API error: ${error.error?.message || "Failed to refine content"}`);
      }
      data = await response.json();

      // Validación defensiva
      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        console.error("Respuesta inválida de DeepSeek (refine):", data);
        throw new Error(
          `La API de DeepSeek no devolvió la estructura esperada. ` +
          `Respuesta recibida: ${JSON.stringify(data, null, 2)}`
        );
      }
      
      return parseRefineResponse(data.choices[0]?.message?.content || "");

    case "google":
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `${systemPrompt}\n\n${userPrompt}` },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              responseMimeType: "application/json",
            },
          }),
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(`Google API error: ${error.error?.message || "Failed to refine content"}`);
      }
      data = await response.json();

      // Validación defensiva
      if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
        console.error("Respuesta inválida de Google (refine):", data);
        throw new Error(
          `La API de Google no devolvió la estructura esperada. ` +
          `Respuesta recibida: ${JSON.stringify(data, null, 2)}`
        );
      }
      
      return parseRefineResponse(data.candidates?.[0]?.content?.parts?.[0]?.text || "");

    default:
      throw new Error(`Proveedor ${provider} no soportado`);
  }
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

  const systemPrompt = buildSystemPrompt(taskContext);
  const userPrompt = buildUserPrompt(
    taskContext.title,
    taskContext.type
  );

  // Llamar al proveedor correspondiente
  switch (config.provider) {
    case "openai":
      return callOpenAI(config.apiKey, systemPrompt, userPrompt, config.baseUrl, config.model);
    case "grok":
      return callGrok(config.apiKey, systemPrompt, userPrompt);
    case "deepseek":
      return callDeepSeek(config.apiKey, systemPrompt, userPrompt);
    case "google":
      return callGoogle(config.apiKey, systemPrompt, userPrompt);
    default:
      throw new Error(`Proveedor ${config.provider} no soportado`);
  }
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

  const systemPrompt = buildRefineSystemPrompt(taskContext);
  const userPrompt = buildRefineUserPrompt(
    originalText,
    taskContext.title,
    taskContext.type
  );

  return callRefineAPI(config.apiKey, systemPrompt, userPrompt, config.provider, config.baseUrl, config.model);
}

/**
 * Llama a la API de IA para análisis de performance (devuelve texto plano/markdown)
 */
async function callPerformanceAPI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  provider: "openai" | "grok" | "deepseek" | "google",
  baseUrl?: string,
  configuredModel?: string
): Promise<string> {
  let response: Response;
  let data: any;

  switch (provider) {
    case "openai":
      const cleanBaseUrl = (baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
      const endpoint = `${cleanBaseUrl}/chat/completions`;
      const isCustomEndpoint = cleanBaseUrl !== "https://api.openai.com/v1";
      
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];

      try {
        const { data, model } = await tryOpenAIModels(
          endpoint, 
          apiKey, 
          messages, 
          undefined,
          configuredModel,
          isCustomEndpoint
        );
        
        return data.choices[0]?.message?.content || "";

      } catch (error) {
        // Mejorar mensaje de error
        let errorMessage = `No se pudo generar análisis.\n\n`;
        
        if (error instanceof Error) {
          errorMessage += `Error: ${error.message}\n\n`;
        }
        
        if (isCustomEndpoint) {
          errorMessage += `💡 Sugerencias para "${cleanBaseUrl}":\n`;
          errorMessage += `   1. Verifica que la URL sea correcta\n`;
          errorMessage += `   2. Verifica que el modelo "${configuredModel}" sea correcto\n`;
          errorMessage += `   3. Revisa qué modelos soporta este endpoint\n`;
          errorMessage += `   4. Verifica tu API Key\n`;
        } else {
          errorMessage += `💡 Sugerencias para OpenAI:\n`;
          errorMessage += `   1. Verifica tu API Key y crédito\n`;
          errorMessage += `   2. Revisa tu quota\n`;
        }
        
        throw new Error(errorMessage);
      }

    case "grok":
      response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-3",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Failed to generate performance analysis";
        try {
          const error = JSON.parse(errorText);
          errorMessage = error.error?.message || error.message || error.error?.code || errorMessage;
        } catch {
          errorMessage = errorText.substring(0, 200) || errorMessage;
        }
        throw new Error(`Grok API error: ${errorMessage}`);
      }
      data = await response.json();

      // Validación defensiva
      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        console.error("Respuesta inválida de Grok (performance):", data);
        throw new Error(
          `La API de Grok no devolvió la estructura esperada. ` +
          `Respuesta recibida: ${JSON.stringify(data, null, 2)}`
        );
      }
      
      return data.choices[0]?.message?.content || "";

    case "deepseek":
      response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(`DeepSeek API error: ${error.error?.message || "Failed to generate performance analysis"}`);
      }
      data = await response.json();

      // Validación defensiva
      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        console.error("Respuesta inválida de DeepSeek (performance):", data);
        throw new Error(
          `La API de DeepSeek no devolvió la estructura esperada. ` +
          `Respuesta recibida: ${JSON.stringify(data, null, 2)}`
        );
      }
      
      return data.choices[0]?.message?.content || "";

    case "google":
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `${systemPrompt}\n\n${userPrompt}` },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
            },
          }),
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(`Google API error: ${error.error?.message || "Failed to generate performance analysis"}`);
      }
      data = await response.json();

      // Validación defensiva
      if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
        console.error("Respuesta inválida de Google (performance):", data);
        throw new Error(
          `La API de Google no devolvió la estructura esperada. ` +
          `Respuesta recibida: ${JSON.stringify(data, null, 2)}`
        );
      }
      
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    default:
      throw new Error(`Proveedor ${provider} no soportado para análisis de performance`);
  }
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

  return callPerformanceAPI(config.apiKey, systemPrompt, userPrompt, config.provider, config.baseUrl, config.model);
}
