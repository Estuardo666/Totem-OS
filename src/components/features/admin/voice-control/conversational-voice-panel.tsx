"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Mic,
  MicOff,
  Send,
  Loader2,
  Check,
  Volume2,
  VolumeX,
  RotateCcw,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getTTS, GOOGLE_TTS_VOICES } from "@/lib/tts";
import { useToast } from "@/components/ui/use-toast";
import { interpretVoiceCommandAction } from "@/actions/voice-actions";
import { createShooting, type CreateShootingInput } from "@/actions/shooting-actions";
import type { ShootWithRelations } from "@/lib/shooting-service";
import { ShootingDetail } from "@/components/features/shoots/shooting-detail";
import { createTask } from "@/actions/content-actions";
import { type CreateContentTaskInput } from "@/schemas/content";
import type {
  ConversationMessage,
  ConversationContext,
  ConversationData,
  TTSProvider,
  GoogleTTSVoice,
} from "@/schemas/voice";
import type { VoiceCommandResult } from "@/schemas/voice";
import type { Client } from "@prisma/client";

// ============================================
// Helper Functions
// ============================================

const normalizeText = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\b(dr\.?|doctor(a)?|lic\.?|sr\.?|sra\.?|srta\.?)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

const matchClientId = (
  clients: Pick<Client, "id" | "name">[],
  needle?: string
): string | undefined => {
  if (!needle) return undefined;
  const target = normalizeText(needle);
  const exact = clients.find((c) => normalizeText(c.name) === target);
  if (exact) return exact.id;
  const partial = clients.find((c) => target.includes(normalizeText(c.name)));
  if (partial) return partial.id;
  const reverse = clients.find((c) => normalizeText(c.name).includes(target));
  if (reverse) return reverse.id;
  return undefined;
};

const matchClientIdWithFallback = (
  clients: Pick<Client, "id" | "name">[],
  primary?: string,
  fallbackText?: string
): string | undefined => {
  const fromPrimary = matchClientId(clients, primary);
  if (fromPrimary) return fromPrimary;
  if (!fallbackText) return undefined;
  return matchClientId(clients, fallbackText);
};

const parseNaturalDate = (input?: string): Date | undefined => {
  if (!input) return undefined;
  
  const cleaned = input.toLowerCase().trim();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // 1. Palabras clave: hoy, mañana, pasado mañana
  if (cleaned.includes("hoy")) return new Date(today);
  if (cleaned.includes("mañana") || cleaned.includes("manana")) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  if (cleaned.includes("pasado mañana") || cleaned.includes("pasado manana")) {
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    return dayAfter;
  }
  
  // 2. Formato dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy
  const slashMatch = cleaned.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (slashMatch) {
    const dd = Number(slashMatch[1]);
    const mm = Number(slashMatch[2]);
    let yyyy = Number(slashMatch[3]);
    if (yyyy < 100) yyyy += 2000; // 26 -> 2026
    if (dd > 0 && dd <= 31 && mm > 0 && mm <= 12) {
      return new Date(yyyy, mm - 1, dd);
    }
  }
  
  // 3. Lenguaje natural en español: "7 de febrero", "sábado 7 de febrero del 2026"
  const monthNames = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];
  
  // Extraer día (número)
  const dayMatch = cleaned.match(/\b(\d{1,2})\s+de\b/);
  if (dayMatch) {
    const day = Number(dayMatch[1]);
    
    // Extraer mes (nombre)
    let monthIndex = -1;
    for (let i = 0; i < monthNames.length; i++) {
      if (cleaned.includes(monthNames[i])) {
        monthIndex = i;
        break;
      }
    }
    
    if (monthIndex >= 0 && day > 0 && day <= 31) {
      // Extraer año (opcional)
      const yearMatch = cleaned.match(/\b(20\d{2})\b/);
      const year = yearMatch ? Number(yearMatch[1]) : today.getFullYear();
      
      const result = new Date(year, monthIndex, day);
      
      // Si la fecha ya pasó este año, usar el próximo año
      if (result < today && !yearMatch) {
        result.setFullYear(year + 1);
      }
      
      return result;
    }
  }
  
  // 4. Días de la semana: "este viernes", "próximo lunes", "el sábado"
  const dayNames = ["domingo", "lunes", "martes", "miércoles", "miercoles", "jueves", "viernes", "sábado", "sabado"];
  const dayOfWeekMap: { [key: string]: number } = {
    domingo: 0, lunes: 1, martes: 2, "miércoles": 3, miercoles: 3,
    jueves: 4, viernes: 5, "sábado": 6, sabado: 6
  };
  
  for (const dayName of dayNames) {
    if (cleaned.includes(dayName)) {
      const targetDay = dayOfWeekMap[dayName];
      if (targetDay !== undefined) {
        const currentDay = today.getDay();
        let daysToAdd = targetDay - currentDay;
        
        // Si es el mismo día o ya pasó, ir a la próxima semana
        if (daysToAdd <= 0) {
          daysToAdd += 7;
        }
        
        // Si dice "próximo" o "siguiente", agregar una semana más
        if (cleaned.includes("próximo") || cleaned.includes("proximo") || cleaned.includes("siguiente")) {
          daysToAdd += 7;
        }
        
        const result = new Date(today);
        result.setDate(result.getDate() + daysToAdd);
        return result;
      }
    }
  }
  
  return undefined;
};

const parseDDMMYYYY = parseNaturalDate; // Alias para compatibilidad

const formatDateToDDMMYYYY = (date: Date): string => {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const parseTimeToHHMM = (raw?: string): string => {
  if (!raw) return "";
  const cleaned = raw.trim().toLowerCase();
  const ampmMatch = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (ampmMatch) {
    let hours = Number(ampmMatch[1]);
    const minutes = Number(ampmMatch[2] ?? "0");
    const suffix = ampmMatch[3];
    if (suffix === "pm" && hours < 12) hours += 12;
    if (suffix === "am" && hours === 12) hours = 0;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  const hhmmMatch = cleaned.match(/^(\d{1,2})(?::(\d{2}))?/);
  if (hhmmMatch) {
    const hours = Number(hhmmMatch[1]);
    const minutes = Number(hhmmMatch[2] ?? "0");
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }
  return "";
};

const getClientName = (
  clients: Pick<Client, "id" | "name">[],
  clientId?: string
): string | undefined => {
  if (!clientId) return undefined;
  return clients.find((c) => c.id === clientId)?.name;
};

const detectConfirmation = (text: string): boolean => {
  const normalized = text.toLowerCase().trim();
  const affirmativeWords = [
    "ok", "okay", "okey", "vale", "bien", "está bien", "esta bien",
    "sí", "si", "síp", "sip", "yeah", "yes", "correcto", "perfecto",
    "adelante", "dale", "confirmar", "confirma", "crear", "crea",
    "procede", "proceder", "hazlo", "házlo", "continuar", "continúa"
  ];
  return affirmativeWords.some(word => normalized === word || normalized.includes(word));
};

const detectCancellation = (text: string): boolean => {
  const normalized = text.toLowerCase().trim();
  const cancellationWords = [
    "nada", "cancelar", "cancela", "salir", "sal", "no", "no quiero",
    "olvídalo", "olvidalo", "déjalo", "dejalo", "terminar", "termina",
    "cerrar", "cierra", "adiós", "adios", "chao", "bye"
  ];
  return cancellationWords.some(word => normalized === word || normalized.includes(word));
};

// ============================================
// Speech Recognition Types
// ============================================

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item: (index: number) => SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item: (index: number) => SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence?: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

const getSpeechRecognitionConstructor = (): SpeechRecognitionConstructor | null => {
  if (typeof window === "undefined") return null;
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
};

// ============================================
// Component Props
// ============================================

interface ConversationalVoicePanelProps {
  clients: Pick<Client, "id" | "name" | "logo" | "color">[];
  users: { id: string; name: string | null; email: string | null }[];
}

// ============================================
// Main Component
// ============================================

export function ConversationalVoicePanel({
  clients,
  users,
}: ConversationalVoicePanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();

  // Get user's first name for greeting
  const userFirstName = useMemo(() => {
    if (!session?.user?.name) return null;
    const nameParts = session.user.name.split(" ");
    return nameParts[0] || null;
  }, [session?.user?.name]);

  // Default crew: Paty y Stuart
  const defaultCrewIds = useMemo(() => {
    const paty = users.find((u) => u.email === "totemcisnemedia@gmail.com");
    const stuart = users.find((u) => u.email === "estuarlito@gmail.com");
    return [paty?.id, stuart?.id].filter(Boolean) as string[];
  }, [users]);

  // TTS Settings
  const [ttsProvider, setTtsProvider] = useState<TTSProvider>("google-tts");
  const [ttsVoice, setTtsVoice] = useState<GoogleTTSVoice>("es-US-Neural2-A");
  const [ttsEnabled, setTtsEnabled] = useState(true);

  // Conversation State
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [context, setContext] = useState<ConversationContext>({
    intent: null,
    data: {},
    missingFields: [],
    messages: [],
    step: "idle",
    awaitingConfirmation: false,
  });

  // Input State
  const [textInput, setTextInput] = useState("");
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");

  // Processing State
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [readyToCreate, setReadyToCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Post-creation popup state
  const [createdShooting, setCreatedShooting] = useState<ShootWithRelations | null>(null);
  const [showShootingDetail, setShowShootingDetail] = useState(false);
  
  // Token counter for Google TTS
  const [ttsTokensUsed, setTtsTokensUsed] = useState(0);
  
  // Client-only state for hydration safety
  const [isWebSpeechSupported, setIsWebSpeechSupported] = useState(false);

  // Refs
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ttsRef = useRef(getTTS(ttsProvider, ttsVoice));
  const contextRef = useRef<ConversationContext>(context);
  const isFirstRenderRef = useRef(true);

  // ============================================
  // Effects
  // ============================================

  // Detect Web Speech API support on client only (prevents hydration mismatch)
  useEffect(() => {
    setIsWebSpeechSupported(!!getSpeechRecognitionConstructor());
  }, []);

  // Auto-scroll to latest message
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Update TTS instance when provider/voice changes
  useEffect(() => {
    ttsRef.current = getTTS(ttsProvider, ttsVoice);
  }, [ttsProvider, ttsVoice]);

  // Keep contextRef in sync with context state
  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechCtor = getSpeechRecognitionConstructor();
    if (!SpeechCtor) return;

    const recognition = new SpeechCtor();
    recognition.lang = "es-ES";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();

      if (transcript) {
        // Use contextRef to avoid stale closure
        const currentContext = contextRef.current;
        handleUserInputWithContext(transcript, currentContext);
      }
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setError(`Error de reconocimiento: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      // Clear timeout if exists
      const timeoutId = (recognitionRef.current as any)?.__timeoutId;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      recognitionRef.current?.stop();
      ttsRef.current.cancel();
    };
  }, []);

  // ============================================
  // TTS Functions
  // ============================================

  const speakMessage = useCallback(
    (text: string, onEnd?: () => void) => {
      console.log("[TTS] speakMessage called:", { text, ttsEnabled, ttsProvider, ttsVoice });
      
      if (!ttsEnabled) {
        console.warn("[TTS] TTS is disabled, skipping speech");
        onEnd?.();
        return;
      }

      // Count characters for Google TTS
      if (ttsProvider === "google-tts") {
        const charCount = text.length;
        setTtsTokensUsed(prev => prev + charCount);
      }

      console.log("[TTS] Calling ttsRef.current.speak()");
      ttsRef.current.speak(text, {
        rate: 1.01,
        voice: ttsVoice,
        onEnd: () => {
          console.log("[TTS] Speech ended successfully");
          setContext((prev) => ({ ...prev, step: "awaiting_input" }));
          onEnd?.();
        },
        onError: (error) => {
          if (error instanceof Error) {
            console.warn("[TTS] Speech error:", error.message);
          } else {
            console.warn("[TTS] Speech error:", error);
          }
          // Continue even if TTS fails
          setContext((prev) => ({ ...prev, step: "awaiting_input" }));
          onEnd?.();
        },
      });
    },
    [ttsEnabled, ttsVoice, ttsProvider]
  );

  // ============================================
  // Message Functions
  // ============================================

  const addMessage = useCallback(
    (role: "user" | "assistant", content: string): ConversationMessage => {
      const msg: ConversationMessage = {
        id: crypto.randomUUID(),
        role,
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, msg]);
      return msg;
    },
    []
  );

  // ============================================
  // Intent Analysis
  // ============================================

  const analyzeIntent = useCallback(
    async (userMessage: string): Promise<string> => {
      try {
        console.log("[Voice] Analyzing:", userMessage);
        const result = await interpretVoiceCommandAction({
          transcript: userMessage,
        });
        console.log("[Voice] AI Result:", JSON.stringify(result, null, 2));

        if (!result.success || !result.data) {
          console.warn("[Voice] Failed:", result.error);
          return "No entendí bien. ¿Podrías repetir lo que necesitas?";
        }

        // Cast to VoiceCommandResult type
        const data = result.data as VoiceCommandResult;
        const {
          type,
          suggestedClient,
          suggestedDate,
          suggestedStartTime,
          suggestedEndTime,
          title,
          details,
          pieceType,
        } = data;

        // Validate that intent type is valid (shoot or task)
        if (type !== "shoot" && type !== "task") {
          console.log(`[Voice] Invalid intent type: "${type}". Expected "shoot" or "task".`);
          return "Di 'crear rodaje' o 'crear tarea' para comenzar.";
        }

        const newData: ConversationData = { ...context.data };

        // Process shoot intent
        if (type === "shoot") {
          console.log(
            `[Voice] Shoot intent detected. Current data: ${JSON.stringify(newData)}`
          );
          setContext((prev) => ({ ...prev, intent: "shoot" }));

          // Process client
          if (suggestedClient) {
            console.log(
              `[Voice] ⚠️  AI suggested client: "${suggestedClient}" from user message: "${userMessage}"`
            );
            const normalizedMessage = userMessage.toLowerCase();
            const normalizedSuggested = suggestedClient.toLowerCase();
            if (!normalizedMessage.includes(normalizedSuggested)) {
              console.log(
                `[Voice] Ignoring suggested client not in transcript: "${suggestedClient}"`
              );
            } else {
              const clientId = matchClientIdWithFallback(
                clients,
                suggestedClient,
                userMessage
              );
              if (clientId) {
                console.log(
                  `[Voice] Updating client from AI: ${suggestedClient} -> ${clientId}`
                );
                newData.clientId = clientId;
                newData.clientName = getClientName(clients, clientId);
              }
            }
          }

          // Process date
          if (suggestedDate) {
            console.log(`[Voice] Updating date from AI: "${suggestedDate}"`);
            newData.date = suggestedDate;
          }

          // Process time
          if (suggestedStartTime) {
            const parsed = parseTimeToHHMM(suggestedStartTime);
            if (parsed) newData.startTime = parsed;
          }

          if (suggestedEndTime) {
            const parsed = parseTimeToHHMM(suggestedEndTime);
            if (parsed) newData.endTime = parsed;
          }

          if (title && title.length > 0) {
            console.log(`[Voice] Updating title from AI: "${title}"`);
            newData.title = title;
          }
          if (pieceType) newData.pieceType = pieceType;
          if (details) newData.details = details;

          // Determine missing fields - shoots require: cliente, FECHA, HORA
          const missing: string[] = [];
          if (!newData.clientId) missing.push("cliente");
          if (!newData.date) missing.push("fecha");
          if (!newData.startTime) missing.push("hora");

          console.log(
            `[Voice] Shoot missing fields: ${JSON.stringify(missing)}`
          );

          setContext((prev) => ({
            ...prev,
            intent: "shoot",
            data: newData,
            missingFields: missing,
            awaitingConfirmation: missing.length === 0,
          }));

          if (missing.length === 0) {
            setReadyToCreate(true);
          }

          // Generate response
          if (missing.length === 0) {
            return `Perfecto. Voy a crear un rodaje para ${newData.clientName || "cliente"} el ${newData.date} a las ${newData.startTime}. ¿Está bien?`;
          } else {
            const next = missing[0];
            if (next === "cliente")
              return "¿Para qué cliente es el rodaje?";
            if (next === "fecha") return "¿Qué día será el rodaje?";
            if (next === "hora") return "¿A qué hora será el rodaje?";
          }
        }

        // Process task intent
        else if (type === "task") {
          console.log(
            `[Voice] Task intent detected. Current data: ${JSON.stringify(newData)}`
          );
          setContext((prev) => ({ ...prev, intent: "task" }));

          // Only update fields if they have actual values from the AI
          if (title && title.length > 0) {
            console.log(`[Voice] Updating title from AI: "${title}"`);
            newData.title = title;
          }
          if (details && details.length > 0) newData.details = details;
          if (pieceType) newData.pieceType = pieceType;

          if (suggestedDate) {
            newData.dueDate = suggestedDate;
          }

          if (suggestedClient) {
            const normalizedMessage = userMessage.toLowerCase();
            const normalizedSuggested = suggestedClient.toLowerCase();
            if (!normalizedMessage.includes(normalizedSuggested)) {
              console.log(
                `[Voice] Ignoring suggested client not in transcript: "${suggestedClient}"`
              );
            } else {
              const clientId = matchClientIdWithFallback(
                clients,
                suggestedClient,
                userMessage
              );
              if (clientId) {
                console.log(
                  `[Voice] Updating client from AI: ${suggestedClient} -> ${clientId}`
                );
                newData.clientId = clientId;
                newData.clientName = getClientName(clients, clientId);
              }
            }
          }

          const missing: string[] = [];
          // Title is always required for tasks
          if (!newData.title || newData.title.length === 0)
            missing.push("título");
          if (!newData.clientId) missing.push("cliente");
          if (!newData.pieceType) missing.push("tipo");
          if (!newData.dueDate) missing.push("fecha de publicación");

          console.log(
            `[Voice] Task missing fields: ${JSON.stringify(missing)}`
          );

          setContext((prev) => ({
            ...prev,
            intent: "task",
            data: newData,
            missingFields: missing,
            awaitingConfirmation: missing.length === 0,
          }));

          if (missing.length === 0) {
            setReadyToCreate(true);
          }

          if (missing.length === 0) {
            const tipoTexto = newData.pieceType === "REEL" ? "reel" : newData.pieceType === "FLYER" ? "carrusel" : "contenido";
            const fechaTexto = newData.dueDate ? ` para el ${newData.dueDate}` : "";
            return `Perfecto. Voy a crear un ${tipoTexto} "${newData.title}" para ${newData.clientName}${fechaTexto}. ¿Está bien?`;
          } else {
            const next = missing[0];
            if (next === "título")
              return "¿Cuál es el título o nombre de la tarea?";
            if (next === "cliente") return "¿Para qué cliente es la tarea?";
            if (next === "tipo") return "¿Qué tipo de contenido? Di 'reel' o 'carrusel'.";
            if (next === "fecha de publicación") return "¿Para qué día es esta tarea?";
          }
        }

        return "Di 'crear rodaje' o 'crear tarea' para comenzar.";
      } catch (err) {
        console.error("Intent analysis error:", err);
        return "Hubo un error al procesar tu mensaje. ¿Podrías repetirlo?";
      }
    },
    [clients, context.data]
  );

  // ============================================
  // Fill Missing Fields Helper
  // ============================================

  const tryFillMissingField = useCallback(
    (
      userMessage: string,
      currentContext: ConversationContext
    ): { filled: boolean; remainingMissing: string[]; updatedData?: ConversationData } => {
      // Only try to fill if we have missing fields and an active intent
      if (
        currentContext.missingFields.length === 0 ||
        !currentContext.intent
      ) {
        return {
          filled: false,
          remainingMissing: currentContext.missingFields,
        };
      }

      const newData = { ...currentContext.data };
      let filled = false;
      let remainingMissing = [...currentContext.missingFields];
      const parsedDate = parseNaturalDate(userMessage);
      const parsedTime = parseTimeToHHMM(userMessage);

      console.log(`[Voice] Trying to fill missing fields: ${JSON.stringify(remainingMissing)}`);

      // Try to fill CLIENT/SUBJECT
      if (remainingMissing.includes("cliente") || remainingMissing.includes("subject")) {
        const clientId = matchClientIdWithFallback(clients, userMessage);
        console.log(
          `[Voice] Matching client "${userMessage}" | Available clients: ${clients.map((c) => c.name).join(", ")} | Matched: ${clientId || "NONE"}`
        );
        if (clientId) {
          newData.clientId = clientId;
          newData.clientName = getClientName(clients, clientId);
          filled = true;
          remainingMissing = remainingMissing.filter(
            (item) => item !== "cliente" && item !== "subject"
          );
          console.log(
            `[Voice] ✓ Filled client: ${newData.clientName} (${clientId})`
          );
        }
      }

      // Try to fill TITLE
      if (remainingMissing.includes("título") && userMessage.length > 0 && !parsedDate && !parsedTime) {
        newData.title = userMessage;
        filled = true;
        remainingMissing = remainingMissing.filter((item) => item !== "título");
        console.log(`[Voice] Filled title: ${userMessage}`);
      }

      // Try to fill PIECE TYPE (for tasks)
      if (remainingMissing.includes("tipo")) {
        const messageLower = userMessage.toLowerCase();
        if (messageLower.includes("reel") || messageLower.includes("video")) {
          newData.pieceType = "REEL";
          filled = true;
          remainingMissing = remainingMissing.filter((item) => item !== "tipo");
          console.log(`[Voice] ✓ Filled pieceType: REEL`);
        } else if (messageLower.includes("carrusel") || messageLower.includes("flyer") || messageLower.includes("imagen")) {
          newData.pieceType = "FLYER";
          filled = true;
          remainingMissing = remainingMissing.filter((item) => item !== "tipo");
          console.log(`[Voice] ✓ Filled pieceType: FLYER`);
        }
      }

      // Try to fill DATE - attempt fill regardless of order
      if (
        (remainingMissing.includes("fecha") || remainingMissing.includes("dueDate") || remainingMissing.includes("fecha de publicación")) &&
        parsedDate
      ) {
        const formatted = formatDateToDDMMYYYY(parsedDate);
        newData.date = formatted;
        newData.dueDate = formatted;
        filled = true;
        remainingMissing = remainingMissing.filter(
          (item) => item !== "fecha" && item !== "dueDate" && item !== "fecha de publicación"
        );
        console.log(`[Voice] ✓ Filled date: "${userMessage}" -> ${formatted}`);
      }

      // Try to fill TIME - attempt fill regardless of order
      if (remainingMissing.includes("hora") && parsedTime) {
        newData.startTime = parsedTime;
        // Auto-set end time 1 hour later if not set
        if (!newData.endTime) {
          const [h, m] = parsedTime.split(":").map(Number);
          newData.endTime = `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        }
        filled = true;
        remainingMissing = remainingMissing.filter((item) => item !== "hora");
        console.log(`[Voice] ✓ Filled time: ${parsedTime}`);
      }

      if (filled) {
        setContext((prev) => ({
          ...prev,
          data: newData,
          missingFields: remainingMissing,
        }));

        // Check if all fields are now filled
        if (remainingMissing.length === 0) {
          setReadyToCreate(true);
        }

        return { filled: true, remainingMissing, updatedData: newData };
      }

      return {
        filled: false,
        remainingMissing: currentContext.missingFields,
      };
    },
    [clients]
  );

  // ============================================
  // User Input Handler
  // ============================================

  const handleUserInputWithContext = useCallback(
    async (message: string, currentContext: ConversationContext) => {
      if (!message.trim()) return;

      console.log(
        `[Voice] handleUserInput: "${message}" | intent: ${currentContext.intent} | missingFields: ${JSON.stringify(currentContext.missingFields)}`
      );

      setIsProcessing(true);
      setError(null);
      setSuccess(null);
      ttsRef.current.cancel();

      setContext((prev) => ({ ...prev, step: "processing" }));
      addMessage("user", message);

      let response: string;

      // Check for cancellation first
      if (detectCancellation(message)) {
        console.log("[Voice] Cancellation detected, resetting conversation...");
        response = "Conversación cancelada. ¿En qué más puedo ayudarte?";
        addMessage("assistant", response);
        speakMessage(response);
        resetConversation();
        setIsProcessing(false);
        return;
      }

      // If awaiting confirmation, check for affirmative response
      if (currentContext.awaitingConfirmation) {
        if (detectConfirmation(message)) {
          console.log(`[Voice] Confirmation detected, creating ${currentContext.intent}...`);
          setContext((prev) => ({ ...prev, awaitingConfirmation: false }));
          // Trigger creation
          await handleCreate(currentContext);
          return; // handleCreate handles the response
        } else {
          console.log(`[Voice] Awaiting confirmation but not detected in: "${message}"`);
          response = "No entendí. ¿Quieres crear esto? Di 'sí' o 'está bien' para confirmar.";
          addMessage("assistant", response);
          setContext((prev) => ({ ...prev, step: "speaking" }));
          speakMessage(response, () => {
            if (inputMode === "voice") {
              setTimeout(() => startListening(), 100);
            }
          });
          setIsProcessing(false);
          return;
        }
      }

      // If we have an active intent and missing fields, ONLY try to fill them
      if (currentContext.intent && currentContext.missingFields.length > 0) {
        const { filled, remainingMissing, updatedData } = tryFillMissingField(message, currentContext);
        console.log(
          `[Voice] tryFillMissingField result: filled=${filled}, remainingMissing=${JSON.stringify(remainingMissing)}`
        );

        if (filled) {
          // Successfully filled a field - check if all fields are now complete
          if (remainingMissing.length === 0 && updatedData) {
            // All fields filled, generate confirmation message
                       setReadyToCreate(true); // Ensure ready before awaiting confirmation
            setContext((prev) => ({ ...prev, awaitingConfirmation: true }));
            if (currentContext.intent === "shoot") {
              response = `Perfecto. Voy a crear un rodaje para ${updatedData.clientName || "el cliente"} el ${updatedData.date} a las ${updatedData.startTime}. ¿Está bien?`;
            } else if (currentContext.intent === "task") {
              const tipoTexto = updatedData.pieceType === "REEL" ? "reel" : updatedData.pieceType === "FLYER" ? "carrusel" : "contenido";
              const fechaTexto = updatedData.dueDate ? ` para el ${updatedData.dueDate}` : "";
              response = `Perfecto. Voy a crear un ${tipoTexto} "${updatedData.title}" para ${updatedData.clientName || "el cliente"}${fechaTexto}. ¿Está bien?`;
            } else {
              response = `Perfecto. ¿Confirmas la creación? Di 'sí' o 'está bien'.`;
            }
          } else {
            // Ask for next field
            const next = remainingMissing[0];
            if (currentContext.intent === "shoot") {
              if (next === "cliente") response = "¿Para qué cliente es el rodaje?";
              else if (next === "fecha") response = "¿Qué día será el rodaje?";
              else if (next === "hora") response = "¿A qué hora será?";
              else response = `¿${next}?`;
            } else if (currentContext.intent === "task") {
              if (next === "título") response = "¿Cuál es el título o nombre de la tarea?";
              else if (next === "cliente") response = "¿Para qué cliente es la tarea?";
              else if (next === "tipo") response = "¿Qué tipo de contenido? Di 'reel' o 'carrusel'.";
              else if (next === "fecha de publicación") response = "¿Para qué día es esta tarea?";
              else response = `¿${next}?`;
            } else {
              response = `¿${next}?`;
            }
          }
        } else {
          // Failed to fill - re-ask the same field instead of re-analyzing
          const next = currentContext.missingFields[0];
          console.log(`[Voice] Failed to fill "${next}", re-asking...`);
          if (currentContext.intent === "shoot") {
            if (next === "cliente") response = "No encontré ese cliente. ¿Para quién es el rodaje?";
            else if (next === "fecha") response = "No entendí la fecha. ¿Qué día será? Ejemplo: 15/02/2026";
            else if (next === "hora") response = "No entendí la hora. ¿A qué hora? Ejemplo: 3pm o 15:00";
            else response = `No entendí. ¿${next}?`;
          } else if (currentContext.intent === "task") {
            if (next === "título") response = "¿Cuál es el nombre de la tarea?";
            else if (next === "cliente") response = "No encontré ese cliente. ¿Para quién es la tarea?";
            else if (next === "tipo") response = "No entendí. ¿Es un reel o un carrusel?";
            else if (next === "fecha de publicación") response = "No entendí la fecha. ¿Para qué día? Ejemplo: mañana, 15/02/2026";
            else response = `No entendí. ¿${next}?`;
          } else {
            response = `No entendí. ¿${next}?`;
          }
        }
      } else {
        // No active intent, analyze as new command
        console.log(`[Voice] No active intent, calling analyzeIntent`);
        response = await analyzeIntent(message);
      }

      addMessage("assistant", response);

      setContext((prev) => ({ ...prev, step: "speaking" }));
      speakMessage(response, () => {
        // Auto-start listening after speaking (voice mode only)
        if (inputMode === "voice") {
          // If awaiting confirmation, give more time and wait longer
          if (context.awaitingConfirmation) {
            console.log("[Voice] Awaiting confirmation - auto-starting listener with 2s timeout");
            setTimeout(() => startListening(), 500); // 500ms delay before listening
          } else if (!readyToCreate) {
            // Normal flow
            setTimeout(() => startListening(), 100); // 100ms delay for faster response
          }
        }
      });

      setIsProcessing(false);
      setTextInput("");
    },
    [addMessage, analyzeIntent, inputMode, readyToCreate, speakMessage, tryFillMissingField]
  );

  const handleUserInput = useCallback(
    (message: string) => {
      handleUserInputWithContext(message, context);
    },
    [handleUserInputWithContext, context]
  );

  // ============================================
  // Listening Controls
  // ============================================

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      ttsRef.current.cancel();
      setIsListening(true);
      setContext((prev) => ({ ...prev, step: "listening" }));

      try {
        recognitionRef.current.start();
        
        // Set timeout for auto-stop listening
        // Longer timeout for confirmation (5 seconds), shorter for normal (3 seconds)
        const timeout = contextRef.current.awaitingConfirmation ? 5000 : 3000;
        const timeoutId = setTimeout(() => {
          if (recognitionRef.current && isListening) {
            console.log("[Voice] Auto-stopping listener due to timeout");
            recognitionRef.current.stop();
          }
        }, timeout);
        
        // Store timeout ID in recognitionRef for cleanup if needed
        (recognitionRef.current as any).__timeoutId = timeoutId;
      } catch (error) {
        console.error("Failed to start recognition:", error);
        setIsListening(false);
        setError("No se pudo iniciar el reconocimiento de voz");
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      // Clear timeout if exists
      const timeoutId = (recognitionRef.current as any).__timeoutId;
      if (timeoutId) {
        clearTimeout(timeoutId);
        (recognitionRef.current as any).__timeoutId = null;
      }
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  // ============================================
  // Create Actions
  // ============================================

  const handleCreate = useCallback(async (overrideContext?: ConversationContext) => {
    const activeContext = overrideContext ?? context;
    if (!activeContext.intent) {
      setIsProcessing(false);
      return;
    }
    if (!readyToCreate && !overrideContext) {
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    ttsRef.current.cancel();
    setError(null);

    try {
      if (activeContext.intent === "shoot") {
        // Prepare shoot data
        const parsedDate = parseDDMMYYYY(activeContext.data.date);
        if (!parsedDate || !activeContext.data.clientId || !activeContext.data.startTime) {
          throw new Error("Faltan datos para crear el rodaje");
        }

        // Create start and end times
        const [startHour, startMin] = activeContext.data.startTime.split(":").map(Number);
        const startTime = new Date(parsedDate);
        startTime.setHours(startHour, startMin, 0, 0);

        let endTime: Date;
        if (activeContext.data.endTime) {
          const [endHour, endMin] = activeContext.data.endTime.split(":").map(Number);
          endTime = new Date(parsedDate);
          endTime.setHours(endHour, endMin, 0, 0);
        } else {
          endTime = new Date(startTime);
          endTime.setHours(endTime.getHours() + 1);
        }

        const shootData: CreateShootingInput = {
          title: activeContext.data.title || `Rodaje ${activeContext.data.clientName}`,
          clientId: activeContext.data.clientId!,
          startTime,
          endTime,
          notes: activeContext.data.details,
          crewIds: defaultCrewIds,
          taskIds: [],
        };

        const result = await createShooting(shootData);

        if (result.success && result.data) {
          // Store created shooting for detail popup
          setCreatedShooting(result.data);
          setShowShootingDetail(true);
          
          // Toast notification
          toast({
            title: "Rodaje creado",
            description: `Rodaje para ${activeContext.data.clientName} el ${activeContext.data.date} creado correctamente`,
          });

          // Check for calendar errors
          const calendarError = (result as { calendarError?: string | null }).calendarError;
          if (calendarError) {
            toast({
              variant: "destructive",
              title: "Google Calendar",
              description: calendarError,
            });
          }

          // Silent completion - don't speak or reset conversation
          // User should close popup to continue
          addMessage("assistant", "✓ Rodaje creado exitosamente");
          setSuccess("Rodaje creado");
          setIsProcessing(false);
        } else {
          throw new Error(result.error || "Error al crear rodaje");
        }
      } else if (activeContext.intent === "task") {
        // Prepare task data
        if (!activeContext.data.title) {
          throw new Error("Falta el título de la tarea");
        }

        if (!activeContext.data.clientId) {
          throw new Error("Falta el cliente para la tarea");
        }

        const dueDateParsed = activeContext.data.dueDate 
          ? parseDDMMYYYY(activeContext.data.dueDate) 
          : undefined;

        const taskData: CreateContentTaskInput = {
          title: activeContext.data.title,
          type: (activeContext.data.pieceType as "REEL" | "FLYER" | "STORY") || "REEL",
          status: "IDEA",
          priority: "MEDIUM",
          postCopy: activeContext.data.details,
          clientId: activeContext.data.clientId,
          scheduledAt: dueDateParsed,
        };

        const result = await createTask(taskData);

        if (result.success) {
          // Toast notification
          toast({
            title: "Tarea creada",
            description: `Tarea "${activeContext.data.title}" para ${activeContext.data.clientName} creada correctamente`,
          });

          // Silent completion - don't speak or reset conversation
          // User should press mic button to continue
          addMessage("assistant", "✓ Tarea creada exitosamente");
          setSuccess("Tarea creada");
          setIsProcessing(false);
        } else {
          throw new Error(result.error || "Error al crear tarea");
        }
      }
    } catch (err) {
      console.error("Create error:", err);
      const errorMsg =
        err instanceof Error ? err.message : "Hubo un error al crear";
      setError(errorMsg);
      addMessage("assistant", errorMsg);
      speakMessage(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  }, [
    readyToCreate,
    context.intent,
    context.data,
    addMessage,
    speakMessage,
    router,
    defaultCrewIds,
  ]);

  // ============================================
  // Reset Conversation
  // ============================================

  const resetConversation = useCallback(() => {
    ttsRef.current.cancel();
    setMessages([]);
    setContext({
      intent: null,
      data: {},
      missingFields: [],
      messages: [],
      step: "idle",
      awaitingConfirmation: false,
    });
    setReadyToCreate(false);
    setError(null);
    setSuccess(null);
    setTextInput("");
    // Don't add greeting here - let the useEffect handle it
  }, []);

  // Initial greeting (only once on first render)
  useEffect(() => {
    if (isFirstRenderRef.current && userFirstName) {
      isFirstRenderRef.current = false;
      
      const greeting = `Hola ${userFirstName}, ¿en qué puedo ayudarte?`;
      
      console.log("[Voice] Initial greeting triggered for:", userFirstName);

      setTimeout(() => {
        addMessage("assistant", greeting);
        // Don't speak initial greeting due to browser autoplay policy
        // TTS will work after user clicks the mic button
        console.log("[Voice] Initial greeting shown (silent due to autoplay policy)");
      }, 500);
    }
  }, [userFirstName, addMessage, speakMessage]);

  // ============================================
  // Render
  // ============================================

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      {/* Main Chat Panel */}
      <Card className="shadow-2xl shadow-primary/10 flex flex-col h-[calc(100vh-200px)] min-h-[500px] backdrop-blur-xl bg-gradient-to-br from-background/95 via-background/98 to-background/95 border-primary/20 overflow-hidden">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4 border-b border-primary/10 bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent font-semibold">
              <MessageSquare className="h-5 w-5 text-primary drop-shadow-lg" />
              Asistente Conversacional
            </CardTitle>
            <div className="flex items-center gap-3 mt-1">
              <CardDescription className="text-muted-foreground/80">
                Crea tareas y rodajes mediante conversación natural
              </CardDescription>
              {ttsProvider === "google-tts" && ttsTokensUsed > 0 && (
                <span className="text-xs text-muted-foreground/60 bg-muted/40 px-2 py-1 rounded-full">
                  {ttsTokensUsed} caracteres
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* TTS Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setTtsEnabled(!ttsEnabled);
                if (ttsEnabled) ttsRef.current.cancel();
              }}
              title={ttsEnabled ? "Silenciar voz" : "Activar voz"}
              className="hover:bg-primary/10 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300"
            >
              {ttsEnabled ? (
                <Volume2 className="h-4 w-4 text-primary" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>

            {/* Reset */}
            <Button
              variant="ghost"
              size="icon"
              onClick={resetConversation}
              title="Nueva conversación"
              className="hover:bg-primary/10 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        {/* Messages Area */}
        <CardContent className="flex-1 overflow-hidden p-0">
          <div className="h-full overflow-y-auto px-6">
            <div className="space-y-4 py-4">
              {messages.map((msg, index) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-2 text-sm",
                    // Only animate the last message to avoid flicker on re-renders
                    index === messages.length - 1 && "animate-chat-bubble",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 max-w-[85%] transition-all duration-300",
                      msg.role === "user"
                        ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 backdrop-blur-sm border border-primary/30"
                        : "bg-gradient-to-br from-muted/80 to-muted/60 backdrop-blur-md shadow-lg shadow-black/5 hover:shadow-xl hover:shadow-black/10 border border-border/50"
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {isProcessing && (
                <div className="flex gap-2 justify-start">
                  <div className="bg-gradient-to-br from-muted/80 to-muted/60 backdrop-blur-md rounded-2xl px-4 py-2.5 shadow-lg shadow-black/5 border border-border/50">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                </div>
              )}

              <div ref={scrollRef} />
            </div>
          </div>
        </CardContent>

        {/* Context Badges */}
        {context.intent && (
          <div className="border-t border-primary/10 px-6 py-3 bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
            <div className="flex gap-2 flex-wrap text-xs">
              <Badge variant="secondary" className="shadow-md shadow-primary/20 bg-gradient-to-r from-primary/20 to-primary/10 border-primary/30">
                {context.intent === "shoot" ? "📹 Rodaje" : "✅ Tarea"}
              </Badge>
              {context.data.clientName && (
                <Badge variant="outline" className="shadow-sm backdrop-blur-sm bg-background/50">{context.data.clientName}</Badge>
              )}
              {context.data.date && (
                <Badge variant="outline" className="shadow-sm backdrop-blur-sm bg-background/50">{context.data.date}</Badge>
              )}
              {context.data.startTime && (
                <Badge variant="outline" className="shadow-sm backdrop-blur-sm bg-background/50">{context.data.startTime}</Badge>
              )}
              {context.data.title && (
                <Badge variant="outline" className="max-w-[200px] truncate shadow-sm backdrop-blur-sm bg-background/50">
                  {context.data.title}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-primary/10 px-6 py-4 space-y-3 bg-gradient-to-br from-background/50 to-muted/20" suppressHydrationWarning>
          {/* Error/Success Messages */}
          {error && (
            <Alert variant="destructive" className="py-2 shadow-lg backdrop-blur-sm bg-destructive/10 border-destructive/30">
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="py-2 bg-gradient-to-r from-emerald-500/10 to-emerald-600/5 border-emerald-500/30 shadow-lg shadow-emerald-500/10">
              <AlertDescription className="text-sm text-emerald-700 dark:text-emerald-400">
                {success}
              </AlertDescription>
            </Alert>
          )}

          {/* Create Button - Hidden when awaiting voice confirmation */}
          {readyToCreate && !context.awaitingConfirmation && (
            <Button
              onClick={handleCreate}
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-xl shadow-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/40 transition-all duration-300 border border-emerald-400/30"
              disabled={isProcessing}
              size="lg"
            >
              <Check className="mr-2 h-5 w-5" />
              Crear {context.intent === "shoot" ? "Rodaje" : "Tarea"}
            </Button>
          )}

          {/* Voice/Text Input */}
          {inputMode === "voice" ? (
            <Button
              onClick={isListening ? stopListening : startListening}
              disabled={isProcessing || ttsRef.current.isSpeaking()}
              variant={isListening ? "destructive" : "default"}
              className={cn(
                "w-full shadow-xl transition-all duration-300",
                isListening 
                  ? "bg-gradient-to-r from-destructive to-destructive/80 shadow-destructive/40 hover:shadow-2xl hover:shadow-destructive/50 border border-destructive/30"
                  : "bg-gradient-to-r from-primary to-primary/80 shadow-primary/40 hover:shadow-2xl hover:shadow-primary/50 border border-primary/30"
              )}
              size="lg"
            >
              {isListening ? (
                <>
                  <MicOff className="mr-2 h-5 w-5 animate-pulse" />
                  Escuchando...
                </>
              ) : (
                <>
                  <Mic className="mr-2 h-5 w-5" />
                  Presiona para hablar
                </>
              )}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleUserInput(textInput);
                  }
                }}
                placeholder="Escribe tu mensaje..."
                disabled={isProcessing}
                className="flex-1"
              />
              <Button
                onClick={() => handleUserInput(textInput)}
                disabled={isProcessing || !textInput.trim()}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Mode Toggle */}
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setInputMode(inputMode === "voice" ? "text" : "voice")
              }
              className="text-xs text-muted-foreground"
            >
              Cambiar a modo {inputMode === "voice" ? "texto" : "voz"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Settings Panel */}
      <Card className="shadow-2xl shadow-primary/10 h-fit backdrop-blur-xl bg-gradient-to-br from-background/95 via-background/98 to-background/95 border-primary/20">
        <CardHeader className="border-b border-primary/10 bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
          <CardTitle className="text-lg flex items-center gap-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent font-semibold">
            <Volume2 className="h-5 w-5 text-primary drop-shadow-lg" />
            Configuración de Voz
          </CardTitle>
          <CardDescription className="text-muted-foreground/80">
            Ajusta el proveedor y voz del asistente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* TTS Provider */}
          <div className="space-y-2">
            <Label>Proveedor TTS</Label>
            <Select
              value={ttsProvider}
              onValueChange={(v) => setTtsProvider(v as TTSProvider)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="web-speech">
                  Web Speech API (Gratis)
                </SelectItem>
                <SelectItem value="google-tts">
                  Google Cloud TTS (Neural2)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {ttsProvider === "google-tts"
                ? "1M caracteres/mes gratis con Google Cloud"
                : "Gratis y funciona offline"}
            </p>
          </div>

          {/* Google Voice Selection */}
          {ttsProvider === "google-tts" && (
            <div className="space-y-2">
              <Label>Voz Google</Label>
              <Select
                value={ttsVoice}
                onValueChange={(v) => setTtsVoice(v as GoogleTTSVoice)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOOGLE_TTS_VOICES.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.gender === "female" ? "👩" : "👨"} {voice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Input Mode Info */}
          <div className="space-y-2">
            <Label>Modo de entrada</Label>
            <div className="text-sm text-muted-foreground">
              {inputMode === "voice" ? (
                <span className="flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  Reconocimiento de voz activo
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Entrada de texto activa
                </span>
              )}
            </div>
          </div>

          {/* Web Speech Support Warning */}
          {!isWebSpeechSupported && inputMode === "voice" && (
            <Alert variant="destructive">
              <AlertTitle>Navegador no compatible</AlertTitle>
              <AlertDescription className="text-sm">
                Tu navegador no soporta Web Speech API. Usa Chrome, Edge o Safari para reconocimiento de voz.
              </AlertDescription>
            </Alert>
          )}

          {/* Instructions */}
          <div className="rounded-xl bg-gradient-to-br from-muted/60 to-muted/40 backdrop-blur-sm p-4 space-y-2 shadow-lg shadow-black/5 border border-border/50">
            <p className="text-sm font-semibold text-foreground/90">Comandos de ejemplo:</p>
            <ul className="text-xs text-muted-foreground/80 space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-primary/60"></span>
                "Crear rodaje para Dra Ruth Muñoz"
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-primary/60"></span>
                "Rodaje este viernes a las 3pm"
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-primary/60"></span>
                "Crear tarea de reel para cliente X"
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-primary/60"></span>
                "Nueva tarea: editar video promo"
              </li>
              <li className="flex items-center gap-2 text-destructive/70">
                <span className="w-1 h-1 rounded-full bg-destructive/60"></span>
                Di "cancelar" o "salir" para cerrar
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Shooting Detail Dialog (post-creation popup) */}
      <ShootingDetail
        shooting={createdShooting}
        open={showShootingDetail}
        onOpenChange={(open) => {
          setShowShootingDetail(open);
          if (!open) {
            setCreatedShooting(null);
          }
        }}
        onEdit={() => {
          // Navigate to shoots page with edit mode if needed
          if (createdShooting) {
            router.push(`/content/shoots?detail=${createdShooting.id}`);
          }
          setShowShootingDetail(false);
        }}
        onCancel={() => {
          setShowShootingDetail(false);
          setCreatedShooting(null);
        }}
      />
    </div>
  );
}
