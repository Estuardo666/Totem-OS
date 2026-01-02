interface OpenAIConfig {
  model?: string;
  response_format?: any;
  temperature?: number;
  [key: string]: any;
}

export async function callOpenAIRaw(
  apiKey: string,
  messages: any[],
  config: OpenAIConfig = {},
  baseUrl?: string
): Promise<string> {
  const cleanBaseUrl = (baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  const endpoint = `${cleanBaseUrl}/chat/completions`;
  const isCustomEndpoint = cleanBaseUrl !== "https://api.openai.com/v1";
  const configuredModel = config.model;

  // Lógica de fallback original
  const modelsToTry = configuredModel
    ? [configuredModel, "gpt-4o-mini", "gpt-3.5-turbo", "gpt-4", "gpt-4-turbo", "gpt-3.5-turbo-1106"]
    : ["gpt-4o-mini", "gpt-3.5-turbo", "gpt-4", "gpt-4-turbo", "gpt-3.5-turbo-1106"];

  // Si es endpoint custom (ej: Xiaomi), solo probamos el modelo configurado
  const finalModelsList = (configuredModel && isCustomEndpoint) ? [configuredModel] : modelsToTry;

  let lastError: Error | null = null;

  for (const model of finalModelsList) {
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
          response_format: config.response_format,
          temperature: config.temperature || 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Unknown error" }));
        const errorMsg = error.error?.message || error.message || "Unknown error";

        // Si es error de modelo no soportado, intentamos el siguiente
        if (errorMsg.toLowerCase().includes("not supported") || 
            errorMsg.toLowerCase().includes("model") ||
            errorMsg.toLowerCase().includes("param")) {
          lastError = new Error(`Modelo ${model} no soportado: ${errorMsg}`);
          continue;
        }
        
        throw new Error(`OpenAI API error: ${errorMsg}`);
      }

      const data = await response.json();

      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        lastError = new Error(`Modelo ${model} no devolvió estructura válida`);
        continue;
      }

      const content = data.choices[0]?.message?.content;
      if (!content) {
        lastError = new Error(`Modelo ${model} no devolvió contenido`);
        continue;
      }

      return content;

    } catch (error) {
      if (error instanceof Error && (error.message.includes("Failed to fetch") || error.message.includes("timeout"))) {
        throw error;
      }
      lastError = error as Error;
      continue;
    }
  }

  throw lastError || new Error("No se pudo generar contenido con OpenAI.");
}

