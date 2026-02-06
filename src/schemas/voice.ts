import { z } from "zod";

export const voiceCommandInputSchema = z.object({
  transcript: z
    .string()
    .min(3, "La transcripción es demasiado corta para interpretar"),
});

export const voiceCommandResponseSchema = z.object({
  type: z.enum(["task", "shoot"]),
  title: z.string().default(""),
  details: z.string().default(""),
  pieceType: z.enum(["REEL", "FLYER", "STORY"]).optional(),
  suggestedDate: z.string().optional(),
  suggestedClient: z.string().optional(),
  suggestedStartTime: z.string().optional(),
  suggestedEndTime: z.string().optional(),
});

export type VoiceCommandInput = z.infer<typeof voiceCommandInputSchema>;
export type VoiceCommandResult = z.infer<typeof voiceCommandResponseSchema>;

// ============================================
// Conversational Voice Types
// ============================================

export type ConversationStep = "idle" | "listening" | "processing" | "speaking" | "awaiting_input";

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface ConversationData {
  title?: string;
  clientId?: string;
  clientName?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  pieceType?: string;
  details?: string;
  dueDate?: string;
}

export interface ConversationContext {
  intent: "task" | "shoot" | null;
  data: ConversationData;
  missingFields: string[];
  messages: ConversationMessage[];
  step: ConversationStep;
  awaitingConfirmation: boolean;
}

export const ttsProviderSchema = z.enum(["web-speech", "google-tts"]);
export type TTSProvider = z.infer<typeof ttsProviderSchema>;

export const googleTtsVoiceSchema = z.enum([
  "es-US-Neural2-A",
  "es-US-Neural2-B",
  "es-US-Neural2-C",
]);
export type GoogleTTSVoice = z.infer<typeof googleTtsVoiceSchema>;
