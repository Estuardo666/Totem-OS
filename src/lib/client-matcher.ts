/**
 * Client Matcher Service
 * Intelligent client matching by name from event titles and attendee emails
 *
 * @fileoverview Used by Calendar → App sync to auto-assign clients to imported shoots
 */

import { db } from "@/lib/db";
import type { Client } from "@prisma/client";

type ClientMatchCandidate = Pick<Client, "id" | "name" | "contactEmails">;

export interface MatchResult {
  clientId: string;
  confidence: "exact" | "partial" | "email" | "default";
  matchedName?: string;
}

/**
 * Normaliza texto para comparación: lowercase, sin acentos, sin espacios extras
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrae posible nombre de cliente del título del evento.
 * Patrones comunes:
 * - "Rodaje AMACA"
 * - "Rodaje: Nombre Cliente"
 * - "Grabación con Cliente X"
 * - "ClienteX - Sesión fotos"
 */
function extractClientHintFromTitle(title: string): string {
  const normalized = normalize(title);

  // Remove common prefixes
  const prefixes = [
    /^rodaje[:\s]+/,
    /^grabacion[:\s]+/,
    /^grabación[:\s]+/,
    /^sesion[:\s]+de\s+/,
    /^sesión[:\s]+de\s+/,
    /^filmacion[:\s]+/,
    /^filmación[:\s]+/,
    /^video[:\s]+/,
    /^foto[:\s]+/,
    /^cita[:\s]+con\s+/,
    /^reunion[:\s]+con\s+/,
    /^reunión[:\s]+con\s+/,
  ];

  let cleaned = normalized;
  for (const prefix of prefixes) {
    cleaned = cleaned.replace(prefix, "");
  }

  // Remove "con " prefix
  cleaned = cleaned.replace(/^con\s+/, "");

  // Remove trailing dates/times
  cleaned = cleaned
    .replace(/\s+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}.*$/, "")
    .replace(/\s+\d{1,2}:\d{2}.*$/, "")
    .replace(/\s+\d{4}.*$/, "")
    .trim();

  return cleaned || normalized;
}

/**
 * Busca cliente por match exacto de nombre
 */
function findExactMatch(clients: ClientMatchCandidate[], hint: string): ClientMatchCandidate | null {
  const normalizedHint = normalize(hint);
  return (
    clients.find((c) => normalize(c.name) === normalizedHint) ?? null
  );
}

/**
 * Busca cliente por match parcial (el hint está contenido en el nombre o viceversa)
 */
function findPartialMatch(clients: ClientMatchCandidate[], hint: string): ClientMatchCandidate | null {
  const normalizedHint = normalize(hint);
  if (normalizedHint.length < 3) return null; // too short to match reliably

  // hint contained in client name
  const contained = clients.find((c) =>
    normalize(c.name).includes(normalizedHint)
  );
  if (contained) return contained;

  // client name contained in hint
  return (
    clients.find((c) => {
      const name = normalize(c.name);
      return name.length >= 3 && normalizedHint.includes(name);
    }) ?? null
  );
}

/**
 * Busca cliente por email de attendees contra contactEmails del cliente
 */
function findEmailMatch(
  clients: ClientMatchCandidate[],
  attendeeEmails: string[]
): ClientMatchCandidate | null {
  if (attendeeEmails.length === 0) return null;

  for (const client of clients) {
    const raw = client.contactEmails;
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as string[];
      if (!Array.isArray(parsed)) continue;

      for (const attendeeEmail of attendeeEmails) {
        const normalizedAttendee = attendeeEmail.toLowerCase().trim();
        if (
          parsed.some(
            (ce: string) => ce.toLowerCase().trim() === normalizedAttendee
          )
        ) {
          return client;
        }
      }
    } catch {
      // Skip malformed contactEmails
    }
  }

  return null;
}

/**
 * Obtiene o crea el cliente "Sin Asignar" para eventos sin match
 */
async function getOrCreateDefaultClient(): Promise<string> {
  const defaultName = "Sin Asignar";

  const existing = await db.client.findFirst({
    where: {
      name: { equals: defaultName, mode: "insensitive" },
    },
  });

  if (existing) return existing.id;

  // Create the default client
  const created = await db.client.create({
    data: {
      name: defaultName,
      brandKit: JSON.stringify({
        primaryColor: "#6b7280",
        secondaryColor: "#9ca3af",
      }),
    },
  });

  return created.id;
}

/**
 * Matches a calendar event to an existing client.
 * Priority: exact name > partial name > email match > default "Sin Asignar"
 *
 * @param eventTitle - Calendar event summary (e.g. "Rodaje AMACA")
 * @param eventDescription - Calendar event description (optional)
 * @param attendeeEmails - Emails of event attendees (optional)
 * @returns clientId and confidence level
 */
export async function matchClientFromCalendarEvent(
  eventTitle: string,
  eventDescription?: string,
  attendeeEmails?: string[]
): Promise<MatchResult> {
  const clients = await db.client.findMany({
    select: {
      id: true,
      name: true,
      contactEmails: true,
    },
  });

  if (clients.length === 0) {
    const defaultId = await getOrCreateDefaultClient();
    return { clientId: defaultId, confidence: "default" };
  }

  // Extract hint from title
  const hint = extractClientHintFromTitle(eventTitle);

  // 1. Exact match
  const exact = findExactMatch(clients, hint);
  if (exact) {
    return {
      clientId: exact.id,
      confidence: "exact",
      matchedName: exact.name,
    };
  }

  // 2. Partial match
  const partial = findPartialMatch(clients, hint);
  if (partial) {
    return {
      clientId: partial.id,
      confidence: "partial",
      matchedName: partial.name,
    };
  }

  // 3. Email match
  const emailMatch = findEmailMatch(clients, attendeeEmails ?? []);
  if (emailMatch) {
    return {
      clientId: emailMatch.id,
      confidence: "email",
      matchedName: emailMatch.name,
    };
  }

  // 4. Default
  const defaultId = await getOrCreateDefaultClient();
  return { clientId: defaultId, confidence: "default" };
}
