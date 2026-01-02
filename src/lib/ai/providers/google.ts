interface GoogleConfig {
  model?: string;
  temperature?: number;
  responseMimeType?: string;
  [key: string]: any;
}

export async function callGoogleRaw(
  apiKey: string,
  messages: any[],
  config: GoogleConfig = {}
): Promise<string> {
  const temperature = config.temperature || 0.7;
  const responseMimeType = config.responseMimeType || "application/json";

  // Google usa un formato diferente para los mensajes
  // Combinamos system y user en un solo texto
  const combinedPrompt = messages
    .map(msg => `${msg.role === "system" ? "System: " : ""}${msg.content}`)
    .join("\n\n");

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
              { text: combinedPrompt },
            ],
          },
        ],
        generationConfig: {
          temperature: temperature,
          responseMimeType: responseMimeType,
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

  return content;
}

