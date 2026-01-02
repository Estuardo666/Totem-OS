interface GrokConfig {
  model?: string;
  temperature?: number;
  [key: string]: any;
}

export async function callGrokRaw(
  apiKey: string,
  messages: any[],
  config: GrokConfig = {}
): Promise<string> {
  const model = config.model || "grok-3";
  const temperature = config.temperature || 0.7;

  // Reforzar el prompt para asegurar respuesta JSON
  const enhancedMessages = messages.map(msg => {
    if (msg.role === "system") {
      return {
        ...msg,
        content: `${msg.content}

CRÍTICO: Debes responder ÚNICAMENTE con un JSON válido. No incluyas markdown, no incluyas explicaciones, solo el JSON puro.`
      };
    }
    return msg;
  });

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: enhancedMessages,
      temperature: temperature,
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

  return content;
}

