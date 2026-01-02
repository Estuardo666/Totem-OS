interface DeepSeekConfig {
  model?: string;
  response_format?: any;
  temperature?: number;
  [key: string]: any;
}

export async function callDeepSeekRaw(
  apiKey: string,
  messages: any[],
  config: DeepSeekConfig = {}
): Promise<string> {
  const model = config.model || "deepseek-chat";
  const temperature = config.temperature || 0.7;
  const responseFormat = config.response_format || { type: "json_object" };

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      response_format: responseFormat,
      temperature: temperature,
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

  return content;
}

