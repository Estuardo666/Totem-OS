"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Mic, Square, Loader2, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { interpretVoiceCommandAction } from "@/actions/voice-actions";
import { voiceCommandResponseSchema } from "@/schemas/voice";
import { TaskSheet } from "@/components/features/content/task-sheet";
import { ShootingForm } from "@/components/features/shoots/shooting-form";
import { z } from "zod";

type VoiceResponse = z.infer<typeof voiceCommandResponseSchema> & {
  suggestedClient?: string;
  suggestedDate?: string;
  suggestedStartTime?: string;
  suggestedEndTime?: string;
};

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

const parseDDMMYYYY = (dateStr: string): Date => {
  const parts = dateStr.trim().split(/\D+/).map(Number);
  const [day, month, year] = parts;
  const now = new Date();
  const y = year && year > 0 ? year : now.getFullYear();
  const m = month && month >= 1 && month <= 12 ? month - 1 : now.getMonth();
  const d = day && day >= 1 && day <= 31 ? day : now.getDate();
  return new Date(y, m, d);
};

const parseTimeToHHMM = (timeStr?: string): string => {
  if (!timeStr) return "";
  const hhmmMatch = timeStr.trim().match(/(\d{1,2})\s*[:h]?\s*(\d{0,2})?\s*(am|pm)?/i);
  if (hhmmMatch) {
    let hours = Number(hhmmMatch[1]);
    const minutes = Number(hhmmMatch[2] ?? "0");
    const ampm = hhmmMatch[3]?.toLowerCase();
    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }
  return "";
};

const normalizeText = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const matchClientId = (clients: { id: string; name: string }[], name?: string) => {
  if (!name) return undefined;
  const normalized = normalizeText(name);
  const exact = clients.find((c) => normalizeText(c.name) === normalized);
  if (exact) return exact.id;
  const partial = clients.find((c) => normalized.includes(normalizeText(c.name)));
  if (partial) return partial.id;
  const reverse = clients.find((c) => normalizeText(c.name).includes(normalized));
  if (reverse) return reverse.id;
  return undefined;
};

const matchClientIdWithFallback = (
  clients: { id: string; name: string }[],
  primary?: string,
  fallbackText?: string
) => {
  const fromPrimary = matchClientId(clients, primary);
  if (fromPrimary) return fromPrimary;
  if (!fallbackText) return undefined;
  const text = normalizeText(fallbackText);
  const exact = clients.find((c) => normalizeText(c.name) === text);
  if (exact) return exact.id;
  const partial = clients.find((c) => text.includes(normalizeText(c.name)));
  if (partial) return partial.id;
  const reverse = clients.find((c) => normalizeText(c.name).includes(text));
  if (reverse) return reverse.id;
  return undefined;
};

export function FloatingVoiceButton() {
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [shootFormOpen, setShootFormOpen] = useState(false);
  const [taskDefaults, setTaskDefaults] = useState<any | null>(null);
  const [shootDefaults, setShootDefaults] = useState<any | null>(null);
  const [primaryColor, setPrimaryColor] = useState("139,92,246"); // default violet

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const transcriptRef = useRef("");
  const autoRunningRef = useRef(false);

  // Ocultar en Finanzas y /admin/voice-control
  const isHidden = pathname?.startsWith("/finanzas") || pathname?.startsWith("/admin/voice-control");
  if (isHidden) return null;

  // Obtener color primario del CSS custom property
  useEffect(() => {
    const computeColor = () => {
      const root = document.documentElement;
      const primaryHSL = getComputedStyle(root).getPropertyValue("--primary").trim();
      // Convertir HSL a RGB (e.g., "220 90% 24%" -> "123,45,67")
      const hslMatch = primaryHSL.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)/);
      if (hslMatch) {
        const h = parseFloat(hslMatch[1]);
        const s = parseFloat(hslMatch[2]);
        const l = parseFloat(hslMatch[3]);
        const c = (1 - Math.abs(2 * l / 100 - 1)) * s / 100;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l / 100 - c / 2;
        let r = 0, g = 0, b = 0;
        if (h < 60) { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }
        const R = Math.round((r + m) * 255);
        const G = Math.round((g + m) * 255);
        const B = Math.round((b + m) * 255);
        setPrimaryColor(`${R},${G},${B}`);
      }
    };
    computeColor();
    window.addEventListener("load", computeColor);
    return () => window.removeEventListener("load", computeColor);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/voice/bootstrap");
        const data = await res.json();
        if (data.clients) setClients(data.clients);
      } catch {
        // ignore
      }
    })();
  }, []);

  const getSpeechRecognitionConstructor = () => {
    if (typeof window === "undefined") return null;
    const speechWindow = window as any;
    return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
  };

  const startWebSpeech = () => {
    const SpeechCtor = getSpeechRecognitionConstructor();
    if (!SpeechCtor) return null;
    const recognition = new SpeechCtor();
    recognition.lang = "es-ES";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event: any) => {
      const current = Array.from(event.results)
        .map((r: any) => (r[0]?.transcript ?? "").trim())
        .join(" ");
      setTranscript(current);
      transcriptRef.current = current.trim();
    };
    recognition.onerror = (e: any) => setError(`Error: ${e.error}`);
    recognition.onend = () => {
      setIsListening(false);
      if (transcriptRef.current.trim() && !autoRunningRef.current) {
        void handleAutoInterpretAndCreate();
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    return recognition;
  };

  const startRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
          const form = new FormData();
          form.append("file", blob, "audio.webm");
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || "No se pudo transcribir");
          setTranscript(data.text ?? "");
          transcriptRef.current = (data.text ?? "").trim();
          if (data.text) await handleAutoInterpretAndCreate();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Error al transcribir");
        }
      };
      mediaRecorder.start();
      setIsListening(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar grabación");
    }
  };

  const startListening = () => {
    setError(null);
    setTranscript("");
    transcriptRef.current = "";
    const SpeechCtor = getSpeechRecognitionConstructor();
    if (SpeechCtor) {
      startWebSpeech();
    } else {
      startRecorder();
    }
  };

  const stopListening = () => {
    const SpeechCtor = getSpeechRecognitionConstructor();
    if (SpeechCtor) {
      recognitionRef.current?.stop();
    } else {
      mediaRecorderRef.current?.stop();
    }
    setIsListening(false);
  };

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
      void handleAutoInterpretAndCreate();
    } else {
      startListening();
    }
  };

  const handleFloatingButtonClick = () => {
    if (open) {
      // Cerrar: detener grabación si está activa
      if (isListening) {
        stopListening();
        void handleAutoInterpretAndCreate();
      }
      setOpen(false);
    } else {
      // Abrir: mostrar toast e iniciar grabación automáticamente
      setOpen(true);
      setTimeout(() => startListening(), 50);
    }
  };

  const handleAutoInterpretAndCreate = async () => {
    if (autoRunningRef.current || isProcessing) return;
    const textForUse = transcriptRef.current.trim() || transcript.trim();
    if (!textForUse) return;
    autoRunningRef.current = true;
    setIsProcessing(true);
    setError(null);
    try {
      const response = await interpretVoiceCommandAction({ transcript: textForUse });
      if (response.success && response.data) {
        const clientId = matchClientIdWithFallback(clients, (response.data as VoiceResponse).suggestedClient, textForUse);
        if (response.data.type === "task") {
          setTaskDefaults({
            title: response.data.title,
            type: response.data.pieceType || "REEL",
            status: "IDEA",
            priority: "MEDIUM",
            postCopy: response.data.details,
            scheduledAt: (response.data as VoiceResponse).suggestedDate
              ? formatDateTimeForInput(parseDDMMYYYY((response.data as VoiceResponse).suggestedDate))
              : undefined,
            clientId: clientId || "",
          });
          setTaskFormOpen(true);
        } else {
          setShootDefaults({
            title: response.data.title,
            notes: response.data.details,
            scheduledAt: (response.data as VoiceResponse).suggestedDate
              ? parseDDMMYYYY((response.data as VoiceResponse).suggestedDate)
              : undefined,
            clientId: clientId || "",
            startTime: parseTimeToHHMM((response.data as VoiceResponse).suggestedStartTime || "") || "",
            endTime: (() => {
              const parsedStart = parseTimeToHHMM((response.data as VoiceResponse).suggestedStartTime || "");
              const parsedEnd = parseTimeToHHMM((response.data as VoiceResponse).suggestedEndTime || "");
              if (parsedEnd) return parsedEnd;
              if (!parsedStart) return "";
              const [h, m] = parsedStart.split(":").map(Number);
              const endH = (h + 1) % 24;
              return `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
            })() || "",
          });
          setShootFormOpen(true);
        }
        setOpen(false);
      } else {
        setError(response.error || "No se pudo interpretar el comando.");
      }
    } finally {
      setIsProcessing(false);
      autoRunningRef.current = false;
    }
  };

  const handleShootingCreated = (shooting: any) => {
    setShootFormOpen(false);
    if (shooting?.id) {
      router.push(`/content/shoots?detail=${shooting.id}`);
    } else {
      router.refresh();
    }
  };

  return (
    <>
      {/* Botón flotante futurista - se transforma cuando está activo */}
      <button
        onClick={handleFloatingButtonClick}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full text-white transition-all duration-500 flex items-center justify-center group ${
          open
            ? "scale-110"
            : "bg-gradient-to-br from-primary to-primary/80 hover:scale-110"
        }`}
        style={open ? {
          background: `linear-gradient(135deg, rgb(${primaryColor}), rgba(${primaryColor},0.8))`,
          boxShadow: `0 0 40px rgba(${primaryColor},0.6), 0 0 80px rgba(${primaryColor},0.4), 0 0 120px rgba(${primaryColor},0.3), inset 0 0 20px rgba(255,255,255,0.1)`
        } : {
          boxShadow: "0 0 32px rgba(95,64,255,0.4), 0 0 64px rgba(95,64,255,0.2)",
        }}
      >
        <span
          className={`text-2xl font-bold transition-transform duration-300 ${
            open ? "rotate-45" : ""
          }`}
        >
          +
        </span>
        {/* Anillos de resplandor animados cuando está activo */}
        {open && (
          <>
            <span 
              className="absolute inset-0 rounded-full animate-pulse"
              style={{ background: `linear-gradient(135deg, rgba(${primaryColor},0.3), rgba(${primaryColor},0.2))` }}
            />
            <span 
              className="absolute -inset-1 rounded-full animate-spin"
              style={{ 
                background: `linear-gradient(90deg, rgba(${primaryColor},0.2), rgba(${primaryColor},0.1), rgba(${primaryColor},0.2))`,
                animationDuration: "3s" 
              }} 
            />
            <span 
              className="absolute -inset-2 rounded-full animate-ping"
              style={{ 
                borderColor: `rgba(${primaryColor},0.3)`,
                borderWidth: "1px",
                animationDuration: "2s"
              }} 
            />
          </>
        )}
        <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>

      {/* Toast bottom elegante con transparencia y backdrop blur */}
      <div
        className={`fixed bottom-24 right-4 left-4 md:left-auto md:right-6 md:w-96 z-40 transition-all duration-150 ease-out origin-bottom-right ${
          open
            ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
            : "opacity-0 scale-90 translate-y-4 pointer-events-none"
        }`}
      >
        {/* Resplandor exterior animado */}
        <div
          className="absolute -inset-1 rounded-3xl opacity-75 blur-xl animate-pulse"
          style={{
            background: `linear-gradient(135deg, rgba(${primaryColor},0.4), rgba(${primaryColor},0.3), rgba(${primaryColor},0.4))`,
            animationDuration: "2s",
          }}
        />
        <div
          className="absolute -inset-0.5 rounded-2xl opacity-50 blur-md"
          style={{
            background: `linear-gradient(90deg, rgba(${primaryColor},0.5), rgba(${primaryColor},0.4), rgba(${primaryColor},0.5))`,
          }}
        />
        
        <div
          className="relative rounded-2xl bg-background/80 backdrop-blur-xl shadow-2xl overflow-hidden"
          style={{
            borderColor: `rgba(${primaryColor},0.2)`,
            borderWidth: "1px",
            boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 80px rgba(${primaryColor},0.3), 0 0 120px rgba(${primaryColor},0.2), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(${primaryColor},0.1)`,
          }}
        >
          {/* Borde gradiente animado */}
          <div 
            className="absolute inset-0 rounded-2xl pointer-events-none animate-pulse"
            style={{
              background: `linear-gradient(to bottom right, rgba(${primaryColor},0.2), rgba(${primaryColor},0.1))`,
              animationDuration: "3s"
            }}
          />
          
          {/* Línea de luz superior */}
          <div 
            className="absolute top-0 left-4 right-4 h-px"
            style={{
              background: `linear-gradient(to right, rgba(${primaryColor},0), rgba(${primaryColor},0.5), rgba(${primaryColor},0))`
            }}
          />
          
          {/* Header elegante */}
          <div className="relative flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: `rgb(${primaryColor})` }}
              />
              <span className="text-sm font-medium text-foreground/90">Voice control</span>
            </div>
            <button
              onClick={() => {
                if (isListening) {
                  stopListening();
                  void handleAutoInterpretAndCreate();
                }
                setOpen(false);
              }}
              className="p-1 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Contenido */}
          <div className="relative p-4 space-y-4">
            {/* Botón de micrófono futurista */}
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={handleToggleListening}
                disabled={isProcessing}
                className={`relative flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300 text-white ${
                  isListening
                    ? "scale-110"
                    : "bg-white/5 text-foreground border border-white/10 hover:bg-white/10"
                }`}
                style={{
                  background: isListening
                    ? `linear-gradient(135deg, rgb(${primaryColor}), rgba(${primaryColor},0.8))`
                    : undefined,
                  borderColor: !isListening ? `rgba(${primaryColor},0.3)` : undefined,
                  boxShadow: isListening
                    ? `0 0 30px rgba(${primaryColor},0.5), 0 0 60px rgba(${primaryColor},0.3)`
                    : "none",
                }}
              >
                {isListening ? (
                  <Square className="h-6 w-6" />
                ) : (
                  <Mic className="h-6 w-6" />
                )}
                {isListening && (
                  <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/20 to-transparent animate-pulse" />
                )}
              </button>
              
              <div className="flex items-center gap-2 text-xs">
                {isListening && (
                  <span className="flex items-center gap-1.5" style={{ color: `rgb(${primaryColor})` }}>
                    <span 
                      className="w-1.5 h-1.5 rounded-full animate-pulse"
                      style={{ backgroundColor: `rgb(${primaryColor})` }}
                    />
                    <span 
                      className="w-1.5 h-1.5 rounded-full animate-pulse"
                      style={{ 
                        backgroundColor: `rgb(${primaryColor})`,
                        animationDelay: "0.2s" 
                      }} 
                    />
                    <span 
                      className="w-1.5 h-1.5 rounded-full animate-pulse"
                      style={{ 
                        backgroundColor: `rgb(${primaryColor})`,
                        animationDelay: "0.4s" 
                      }} 
                    />
                    Escuchando...
                  </span>
                )}
                {!isListening && !isProcessing && (
                  <span className="text-muted-foreground">Toca para grabar</span>
                )}
                {isProcessing && (
                  <span className="inline-flex items-center gap-1.5" style={{ color: `rgb(${primaryColor})` }}>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Interpretando...
                  </span>
                )}
              </div>
            </div>

            {/* Textarea con estilo glassmorphism */}
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Transcripción en tiempo real..."
              className="min-h-[80px] text-sm bg-white/5 border-white/10 focus:border-violet-400/50 placeholder:text-muted-foreground/50 resize-none"
            />

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Formularios reales */}
      <TaskSheet
        open={taskFormOpen}
        onOpenChange={setTaskFormOpen}
        task={null}
        users={[]}
        clients={clients as any}
        initialDefaults={taskDefaults || undefined}
        initialScheduledAt={undefined}
      />
      <ShootingForm
        open={shootFormOpen}
        onOpenChange={setShootFormOpen}
        clients={clients as any}
        shooting={null as any}
        onCreated={handleShootingCreated}
        initialTitle={shootDefaults?.title}
        initialNotes={shootDefaults?.notes}
        initialDate={shootDefaults?.scheduledAt}
        initialClientId={shootDefaults?.clientId}
        initialStartTime={shootDefaults?.startTime}
        initialEndTime={shootDefaults?.endTime}
      />
    </>
  );
}
