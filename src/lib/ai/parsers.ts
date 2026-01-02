/**
 * Módulo de parsers para respuestas de IA
 * Contiene la lógica de limpieza y parsing de respuestas JSON de diferentes proveedores
 */

// Interfaces para las respuestas de IA
export interface AIOption {
  framework: "AIDA" | "PAS" | "Storytelling";
  content: string;
}

export interface AIResponse {
  options: AIOption[];
}

export interface RefineResponse {
  refinedContent: string;
}

/**
 * Limpia el contenido de una respuesta de IA removiendo bloques de código Markdown
 * y extrayendo el JSON si está contenido dentro de texto
 * 
 * @param text - Texto crudo de la respuesta de la IA
 * @returns Texto limpio listo para parsear como JSON
 */
export function cleanJsonString(text: string): string {
  let cleaned = text.trim();
  
  // Remover bloques de código markdown (```json o ```)
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/g, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/i, "").replace(/\s*```$/g, "");
  }

  // Intentar extraer JSON si está dentro de texto
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  return cleaned;
}

/**
 * Parsea la respuesta de la IA y valida el formato
 * 
 * @param content - Contenido crudo de la respuesta
 * @returns Objeto AIResponse validado
 */
export function parseAIResponse(content: string): AIResponse {
  try {
    const cleanedContent = cleanJsonString(content);
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
 * Parsea la respuesta de refinamiento de la IA
 * 
 * @param content - Contenido crudo de la respuesta
 * @returns Objeto RefineResponse validado
 */
export function parseRefineResponse(content: string): RefineResponse {
  try {
    const cleanedContent = cleanJsonString(content);
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

