"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Sparkles, Radio, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { interpretVoiceCommandAction } from "@/actions/voice-actions";
import { TaskSheet } from "@/components/features/content/task-sheet";
import { ShootingForm } from "@/components/features/shoots/shooting-form";
import type { Client } from "@prisma/client";
import type { UserWithTaskCount } from "@/actions/user.actions";

// Helper: format Date to datetime-local input string
const formatDateTimeForInput = (date?: Date | string | null): string | undefined => {
  if (!date) return undefined;
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return undefined;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const parseDDMMYYYY = (input?: string): Date | undefined => {
  if (!input) return undefined;
  const parts = input.split(/[\/\-\.]/);
  if (parts.length !== 3) return undefined;
  const [dd, mm, yyyy] = parts.map((p) => Number(p));
  if (!dd || !mm || !yyyy) return undefined;
  // Local date to avoid off-by-one when formatting
  return new Date(yyyy, mm - 1, dd);
};

const normalizeText = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\b(dr\.?|doctor(a)?|lic\.?|sr\.?|sra\.?|srta\.?)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

const matchClientId = (clients: Pick<Client, "id" | "name">[], needle?: string) => {
  if (!needle) return undefined;
  const target = normalizeText(needle);
  return clients.find((c) => normalizeText(c.name).includes(target))?.id;
};

const parseTimeToHHMM = (raw?: string) => {
  if (!raw) return "";
  const cleaned = raw.trim().toLowerCase();
  // Handle formats like "3pm", "3 pm", "15:00", "15h", "15:30"
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

interface VoiceCommandResponse {
  type: "task" | "shoot";
  title: string;
  details: string;
  pieceType?: "REEL" | "FLYER" | "STORY";
  suggestedDate?: string;
  suggestedClient?: string;
  suggestedStartTime?: string;
  suggestedEndTime?: string;
}

interface VoiceHistoryItem extends VoiceCommandResponse {
  id: string;
  createdAt: string;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  results: SpeechRecognitionResultListLike;
};

type RecorderState = "idle" | "recording" | "uploading";

type SpeechRecognitionResultListLike = {
  length: number;
  item: (index: number) => SpeechRecognitionResultLike;
  [index: number]: SpeechRecognitionResultLike;
};

type SpeechRecognitionResultLike = {
  length: number;
  item: (index: number) => SpeechRecognitionAlternativeLike;
  [index: number]: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionAlternativeLike = {
  transcript: string;
  confidence?: number;
};

type SpeechRecognitionErrorEventLike = {
  error: string;
  message?: string;
};

const MAX_HISTORY = 6;

const getSpeechRecognitionConstructor = (): SpeechRecognitionConstructor | null => {
  if (typeof window === "undefined") return null;

  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
};

const extractTranscript = (results: SpeechRecognitionResultListLike): string => {
  const segments: string[] = [];

  for (let index = 0; index < results.length; index += 1) {
    const result = results[index] ?? results.item(index);
    const alternative = result?.[0] ?? result?.item(0);

    if (alternative?.transcript) {
      segments.push(alternative.transcript.trim());
    }
  }

  return segments.join(" ").trim();
};

interface VoiceControlPanelProps {
  clients: Pick<Client, "id" | "name" | "logo" | "color">[];
  users: UserWithTaskCount[];
}

export function VoiceControlPanel({ clients, users }: VoiceControlPanelProps) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [recorderError, setRecorderError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VoiceCommandResponse | null>(null);
  const [history, setHistory] = useState<VoiceHistoryItem[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [taskDefaults, setTaskDefaults] = useState<any | null>(null);
  const [shootFormOpen, setShootFormOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [shootDefaults, setShootDefaults] = useState<any | null>(null);

  useEffect(() => {
    const constructor = getSpeechRecognitionConstructor();
    if (!constructor) {
      setIsSupported(false);
    }

    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const handleStart = () => {
    // Reset state for a stateless IA call (no historial)
    setTranscript("");
    setResult(null);
    setActionMessage(null);
    setActionError(null);
    setTaskDefaults(null);
    setShootDefaults(null);
    if (!isSupported) {
      setError("Tu navegador no soporta la API de reconocimiento de voz.");
      return null;
    }

    const recognition = new getSpeechRecognitionConstructor()!;
    recognition.lang = "es-ES";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      const currentTranscript = extractTranscript(event.results);
      setTranscript(currentTranscript);
    };

    recognition.onerror = (event) => {
      setError(`Error de reconocimiento: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    return recognition;
  };

  const stopRecorder = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  };

  const startRecorder = async () => {
    try {
      setRecorderError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setRecorderState("uploading");
        try {
          const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
          const form = new FormData();
          form.append("file", blob, "audio.webm");
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          const data = (await res.json()) as { text?: string; error?: string };
          if (!res.ok || data.error) {
            throw new Error(data.error || "No se pudo transcribir");
          }
          setTranscript(data.text ?? "");
        } catch (err) {
          setRecorderError(err instanceof Error ? err.message : "Error al transcribir");
        } finally {
          setRecorderState("idle");
        }
      };

      mediaRecorder.start();
      setRecorderState("recording");
    } catch (err) {
      setRecorderError(err instanceof Error ? err.message : "No se pudo iniciar grabación");
      setRecorderState("idle");
    }
  };

  const handleToggleListening = () => {
    // Fallback: if no Web Speech, use recorder + backend transcribe
    if (!isSupported) {
      if (recorderState === "recording") {
        stopRecorder();
        return;
      }
      startRecorder();
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = recognitionRef.current ?? initRecognition();
    if (!recognition) return;

    setError(null);
    setResult(null);
    recognition.start();
    setIsListening(true);
  };

  const handleInterpret = async () => {
    if (!transcript.trim()) {
      setError("Agrega una transcripción antes de interpretar.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    const response = await interpretVoiceCommandAction({
      transcript: transcript.trim(),
    });

    if (!response.success || !response.data) {
      setError(response.error || "No se pudo interpretar el comando.");
      setIsProcessing(false);
      return;
    }

    const newEntry: VoiceHistoryItem = {
      ...response.data,
      id: crypto.randomUUID(),
      createdAt: new Date().toLocaleString("es-EC"),
    };

    setResult(response.data);
    setHistory((prev) => [newEntry, ...prev].slice(0, MAX_HISTORY));
    setIsProcessing(false);
  };

  const handleSimulatedCreate = (target: "task" | "shoot") => {
    setActionMessage(null);
    setActionError(null);

    if (!result) {
      setActionError("Primero interpreta un comando para generar un resultado.");
      return;
    }

    if (result.type !== target) {
      setActionError(
        target === "task"
          ? "El resultado actual es un rodaje. Interpreta nuevamente para generar una tarea."
          : "El resultado actual es una tarea. Interpreta nuevamente para generar un rodaje."
      );
      return;
    }

    if (target === "task") {
      setTaskDefaults({
        title: result.title,
        type: result.pieceType || "REEL",
        status: "IDEA",
        priority: "MEDIUM",
        postCopy: result.details,
        scheduledAt: result.suggestedDate ? formatDateTimeForInput(parseDDMMYYYY(result.suggestedDate)) : undefined,
        clientId: matchClientId(clients, result.suggestedClient) ?? "",
      });
      setTaskFormOpen(true);
    } else {
      setShootDefaults({
        title: result.title,
        notes: result.details,
        scheduledAt: result.suggestedDate ? parseDDMMYYYY(result.suggestedDate) : undefined,
        clientId: matchClientId(clients, result.suggestedClient),
        startTime: parseTimeToHHMM(result.suggestedStartTime),
        endTime: (() => {
          const parsedStart = parseTimeToHHMM(result.suggestedStartTime);
          const parsedEnd = parseTimeToHHMM(result.suggestedEndTime);
          if (parsedEnd) return parsedEnd;
          if (!parsedStart) return "";
          const [h, m] = parsedStart.split(":").map(Number);
          const endH = (h + 1) % 24;
          return `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        })(),
      });
      setShootFormOpen(true);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <Card className="shadow-sm">
        <CardHeader className="space-y-3">
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            Control por voz
          </CardTitle>
          <CardDescription>
            Graba o edita el texto y deja que la IA clasifique como Tarea o Rodaje.
          </CardDescription>
          <div className="flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={handleToggleListening}
              disabled={!isSupported}
              className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 ${
                isListening
                  ? "bg-primary text-primary-foreground scale-105"
                  : "bg-background text-foreground border"
              }`}
            >
              {isListening ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <div className="flex w-full items-center justify-center gap-1">
              {[10, 14, 18, 12, 16, 20, 12, 18, 14, 10].map((height, index) => (
                <div
                  key={index}
                  className={`w-1 rounded-full ${
                    isListening
                      ? "bg-gradient-to-b from-cyan-400 via-fuchsia-500 to-primary shadow-[0_0_16px_rgba(59,130,246,0.45)] animate-[pulse_1.5s_ease-in-out_infinite]"
                      : "bg-muted-foreground/30"
                  }`}
                  style={{ height, animationDelay: `${index * 80}ms` }}
                  aria-hidden
                />
              ))}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isListening ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"
                }`}
              />
              {isListening ? "Escuchando en tiempo real" : "Micrófono en pausa"}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSupported && (
            <Alert variant="destructive">
              <AlertTitle>Web Speech API no disponible</AlertTitle>
              <AlertDescription>
                Usa Chrome o Edge para habilitar el reconocimiento de voz.
              </AlertDescription>
            </Alert>
          )}

          <Textarea
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            placeholder="Ej: Prepara un Reel para el cliente Alfa con tono cercano, fecha jueves 4pm."
            className="min-h-[140px]"
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={handleInterpret}
              disabled={isProcessing}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {isProcessing ? "Interpretando..." : "Interpretar con IA"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Beta: los resultados se crean solo en esta vista.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Atención</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {recorderError && (
            <Alert variant="destructive">
              <AlertTitle>Error de grabación</AlertTitle>
              <AlertDescription>{recorderError}</AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert>
              <AlertTitle>Resultado interpretado</AlertTitle>
              <AlertDescription>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide flex-wrap">
                    <span className="px-2 py-1 rounded-full bg-primary/10 text-primary">
                      {result.type === "task" ? "Tarea" : "Rodaje"}
                    </span>
                    {result.pieceType && (
                      <span className="relative overflow-hidden px-2 py-1 rounded-full bg-gradient-to-r from-primary via-fuchsia-500 to-cyan-500 text-primary-foreground shadow-[0_0_18px_rgba(59,130,246,0.45)] animate-[pulse_1.8s_ease-in-out_infinite]">
                        <span className="absolute inset-0 bg-white/20 blur-sm opacity-70" aria-hidden />
                        <span className="relative">{result.pieceType}</span>
                      </span>
                    )}
                    <span className="text-muted-foreground">Revisión rápida</span>
                  </div>
                  <p className="text-base font-semibold">{result.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {result.details}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleSimulatedCreate("task")}
                      className="gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      Crear tarea (simulado)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleSimulatedCreate("shoot")}
                      className="gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      Crear rodaje (simulado)
                    </Button>
                  </div>
                  {(actionMessage || actionError) && (
                    <div className="pt-1 text-sm">
                      {actionMessage && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {actionMessage}
                        </span>
                      )}
                      {actionError && (
                        <span className="text-destructive font-medium">{actionError}</span>
                      )}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            Simulaciones recientes
          </CardTitle>
          <CardDescription>
            Historial local de tareas/rodajes creados desde el comando de voz.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {history.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Aún no hay simulaciones. Usa el botón de interpretar para generar una.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border bg-muted/30 p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                      <span>{item.type === "task" ? "Tarea" : "Rodaje"}</span>
                      {item.pieceType && (
                        <span className="relative overflow-hidden px-2 py-0.5 rounded-full bg-gradient-to-r from-primary via-fuchsia-500 to-cyan-500 text-primary-foreground text-[0.65rem] shadow-[0_0_12px_rgba(59,130,246,0.35)] animate-[pulse_1.8s_ease-in-out_infinite]">
                          <span className="absolute inset-0 bg-white/20 blur-sm opacity-70" aria-hidden />
                          <span className="relative">{item.pieceType}</span>
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{item.createdAt}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold">{item.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.details}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Formulario real: Tarea */}
      <TaskSheet
        task={null}
        open={taskFormOpen}
        onOpenChange={setTaskFormOpen}
        users={users}
        clients={clients}
        initialDefaults={taskDefaults || undefined}
        initialScheduledAt={undefined}
      />

      {/* Formulario real: Rodaje */}
      <ShootingForm
        open={shootFormOpen}
        onOpenChange={setShootFormOpen}
        clients={clients as any}
        shooting={null as any}
        onCreated={undefined}
        initialTitle={shootDefaults?.title}
        initialNotes={shootDefaults?.notes}
        initialDate={shootDefaults?.scheduledAt}
        initialClientId={shootDefaults?.clientId}
        initialStartTime={shootDefaults?.startTime}
        initialEndTime={shootDefaults?.endTime}
      />
    </div>
  );
}
