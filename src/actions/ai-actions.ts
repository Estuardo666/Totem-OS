"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { generateContent, refineContent } from "@/lib/ai/ai-orchestrator";
import type { ApiResponse } from "@/types";
import type { TaskContext } from "@/lib/ai/prompts";

interface AIOption {
  framework: "AIDA" | "PAS" | "Storytelling";
  content: string;
}

interface GenerateOptionsResponse {
  options: AIOption[];
}

interface GenerationPreferences {
  length?: "short" | "medium" | "long";
  includeEmojis?: boolean;
}

/**
 * Server Action para generar opciones de contenido usando IA
 * Valida sesión, permisos y ADN de marca del cliente
 */
export async function generateTaskOptionsAction(
  taskId: string,
  preferences?: GenerationPreferences
): Promise<ApiResponse<GenerateOptionsResponse>> {
  try {
    // 1. Validar sesión y permisos
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: "No autenticado",
      };
    }

    const userRole = session.user.role;
    if (userRole !== "ADMIN" && userRole !== "EDITOR") {
      return {
        success: false,
        error: "No tienes permisos para generar contenido con IA",
      };
    }

    // 2. Recuperar datos de la tarea y el cliente
    const task = await db.contentTask.findUnique({
      where: { id: taskId },
      include: {
        client: true,
      },
    });

    if (!task) {
      return {
        success: false,
        error: "Tarea no encontrada",
      };
    }

    // 3. Validar permisos: EDITOR solo puede generar para sus tareas asignadas
    if (userRole === "EDITOR" && task.assignedEditorId !== session.user.id) {
      return {
        success: false,
        error: "No tienes permisos para generar contenido para esta tarea",
      };
    }

    // 4. Verificar y extraer ADN de marca del cliente
    let brandDNA: TaskContext["brandDNA"] = {};

    if (task.client.brandDNA) {
      try {
        const parsedDNA = JSON.parse(task.client.brandDNA);
        brandDNA = {
          businessDescription: parsedDNA.businessDescription || undefined,
          toneOfVoice: parsedDNA.toneOfVoice || undefined,
          audience: parsedDNA.audience || undefined,
          values: parsedDNA.values || undefined,
        };
      } catch (error) {
        console.error("Error al parsear brandDNA:", error);
      }
    }

    // 5. Validar que el ADN esté completo (verificar que no sean strings vacíos)
    const hasBusinessDescription = !!brandDNA.businessDescription && typeof brandDNA.businessDescription === "string" && brandDNA.businessDescription.trim().length > 0;
    const hasToneOfVoice = !!brandDNA.toneOfVoice && typeof brandDNA.toneOfVoice === "string" && brandDNA.toneOfVoice.trim().length > 0;
    const hasAudience = !!brandDNA.audience && typeof brandDNA.audience === "string" && brandDNA.audience.trim().length > 0;

    if (!hasBusinessDescription || !hasToneOfVoice || !hasAudience) {
      const missingFields: string[] = [];
      if (!hasBusinessDescription) missingFields.push("Descripción del negocio");
      if (!hasToneOfVoice) missingFields.push("Tono de voz");
      if (!hasAudience) missingFields.push("Audiencia objetivo");

      return {
        success: false,
        error: `El ADN de marca del cliente no está completo. Faltan: ${missingFields.join(", ")}. Por favor, completa esta información en el perfil del cliente (pestaña "Estrategia de Marca") antes de generar contenido con IA.`,
      };
    }

    // 6. Construir contexto de la tarea
    const taskContext: TaskContext = {
      title: task.title,
      type: task.type as "REEL" | "FLYER" | "STORY",
      clientName: task.client.name,
      brandDNA,
      preferences: {
        length: preferences?.length || "medium",
        includeEmojis: preferences?.includeEmojis || false,
      },
    };

    // DEBUG: Log del contexto antes de enviar a IA
    console.log("[generateTaskOptionsAction] Task Context:", JSON.stringify(taskContext, null, 2));

    // 7. Ejecutar inferencia mediante el orquestador
    const result = await generateContent(taskContext);

    // DEBUG: Log del resultado
    console.log("[generateTaskOptionsAction] Result:", JSON.stringify(result, null, 2));

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Error al generar opciones de contenido:", error);

    // Manejar errores específicos
    if (error instanceof Error) {
      // Errores de cuota de API
      if (error.message.includes("quota") || error.message.includes("rate limit")) {
        return {
          success: false,
          error: "Se ha alcanzado el límite de cuota de la API de IA. Por favor, intenta más tarde.",
        };
      }

      // Errores de API key
      if (error.message.includes("API key") || error.message.includes("authentication")) {
        return {
          success: false,
          error: "Error de autenticación con el proveedor de IA. Verifica la configuración.",
        };
      }

      // Errores de red
      if (error.message.includes("fetch") || error.message.includes("network")) {
        return {
          success: false,
          error: "Error de conexión con el proveedor de IA. Verifica tu conexión a internet.",
        };
      }

      // Errores de configuración
      if (error.message.includes("proveedor") || error.message.includes("configuración") || error.message.includes("No hay proveedor")) {
        return {
          success: false,
          error: "Error de configuración: Verifica la API Key y el Base URL en Settings > Configuración de IA",
        };
      }

      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Error desconocido al generar contenido",
    };
  }
}

interface RefineContentResponse {
  refinedContent: string;
}

/**
 * Server Action para refinar contenido existente usando IA
 * Valida sesión, permisos y ADN de marca del cliente
 */
export async function refineTaskContentAction(
  taskId: string,
  currentText: string,
  _destination: "script" | "copy"
): Promise<ApiResponse<RefineContentResponse>> {
  try {
    // 1. Validar sesión y permisos
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: "No autenticado",
      };
    }

    const userRole = session.user.role;
    if (userRole !== "ADMIN" && userRole !== "EDITOR") {
      return {
        success: false,
        error: "No tienes permisos para refinar contenido con IA",
      };
    }

    // 2. Validar que hay texto para refinar
    if (!currentText || currentText.trim().length === 0) {
      return {
        success: false,
        error: "No hay contenido para refinar. Escribe algo primero.",
      };
    }

    // 3. Recuperar datos de la tarea y el cliente
    const task = await db.contentTask.findUnique({
      where: { id: taskId },
      include: {
        client: true,
      },
    });

    if (!task) {
      return {
        success: false,
        error: "Tarea no encontrada",
      };
    }

    // 4. Validar permisos: EDITOR solo puede refinar para sus tareas asignadas
    if (userRole === "EDITOR" && task.assignedEditorId !== session.user.id) {
      return {
        success: false,
        error: "No tienes permisos para refinar contenido para esta tarea",
      };
    }

    // 5. Verificar y extraer ADN de marca del cliente
    let brandDNA: TaskContext["brandDNA"] = {};

    if (task.client.brandDNA) {
      try {
        const parsedDNA = JSON.parse(task.client.brandDNA);
        brandDNA = {
          businessDescription: parsedDNA.businessDescription || undefined,
          toneOfVoice: parsedDNA.toneOfVoice || undefined,
          audience: parsedDNA.audience || undefined,
          values: parsedDNA.values || undefined,
        };
      } catch (error) {
        console.error("Error al parsear brandDNA:", error);
      }
    }

    // 6. Validar que el ADN esté completo (verificar que no sean strings vacíos)
    const hasBusinessDescription = !!brandDNA.businessDescription && typeof brandDNA.businessDescription === "string" && brandDNA.businessDescription.trim().length > 0;
    const hasToneOfVoice = !!brandDNA.toneOfVoice && typeof brandDNA.toneOfVoice === "string" && brandDNA.toneOfVoice.trim().length > 0;
    const hasAudience = !!brandDNA.audience && typeof brandDNA.audience === "string" && brandDNA.audience.trim().length > 0;

    if (!hasBusinessDescription || !hasToneOfVoice || !hasAudience) {
      const missingFields: string[] = [];
      if (!hasBusinessDescription) missingFields.push("Descripción del negocio");
      if (!hasToneOfVoice) missingFields.push("Tono de voz");
      if (!hasAudience) missingFields.push("Audiencia objetivo");

      return {
        success: false,
        error: `El ADN de marca del cliente no está completo. Faltan: ${missingFields.join(", ")}. Por favor, completa esta información en el perfil del cliente (pestaña "Estrategia de Marca") antes de refinar contenido con IA.`,
      };
    }

    // 7. Construir contexto de la tarea
    const taskContext: TaskContext = {
      title: task.title,
      type: task.type as "REEL" | "FLYER" | "STORY",
      clientName: task.client.name,
      brandDNA,
    };

    // DEBUG: Log del contexto
    console.log("[refineTaskContentAction] Task Context:", JSON.stringify(taskContext, null, 2));

    // 8. Ejecutar refinamiento mediante el orquestador
    const result = await refineContent(taskContext, currentText);

    // DEBUG: Log del resultado
    console.log("[refineTaskContentAction] Result:", JSON.stringify(result, null, 2));

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Error al refinar contenido:", error);

    // Manejar errores específicos
    if (error instanceof Error) {
      // Errores de cuota de API
      if (error.message.includes("quota") || error.message.includes("rate limit")) {
        return {
          success: false,
          error: "Se ha alcanzado el límite de cuota de la API de IA. Por favor, intenta más tarde.",
        };
      }

      // Errores de API key
      if (error.message.includes("API key") || error.message.includes("authentication")) {
        return {
          success: false,
          error: "Error de autenticación con el proveedor de IA. Verifica la configuración.",
        };
      }

      // Errores de red
      if (error.message.includes("fetch") || error.message.includes("network")) {
        return {
          success: false,
          error: "Error de conexión con el proveedor de IA. Verifica tu conexión a internet.",
        };
      }

      // Errores de configuración
      if (error.message.includes("proveedor") || error.message.includes("configuración")) {
        return {
          success: false,
          error: "Error de configuración: Verifica la API Key y el Base URL en Settings > Configuración de IA",
        };
      }

      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Error desconocido al refinar contenido",
    };
  }
}

/**
 * Genera predicciones financieras usando IA (Groq)
 */
export async function generateFinancialPredictionsAction(
  stats: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    incomeDeltaPct?: number;
    expensesDeltaPct?: number;
  }
): Promise<ApiResponse<any>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "No autenticado" };
    }

    const userRole = session.user.role;
    if (userRole !== "ADMIN") {
      return { success: false, error: "Solo Admin puede acceder a predicciones IA" };
    }

    // Obtener configuración de Groq
    const groqApiKey = process.env.GROQ_API_KEY;
    const groqBaseUrl = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";

    if (!groqApiKey) {
      return { success: false, error: "GROQ_API_KEY no configurado" };
    }

    // Preparar contexto financiero
    const context = `
Datos financieros actuales:
- Ingresos totales: $${stats.totalIncome}
- Gastos totales: $${stats.totalExpenses}
- Utilidad neta: $${stats.netProfit}
- Cambio en ingresos: ${stats.incomeDeltaPct?.toFixed(1) || 0}%
- Cambio en gastos: ${stats.expensesDeltaPct?.toFixed(1) || 0}%

Genera predicciones financieras para los próximos 6 meses con:
1. Predicción de ingresos mensuales
2. Nivel de confianza (0-1)
3. Tres recomendaciones priorizadas para mejorar salud financiera

Responde SOLO con JSON válido en este formato exacto:
{
  "predictions": [
    {"month": 1, "revenue": number, "confidence": number},
    {"month": 2, "revenue": number, "confidence": number},
    {"month": 3, "revenue": number, "confidence": number},
    {"month": 4, "revenue": number, "confidence": number},
    {"month": 5, "revenue": number, "confidence": number},
    {"month": 6, "revenue": number, "confidence": number}
  ],
  "recommendations": [
    {"title": "string", "description": "string", "priority": "high|medium|low", "impact": number, "timeline": "string"},
    {"title": "string", "description": "string", "priority": "high|medium|low", "impact": number, "timeline": "string"},
    {"title": "string", "description": "string", "priority": "high|medium|low", "impact": number, "timeline": "string"}
  ]
}
`;

    // Llamar a Groq API
    const response = await fetch(`${groqBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: "Eres un analista financiero experto. Respondes SOLO con JSON válido, sin markdown ni explicaciones adicionales.",
          },
          {
            role: "user",
            content: context,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Groq API error:", errorText);
      return { success: false, error: `Error de Groq API: ${response.statusText}` };
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;

    if (!aiResponse) {
      return { success: false, error: "No se recibió respuesta de IA" };
    }

    // Parsear respuesta JSON
    let parsedData;
    try {
      // Limpiar markdown si existe
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      const cleanedResponse = jsonMatch ? jsonMatch[0] : aiResponse;
      parsedData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error("Error parsing AI response:", aiResponse);
      return { success: false, error: "Error al parsear respuesta de IA" };
    }

    return {
      success: true,
      data: parsedData,
    };
  } catch (error) {
    console.error("Error en predicciones IA:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}
