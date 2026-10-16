/**
 * Turno del asistente sin streaming: lo usa la voz en vivo, que delega en el
 * "modelo pensador" mediante una sola herramienta (`asistente`).
 *
 * Devuelve el texto para que la voz lo lea y, aparte, los borradores. El
 * draftToken va al navegador para el botón/confirmación por voz, pero nunca
 * al modelo de voz.
 */

import { generateText, stepCountIs, type ModelMessage } from "ai";
import { getAssistantModel } from "./config";
import { buildAssistantTools, type AssistantUser } from "./tools";
import { buildSystemPrompt } from "./prompt";

export interface AgentDraft {
  action: string;
  summary: Record<string, string | number | null>;
  draftToken: string;
}

export interface AgentTurn {
  text: string;
  drafts: AgentDraft[];
}

export async function runAssistantTurn(
  user: AssistantUser,
  messages: ModelMessage[]
): Promise<AgentTurn | { error: string }> {
  const resolved = await getAssistantModel();
  if ("error" in resolved) return resolved;

  const result = await generateText({
    model: resolved.model,
    system: buildSystemPrompt(user, "voice"),
    messages,
    tools: buildAssistantTools(user),
    stopWhen: stepCountIs(6),
    maxOutputTokens: 600,
  });

  const drafts: AgentDraft[] = [];
  for (const step of result.steps) {
    for (const r of step.toolResults) {
      const out = r.output as Partial<AgentDraft> & { status?: string };
      if (out?.status === "requires_confirmation" && out.draftToken && out.action && out.summary) {
        drafts.push({ action: out.action, summary: out.summary, draftToken: out.draftToken });
      }
    }
  }

  return { text: result.text.trim(), drafts };
}
