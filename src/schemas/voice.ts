import { z } from "zod";

export const voiceCommandInputSchema = z.object({
  transcript: z
    .string()
    .min(8, "La transcripción es demasiado corta para interpretar"),
});

export const voiceCommandResponseSchema = z.object({
  type: z.enum(["task", "shoot"]),
  title: z.string().min(1, "El título es requerido"),
  details: z.string().min(1, "Los detalles son requeridos"),
  pieceType: z.enum(["REEL", "FLYER", "STORY"]).optional(),
  suggestedDate: z.string().optional(),
  suggestedClient: z.string().optional(),
  suggestedStartTime: z.string().optional(),
  suggestedEndTime: z.string().optional(),
});

export type VoiceCommandInput = z.infer<typeof voiceCommandInputSchema>;
export type VoiceCommandResult = z.infer<typeof voiceCommandResponseSchema>;
