export interface BrandDNA {
  businessDescription?: string;
  toneOfVoice?: string;
  audience?: string;
  values?: string;
}

export interface GenerationPreferences {
  length: "short" | "medium" | "long";
  includeEmojis: boolean;
}

export interface TaskContext {
  title: string;
  type: "REEL" | "FLYER" | "STORY";
  clientName: string;
  brandDNA: BrandDNA;
  preferences?: GenerationPreferences;
}

/**
 * Construye el prompt del sistema inyectando el ADN de marca del cliente
 */
export function buildSystemPrompt(taskContext: TaskContext): string {
  const { clientName, brandDNA, title, type, preferences } = taskContext;

  let prompt = `Eres un experto copywriter especializado en marketing digital y creación de contenido para redes sociales.

CONTEXTO DE LA MARCA:
- Cliente: ${clientName}
- Tipo de contenido: ${type}
- Título de la tarea: ${title}
`;

  if (brandDNA.businessDescription) {
    prompt += `- Descripción del negocio: ${brandDNA.businessDescription}\n`;
  }

  if (brandDNA.toneOfVoice) {
    prompt += `- Tono de voz: ${brandDNA.toneOfVoice}\n`;
  }

  if (brandDNA.audience) {
    prompt += `- Audiencia objetivo: ${brandDNA.audience}\n`;
  }

  if (brandDNA.values) {
    prompt += `- Valores de marca: ${brandDNA.values}\n`;
  }

  // Instrucciones de extensión
  const lengthInstruction = preferences?.length
    ? preferences.length === "short"
      ? "CORTA (aproximadamente 30 palabras)"
      : preferences.length === "medium"
      ? "MEDIA (aproximadamente 70 palabras)"
      : "LARGA (más de 120 palabras)"
    : "MEDIA (aproximadamente 70 palabras)";

  // Instrucción de emojis
  const emojiInstruction = preferences?.includeEmojis
    ? "Si la opción de emojis está activa, integra emojis relevantes de forma natural en el contenido."
    : "NO uses ningún emoji en el contenido.";

  prompt += `
INSTRUCCIONES CRÍTICAS:
1. Debes generar EXACTAMENTE 3 opciones de contenido usando diferentes frameworks de copywriting.
2. Cada opción debe seguir un framework específico:
   - Opción 1: AIDA (Atención, Interés, Deseo, Acción) - Enfocado en conversión directa
   - Opción 2: PAS (Problema, Agitación, Solución) - Enfocado en atacar puntos de dolor
   - Opción 3: Storytelling - Enfocado en retención y branding emocional

3. El contenido debe ser:
   - Adaptado al tono de voz de la marca
   - Relevante para la audiencia objetivo
   - Alineado con los valores de la marca
   - Optimizado para ${type === "REEL" ? "video corto" : type === "FLYER" ? "imagen estática" : "historia efímera"}

4. FORMATO Y LONGITUD:
   - La longitud de cada opción debe ser ${lengthInstruction} según la preferencia seleccionada.
   - ${emojiInstruction}
   - CRÍTICO: NO incluyas los nombres de las etapas del framework (como "(Atención)", "(Interés)", "(Deseo)", "(Acción)", "(Problema)", "(Agitación)", "(Solución)", etc.) en el texto final. El texto debe ser fluido, natural y listo para publicar sin etiquetas de framework.
   - El contenido debe estar listo para usar directamente en redes sociales, sin necesidad de edición adicional.

5. Debes responder ÚNICAMENTE con un JSON válido siguiendo este esquema exacto:
{
  "options": [
    {
      "framework": "AIDA",
      "content": "Texto del contenido aquí..."
    },
    {
      "framework": "PAS",
      "content": "Texto del contenido aquí..."
    },
    {
      "framework": "Storytelling",
      "content": "Texto del contenido aquí..."
    }
  ]
}

IMPORTANTE: No incluyas ningún texto adicional fuera del JSON. La respuesta debe ser parseable directamente.`;

  return prompt;
}

/**
 * Construye el prompt del usuario con el contexto específico de la tarea
 */
export function buildUserPrompt(taskTitle: string, taskType: string): string {
  return `Genera 3 opciones de contenido para la tarea "${taskTitle}" (${taskType}).

Asegúrate de que cada opción:
- Sea única y diferente de las otras
- Siga estrictamente su framework asignado
- Sea concisa pero impactante
- Esté lista para usar en redes sociales`;
}

/**
 * Construye el prompt del sistema para refinamiento de contenido
 */
export function buildRefineSystemPrompt(taskContext: TaskContext): string {
  const { clientName, brandDNA, title, type } = taskContext;

  let prompt = `Eres un experto editor y copywriter especializado en optimización de contenido para redes sociales.

CONTEXTO DE LA MARCA:
- Cliente: ${clientName}
- Tipo de contenido: ${type}
- Título de la tarea: ${title}
`;

  if (brandDNA.businessDescription) {
    prompt += `- Descripción del negocio: ${brandDNA.businessDescription}\n`;
  }

  if (brandDNA.toneOfVoice) {
    prompt += `- Tono de voz: ${brandDNA.toneOfVoice}\n`;
  }

  if (brandDNA.audience) {
    prompt += `- Audiencia objetivo: ${brandDNA.audience}\n`;
  }

  if (brandDNA.values) {
    prompt += `- Valores de marca: ${brandDNA.values}\n`;
  }

  prompt += `
INSTRUCCIONES CRÍTICAS PARA REFINAMIENTO:
1. Analiza el texto original proporcionado por el usuario.
2. Optimiza el contenido para que suene 100% acorde al tono de voz y valores de marca del cliente.
3. Corrige cualquier error gramatical u ortográfico.
4. Mejora el "gancho" inicial para captar más atención.
5. Asegúrate de que el mensaje sea claro, conciso y efectivo para la audiencia objetivo.
6. Mantén la esencia y el mensaje principal del texto original, solo optimízalo.
7. El contenido debe estar listo para publicar directamente en redes sociales.

8. Debes responder ÚNICAMENTE con un JSON válido siguiendo este esquema exacto:
{
  "refinedContent": "Texto optimizado aquí..."
}

IMPORTANTE: No incluyas ningún texto adicional fuera del JSON. La respuesta debe ser parseable directamente.`;

  return prompt;
}

/**
 * Construye el prompt del usuario para refinamiento
 */
export function buildRefineUserPrompt(originalText: string, taskTitle: string, taskType: string): string {
  return `Refina y optimiza el siguiente contenido para la tarea "${taskTitle}" (${taskType}):

TEXTO ORIGINAL:
${originalText}

Por favor, optimiza este contenido manteniendo su esencia pero mejorando:
- El tono de voz para que sea 100% acorde a la marca
- La gramática y ortografía
- El gancho inicial para mayor impacto
- La claridad del mensaje
- La efectividad para la audiencia objetivo`;
}
