const MONTHS = "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split(" ");
const STOP_WORDS = new Set(["el", "la", "los", "las", "de", "del", "un", "una", "para", "por", "con", "y", "en", "video"]);

export function normalizeWhatsAppText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function normalizeVideoFileName(value: string, names: string[] = []): string {
  let normalized = normalizeWhatsAppText(value.replace(/\.[a-z0-9]{2,5}$/i, ""));
  normalized = normalized.replace(/\bv\s*\d+\b/g, " ").replace(/\b\d+\b/g, " ");
  for (const month of MONTHS) normalized = normalized.replace(new RegExp(`\\b${month}\\b`, "g"), " ");
  for (const name of names) {
    const normalizedName = normalizeWhatsAppText(name);
    if (normalizedName) normalized = normalized.replace(new RegExp(`\\b${escapeRegExp(normalizedName)}\\b`, "g"), " ");
  }
  const result: string[] = [];
  for (const word of normalized.split(/\s+/)) {
    if (!word || STOP_WORDS.has(word) || result[result.length - 1] === word) continue;
    result.push(word);
  }
  return result.join(" ").trim();
}

export function classifyWhatsAppIntent(text: string): "APPROVE" | "CHANGES" | "QUESTION" | "OTHER" {
  const normalized = normalizeWhatsAppText(text);
  if (/\b(cambio|cambios|corregir|correcciones|ajustar|modificar|no me gusta|no esta bien|no está bien|por favor cambia)\b/.test(normalized)) return "CHANGES";
  if (text.trim().endsWith("?") || /\b(que|cuando|como|donde|por que|cual|quien|podrian|podrian)\b/.test(normalized)) return "QUESTION";
  if (/\b(no aprobado|no aprobada|no lo apruebo|no me convence|todavia no|aun no)\b/.test(normalized)) return "OTHER";
  if (/\b(aprobado|aprobada|apruebo|perfecto|ok|okay|listo|bien|me gusta|dale|si|sí)\b/.test(normalized)) return "APPROVE";
  return "OTHER";
}

export function parseOwnerAnswer(text: string, openIds: string[]): { id: string | null; answer: "1" | "2" | "3" | "4" } | null {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const explicit = normalized.match(/^#?([a-z0-9][a-z0-9_-]{1,31})\s+(1|2|3|4)$/i);
  if (explicit) {
    const id = openIds.find((candidate) => candidate.toLowerCase() === explicit[1].toLowerCase());
    return id ? { id, answer: explicit[2] as "1" | "2" | "3" | "4" } : null;
  }
  const answer = normalized.match(/^(1|2|3|4|si|no)$/);
  if (!answer) return null;
  const mapped = answer[1] === "si" ? "1" : answer[1] === "no" ? "2" : answer[1];
  if (openIds.length !== 1) return null;
  return { id: openIds[0], answer: mapped as "1" | "2" | "3" | "4" };
}

export function isActiveSchedule(schedule: unknown, at = new Date()): boolean {
  if (!schedule || typeof schedule !== "object") return false;
  const value = schedule as { type?: string; days?: number[]; from?: number; to?: number };
  if (value.type === "weekdays" && Array.isArray(value.days)) {
  const ecuador = new Date(at.getTime() - 5 * 60 * 60 * 1000);
    const day = (ecuador.getUTCDay() + 6) % 7 + 1;
    return value.days.includes(day);
  }
  if (value.type === "monthRange" && Number.isInteger(value.from) && Number.isInteger(value.to)) {
    const day = new Date(at.getTime() - 5 * 60 * 60 * 1000).getUTCDate();
    return day >= Number(value.from) && day <= Number(value.to);
  }
  return false;
}

export function ecuadorDayStart(at = new Date()): Date {
  const ecuador = new Date(at.getTime() - 5 * 60 * 60 * 1000);
  return new Date(Date.UTC(ecuador.getUTCFullYear(), ecuador.getUTCMonth(), ecuador.getUTCDate(), 5));
}

export function tokenSetSimilarity(left: string, right: string): number {
  const a = new Set(normalizeWhatsAppText(left).split(" ").filter((word) => word && !STOP_WORDS.has(word)));
  const b = new Set(normalizeWhatsAppText(right).split(" ").filter((word) => word && !STOP_WORDS.has(word)));
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  return intersection / Math.max(a.size, b.size);
}

export function parseCandidateChoice(raw: string, candidates: Array<{ id: string }>): { taskId: string; confidence: number } | null {
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as { taskId?: unknown; confidence?: unknown };
    const taskId = typeof parsed.taskId === "string" ? parsed.taskId : "";
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;
    if (!taskId || confidence < 0.8 || !candidates.some((candidate) => candidate.id === taskId)) return null;
    return { taskId, confidence };
  } catch {
    return null;
  }
}

function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
