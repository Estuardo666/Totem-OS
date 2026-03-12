"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Waves, StopCircle, X } from "lucide-react";
import { interpretVoiceCommandAction } from "@/actions/voice-actions";
import { voiceCommandResponseSchema } from "@/schemas/voice";
import { TaskSheet } from "@/components/features/content/task-sheet";
import { ShootingForm } from "@/components/features/shoots/shooting-form";
import { unlockAudioForMobile } from "@/lib/tts";
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

const matchClientId = (clients: { id: string; name: string; logo?: string | null; color?: string | null }[], name?: string) => {
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
  clients: { id: string; name: string; logo?: string | null; color?: string | null }[],
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
  // Check if we should hide BEFORE calling hooks
  if (typeof window === "undefined") {
    // Server-side, we can check pathname via pathname context later
    // For now, render the component and handle hiding client-side
  }

  const pathname = usePathname();
  const router = useRouter();

  // Ocultar en Finanzas, /admin/voice-control y /content
  const isHidden =
    pathname?.startsWith("/finanzas") ||
    pathname?.startsWith("/admin/voice-control") ||
    pathname?.startsWith("/content");

  const [open, setOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<{ id: string; name: string; logo?: string | null; color?: string | null }[]>([]);
  const [users, setUsers] = useState<{
    id: string;
    name: string;
    email: string;
    role: string;
  }[]>([]);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [shootFormOpen, setShootFormOpen] = useState(false);
  const [taskDefaults, setTaskDefaults] = useState<any | null>(null);
  const [shootDefaults, setShootDefaults] = useState<any | null>(null);
  const [primaryColor, setPrimaryColor] = useState("139,92,246"); // default violet

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const transcriptRef = useRef("");
  const autoRunningRef = useRef(false);
  const cancelledRef = useRef(false);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        if (data.users) setUsers(data.users);
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
      
      // Reset silence timeout - auto-interpret after 2s of silence
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      if (current.trim()) {
        silenceTimeoutRef.current = setTimeout(() => {
          if (transcriptRef.current.trim() && !autoRunningRef.current && !cancelledRef.current) {
            recognitionRef.current?.stop();
          }
        }, 2000);
      }
    };
    recognition.onerror = (e: any) => setError(`Error: ${e.error}`);
    recognition.onend = () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      setIsListening(false);
      if (transcriptRef.current.trim() && !autoRunningRef.current && !cancelledRef.current) {
        void handleAutoInterpretAndCreate();
      }
      cancelledRef.current = false;
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
          if (cancelledRef.current) {
            cancelledRef.current = false;
            return;
          }
          const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
          const form = new FormData();
          form.append("file", blob, "audio.webm");
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || "No se pudo transcribir");
          setTranscript(data.text ?? "");
          transcriptRef.current = (data.text ?? "").trim();
          if (data.text && !cancelledRef.current) await handleAutoInterpretAndCreate();
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
    // Unlock audio for mobile devices - this must happen during user interaction
    // to allow subsequent audio playback (TTS responses)
    unlockAudioForMobile();
    
    setError(null);
    setTranscript("");
    transcriptRef.current = "";
    cancelledRef.current = false;
    const SpeechCtor = getSpeechRecognitionConstructor();
    if (SpeechCtor) {
      startWebSpeech();
    } else {
      startRecorder();
    }
  };

  const stopListening = () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    const SpeechCtor = getSpeechRecognitionConstructor();
    if (SpeechCtor) {
      recognitionRef.current?.stop();
    } else {
      mediaRecorderRef.current?.stop();
    }
    setIsListening(false);
  };

  const stopListeningAndCancel = () => {
    cancelledRef.current = true;
    stopListening();
  };


  const handleFloatingButtonClick = () => {
    if (open) {
      // Cerrar: detener grabación si está activa (sin interpretar)
      if (isListening) {
        stopListeningAndCancel();
      }
      setTranscript("");
      transcriptRef.current = "";
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
              ? formatDateTimeForInput(parseDDMMYYYY((response.data as VoiceResponse).suggestedDate || ""))
              : undefined,
            clientId: clientId || "",
          });
          setTaskFormOpen(true);
        } else {
          setShootDefaults({
            title: response.data.title,
            notes: response.data.details,
            scheduledAt: (response.data as VoiceResponse).suggestedDate
              ? parseDDMMYYYY((response.data as VoiceResponse).suggestedDate || "")
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
      {isHidden ? null : (
        <>
          {/* Efecto Siri - Bordes luminosos en los extremos de la pantalla */}
          {(open && isListening) && (
          <div 
        className="fixed inset-0 z-50 pointer-events-none overflow-hidden animate-in fade-in duration-500"
      >
        {/* Borde superior */}
        <div 
          className="absolute top-0 left-0 right-0 h-8 md:h-12"
          style={{
            background: `linear-gradient(to bottom, rgba(${primaryColor},0.5) 0%, rgba(${primaryColor},0.2) 40%, transparent 100%)`,
            animation: "siriPulse 2s ease-in-out infinite",
          }}
        />
        {/* Borde inferior */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-8 md:h-12"
          style={{
            background: `linear-gradient(to top, rgba(${primaryColor},0.5) 0%, rgba(${primaryColor},0.2) 40%, transparent 100%)`,
            animation: "siriPulse 2s ease-in-out infinite 0.5s",
          }}
        />
        {/* Borde izquierdo */}
        <div 
          className="absolute top-0 bottom-0 left-0 w-6 md:w-10"
          style={{
            background: `linear-gradient(to right, rgba(${primaryColor},0.4) 0%, rgba(${primaryColor},0.15) 50%, transparent 100%)`,
            animation: "siriPulse 2s ease-in-out infinite 0.25s",
          }}
        />
        {/* Borde derecho */}
        <div 
          className="absolute top-0 bottom-0 right-0 w-6 md:w-10"
          style={{
            background: `linear-gradient(to left, rgba(${primaryColor},0.4) 0%, rgba(${primaryColor},0.15) 50%, transparent 100%)`,
            animation: "siriPulse 2s ease-in-out infinite 0.75s",
          }}
        />
        {/* Esquinas con resplandor concentrado */}
        <div 
          className="absolute top-0 left-0 w-16 md:w-20 h-16 md:h-20"
          style={{
            background: `radial-gradient(ellipse 70% 70% at top left, rgba(${primaryColor},0.6), transparent 70%)`,
            animation: "siriPulse 2s ease-in-out infinite",
          }}
        />
        <div 
          className="absolute top-0 right-0 w-16 md:w-20 h-16 md:h-20"
          style={{
            background: `radial-gradient(ellipse 70% 70% at top right, rgba(${primaryColor},0.6), transparent 70%)`,
            animation: "siriPulse 2s ease-in-out infinite 0.25s",
          }}
        />
        {/* Resplandores coloridos tipo iOS 26 */}
        <div 
          className="absolute bottom-0 left-0 w-20 md:w-28 h-20 md:h-28"
          style={{
            background: `radial-gradient(circle at center, rgba(59,130,246,0.8), rgba(99,102,241,0.4), transparent 70%)`,
            animation: "siriPulseColorful 1.5s ease-out infinite",
          }}
        />
        <div 
          className="absolute bottom-0 right-0 w-20 md:w-28 h-20 md:h-28"
          style={{
            background: `radial-gradient(circle at center, rgba(168,85,247,0.8), rgba(239,68,68,0.4), transparent 70%)`,
            animation: "siriPulseColorful 1.5s ease-out infinite 0.3s",
          }}
        />
      </div>
          )}

      {/* Overlay con glows circulares estilo Apple Intelligence */}
      {open && (
      <div
        className="fixed inset-0 z-30 pointer-events-none overflow-hidden animate-in fade-in duration-1000 backdrop-blur-sm"
        style={{
          background: "rgba(0,0,0,0.05)",
        }}
      >
        {/* Orbe superior izquierdo - Azul */}
        <div
          className="absolute -top-32 -left-32 w-96 h-96 opacity-40 blur-3xl rounded-full"
          style={{
            background: "radial-gradient(circle at 30% 30%, rgba(59,130,246,0.8), rgba(59,130,246,0.3), transparent)",
            animation: "appleOrbFloat 8s ease-in-out infinite",
          }}
        />
        {/* Orbe superior derecho - Púrpura */}
        <div
          className="absolute -top-40 -right-40 w-80 h-80 opacity-35 blur-3xl rounded-full"
          style={{
            background: "radial-gradient(circle at 50% 50%, rgba(168,85,247,0.7), rgba(168,85,247,0.2), transparent)",
            animation: "appleOrbFloat 10s ease-in-out infinite 1s",
          }}
        />
        {/* Orbe inferior izquierdo - Cian */}
        <div
          className="absolute -bottom-32 -left-24 w-80 h-80 opacity-30 blur-3xl rounded-full"
          style={{
            background: "radial-gradient(circle at 40% 40%, rgba(6,182,212,0.6), rgba(6,182,212,0.2), transparent)",
            animation: "appleOrbFloat 9s ease-in-out infinite 2s",
          }}
        />
        {/* Orbe inferior derecho - Rosa/Magenta */}
        <div
          className="absolute -bottom-40 -right-32 w-96 h-96 opacity-35 blur-3xl rounded-full"
          style={{
            background: "radial-gradient(circle at 50% 50%, rgba(236,72,153,0.65), rgba(236,72,153,0.15), transparent)",
            animation: "appleOrbFloat 11s ease-in-out infinite 1.5s",
          }}
        />
        {/* Orbe central-derecho - Naranja/Dorado (como en el iPhone) */}
        <div
          className="absolute top-2/3 -right-48 w-96 h-96 opacity-25 blur-3xl rounded-full"
          style={{
            background: "radial-gradient(circle at 50% 50%, rgba(251,146,60,0.5), rgba(251,146,60,0.1), transparent)",
            animation: "appleOrbFloat 12s ease-in-out infinite 0.5s",
          }}
        />
      </div>
      )}

      {/* Transcripción estilo Liquid Glass iOS 26 - Arriba de todo */}
      <div
        className={`fixed bottom-40 right-6 z-50 w-[90%] max-w-md origin-bottom-right pointer-events-auto ${
          open
            ? "opacity-100 scale-100"
            : "opacity-0 scale-75 pointer-events-none"
        }`}
        style={{
          transition: "opacity 400ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Resplandor exterior colorido estilo Siri iOS 26 */}
        <div 
          className="absolute -inset-1.5 rounded-[28px] opacity-70 blur-2xl"
          style={{
            background: `linear-gradient(135deg, rgba(59,130,246,0.5), rgba(168,85,247,0.4), rgba(239,68,68,0.3), rgba(34,197,94,0.3))`,
            animation: "siriGlowSequential 3s ease-in-out infinite",
          }}
        />
        <div 
          className="absolute -inset-1 rounded-[28px] opacity-50 blur-xl"
          style={{
            background: `linear-gradient(225deg, rgba(34,197,94,0.4), rgba(6,182,212,0.3), rgba(59,130,246,0.3))`,
            animation: "siriGlowSequential 3s ease-in-out infinite 0.5s",
          }}
        />
        <div 
          className="relative rounded-[24px] px-6 py-5 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05))`,
            backdropFilter: "blur(40px) saturate(180%)",
            WebkitBackdropFilter: "blur(40px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.2)",
            boxShadow: `
              0 8px 32px rgba(0,0,0,0.25),
              0 0 80px rgba(${primaryColor},0.12),
              inset 0 1px 0 rgba(255,255,255,0.3),
              inset 0 -1px 0 rgba(255,255,255,0.1)
            `,
          }}
        >
          {/* Efecto de luz superior tipo liquid glass */}
          <div 
            className="absolute top-0 left-4 right-4 h-px"
            style={{
              background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)`
            }}
          />
          
          {/* Indicador de estado */}
          <div className="flex items-center justify-center gap-2 mb-3">
            {isListening && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span 
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ backgroundColor: `rgb(${primaryColor})` }}
                  />
                  <span 
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ backgroundColor: `rgb(${primaryColor})`, animationDelay: "0.15s" }}
                  />
                  <span 
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ backgroundColor: `rgb(${primaryColor})`, animationDelay: "0.3s" }}
                  />
                </div>
                <span className="text-xs font-medium" style={{ color: `rgb(${primaryColor})` }}>
                  Escuchando...
                </span>
              </div>
            )}
            {isProcessing && (
              <div className="flex flex-col items-center gap-3">
                {/* Spinner futurista iOS 26 */}
                <div 
                  className={`transition-all duration-500 ease-out ${
                    isProcessing ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                >
                  <div className="relative w-12 h-12 flex items-center justify-center">
                    {/* Anillo exterior giratorio */}
                    <div 
                      className="absolute inset-0 rounded-full animate-spin-slow"
                      style={{
                        background: `conic-gradient(from 0deg, transparent, rgba(${primaryColor},0.8), transparent)`,
                        filter: "blur(6px)",
                        animationDuration: "1.5s",
                      }}
                    />
                    {/* Anillo medio */}
                    <div 
                      className="absolute inset-1.5 rounded-full animate-spin-reverse"
                      style={{
                        background: `conic-gradient(from 180deg, transparent, rgba(${primaryColor},0.6), transparent)`,
                        filter: "blur(4px)",
                        animationDuration: "2s",
                      }}
                    />
                    {/* Centro brillante */}
                    <div 
                      className="absolute inset-3 rounded-full animate-pulse"
                      style={{
                        background: `radial-gradient(circle, rgba(${primaryColor},0.9), rgba(${primaryColor},0.4))`,
                        boxShadow: `0 0 16px rgba(${primaryColor},0.6), inset 0 0 8px rgba(255,255,255,0.3)`,
                      }}
                    />
                    {/* Puntos orbitales */}
                    <div className="absolute inset-0 animate-spin" style={{ animationDuration: "2s" }}>
                      <div 
                        className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: `rgb(${primaryColor})`, boxShadow: `0 0 6px rgba(${primaryColor},0.8)` }}
                      />
                    </div>
                    <div className="absolute inset-0 animate-spin-reverse" style={{ animationDuration: "1.8s" }}>
                      <div 
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                        style={{ backgroundColor: `rgb(${primaryColor})`, boxShadow: `0 0 4px rgba(${primaryColor},0.8)` }}
                      />
                    </div>
                  </div>
                </div>
                <span className="text-xs font-medium" style={{ color: `rgb(${primaryColor})` }}>
                  Interpretando...
                </span>
              </div>
            )}
            {!isListening && !isProcessing && (
              <span className="text-xs text-muted-foreground/70">
                Toca el botón para hablar
              </span>
            )}
          </div>
          
          {/* Transcripción con fade in por palabra */}
          <div 
            className="text-center text-lg md:text-xl font-bold text-foreground min-h-[3.5rem] max-h-28 overflow-y-auto leading-relaxed"
            style={{ 
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {transcript ? (
              transcript.split(' ').map((word, index) => (
                <span 
                  key={index} 
                  className="inline-block animate-fade-in-word"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  {word}&nbsp;
                </span>
              ))
            ) : (
              <span className="text-muted-foreground/70 font-normal text-base">
                La transcripción aparecerá aquí...
              </span>
            )}
          </div>

          {error && (
            <p className="text-xs text-destructive text-center mt-2">
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Botón flotante futurista con transparencia y blur */}
      <button
        onClick={handleFloatingButtonClick}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full text-white transition-all duration-500 flex items-center justify-center group backdrop-blur-xl border border-white/20`}
        style={open ? {
          background: `linear-gradient(135deg, rgba(${primaryColor},0.85), rgba(${primaryColor},0.6))`,
          boxShadow: `0 0 40px rgba(${primaryColor},0.6), 0 0 60px rgba(${primaryColor},0.4), inset 0 0 20px rgba(255,255,255,0.1)`
        } : {
          background: `linear-gradient(135deg, rgba(${primaryColor},0.9), rgba(${primaryColor},0.7))`,
          boxShadow: `0 8px 24px rgba(${primaryColor},0.35), 0 0 30px rgba(${primaryColor},0.15)`,
        }}
      >
        {open ? (
          isListening ? (
            <StopCircle className="h-5 w-5" fill="currentColor" />
          ) : (
            <X className="h-5 w-5" />
          )
        ) : (
          <Waves className="h-5 w-5" />
        )}
        {/* Anillos de resplandor animados cuando está activo y escuchando */}
        {open && isListening && (
          <>
            <span 
              className="absolute inset-0 rounded-full animate-pulse"
              style={{ background: `linear-gradient(135deg, rgba(${primaryColor},0.3), rgba(${primaryColor},0.15))` }}
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

      {/* CSS para animaciones */}
      <style jsx global>{`
        @keyframes siriPulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }
        @keyframes fadeInWord {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-word {
          animation: fadeInWord 0.3s ease-out forwards;
          opacity: 0;
        }
        @keyframes spinSlow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes spinReverse {
          from {
            transform: rotate(360deg);
          }
          to {
            transform: rotate(0deg);
          }
        }
        .animate-spin-slow {
          animation: spinSlow 1.5s linear infinite;
        }
        .animate-spin-reverse {
          animation: spinReverse 2s linear infinite;
        }
      `}</style>

      {/* Formularios reales */}
      <TaskSheet
        open={taskFormOpen}
        onOpenChange={setTaskFormOpen}
        task={null}
        users={users as any}
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
      )}
    </>
  );
}
