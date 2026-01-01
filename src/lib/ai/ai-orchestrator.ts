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

    console.log("[AI Parser] Attempting to parse:", cleanedContent.substring(0, 300));

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

    const frameworks = parsed.options.map((opt) => opt.framework);
    const requiredFrameworks = ["AIDA", "PAS", "Storytelling"];

    for (const required of requiredFrameworks) {
      if (!frameworks.includes(required)) {
        console.error("[AI Parser] Missing framework:", required, "Found:", frameworks);
        throw new Error(`Falta el framework ${required}. Frameworks encontrados: ${frameworks.join(", ")}`);
      }
    }

    console.log("[AI Parser] Successfully parsed response");
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
 * Llamada a OpenAI
 */
async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<AIResponse> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
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
      `OpenAI API error: ${error.error?.message || "Failed to generate content"}`
    );
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error("No se recibió contenido de OpenAI");
  }

  return parseAIResponse(content);
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

    // Log para debugging
    console.log("[Grok API] Status:", response.status, response.statusText);

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
    console.log("[Grok API] Response data:", JSON.stringify(data, null, 2));

    // Verificar estructura de respuesta
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      console.error("[Grok API] Invalid response structure:", data);
      throw new Error("La respuesta de Grok no tiene la estructura esperada");
    }

    const content = data.choices[0]?.message?.content;

    if (!content || typeof content !== "string") {
      console.error("[Grok API] No content in response:", data);
      throw new Error("No se recibió contenido válido de Grok");
    }

    console.log("[Grok API] Content received:", content.substring(0, 200));

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
  provider: "openai" | "grok" | "deepseek" | "google"
): Promise<RefineResponse> {
  let response: Response;
  let data: any;

  switch (provider) {
    case "openai":
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
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
        throw new Error(`OpenAI API error: ${error.error?.message || "Failed to refine content"}`);
      }
      data = await response.json();
      return parseRefineResponse(data.choices[0]?.message?.content || "");

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
      return callOpenAI(config.apiKey, systemPrompt, userPrompt);
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

  return callRefineAPI(config.apiKey, systemPrompt, userPrompt, config.provider);
}

/**
 * Llama a la API de IA para análisis de performance (devuelve texto plano/markdown)
 */
async function callPerformanceAPI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  provider: "openai" | "grok" | "deepseek" | "google"
): Promise<string> {
  let response: Response;
  let data: any;

  switch (provider) {
    case "openai":
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(`OpenAI API error: ${error.error?.message || "Failed to generate performance analysis"}`);
      }
      data = await response.json();
      return data.choices[0]?.message?.content || "";

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

  return callPerformanceAPI(config.apiKey, systemPrompt, userPrompt, config.provider);
}
