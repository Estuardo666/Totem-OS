import { callOpenAIRaw } from "./providers/openai";
import { callGrokRaw } from "./providers/grok";
import { callDeepSeekRaw } from "./providers/deepseek";
import { callGoogleRaw } from "./providers/google";

export interface AIConfig {
  provider: "openai" | "grok" | "deepseek" | "google";
  apiKey: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  [key: string]: any;
}

/**
 * Función Maestra (Dispatcher)
 * Recibe la intención y la delega al adaptador correspondiente.
 */
export async function callAIProvider(
  provider: string,
  apiKey: string,
  messages: any[],
  config: Partial<AIConfig> = {}
): Promise<string> {
  
  // Normalizar el proveedor a minúsculas para evitar errores de tipo "OpenAI" vs "openai"
  const normalizedProvider = provider.toLowerCase();

  switch (normalizedProvider) {
    case "openai":
      // OpenAI recibe baseUrl por separado en nuestro adaptador
      return callOpenAIRaw(apiKey, messages, config, config.baseUrl);
    
    case "grok":
      return callGrokRaw(apiKey, messages, config);
    
    case "deepseek":
      return callDeepSeekRaw(apiKey, messages, config);
    
    case "google":
      return callGoogleRaw(apiKey, messages, config);
      
    default:
      throw new Error(`Proveedor de IA no soportado: ${provider}`);
  }
}

