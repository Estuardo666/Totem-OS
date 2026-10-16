"use client";

import { Check, Loader2, Mic, MicOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type DraftEntry, type VoiceStatus, useLiveVoice } from "./use-live-voice";

const STATUS_LABEL: Record<VoiceStatus, string> = {
  idle: "Toca para hablar",
  connecting: "Conectando…",
  listening: "Te escucho",
  thinking: "Consultando…",
  speaking: "Hablando",
  error: "Error",
};

const DRAFT_TITLES: Record<string, string> = {
  crearGasto: "Nuevo gasto",
  crearTarea: "Nueva tarea",
  registrarHonorario: "Pago de honorarios",
};

function VoiceDraftCard({
  draft,
  onConfirm,
  onCancel,
}: {
  draft: DraftEntry;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const error = typeof draft.state === "object" ? draft.state.error : null;
  return (
    <div className="rounded-xl border bg-card p-3 text-sm shadow-sm">
      <p className="mb-2 font-medium">{DRAFT_TITLES[draft.action] ?? draft.action}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {Object.entries(draft.summary)
          .filter(([, v]) => v !== null && v !== "")
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="break-words">{typeof v === "number" && k === "Monto" ? `$${v.toFixed(2)}` : v}</dd>
            </div>
          ))}
      </dl>
      <div className="mt-3 flex items-center gap-2">
        {draft.state === "pending" || error ? (
          <>
            <Button size="sm" onClick={onConfirm}>
              <Check className="mr-1.5 h-3.5 w-3.5" /> Confirmar
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              <X className="mr-1.5 h-3.5 w-3.5" /> Cancelar
            </Button>
            {error && <span className="text-xs text-destructive">{error}</span>}
          </>
        ) : draft.state === "saving" ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Guardando…
          </span>
        ) : draft.state === "done" ? (
          <span className="flex items-center gap-1.5 text-emerald-600">
            <Check className="h-4 w-4" /> Guardado
          </span>
        ) : (
          <span className="text-muted-foreground">Cancelado</span>
        )}
      </div>
    </div>
  );
}

export function VoicePanel() {
  const { status, error, transcript, drafts, start, stop, confirmDraft, cancelDraft } = useLiveVoice();
  const active = status !== "idle" && status !== "error";

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-3 px-4 py-6">
          {transcript.length === 0 && !active && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Pregunta cómo va el mes, qué tareas vencen o dicta un gasto. Para guardar, di &ldquo;sí&rdquo; o pulsa Confirmar.
            </p>
          )}
          {transcript.map((line) => (
            <div key={line.id} className={cn("flex", line.role === "user" && "justify-end")}>
              <p
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                  line.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/60"
                )}
              >
                {line.text}
              </p>
            </div>
          ))}
          {drafts.map((d) => (
            <VoiceDraftCard
              key={d.draftToken}
              draft={d}
              onConfirm={() => void confirmDraft(d.draftToken)}
              onCancel={() => cancelDraft(d.draftToken)}
            />
          ))}
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 border-t py-5">
        <button
          type="button"
          onClick={active ? stop : () => void start()}
          disabled={status === "connecting"}
          aria-label={active ? "Terminar conversación" : "Empezar a hablar"}
          className={cn(
            "relative flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition",
            active ? "bg-gradient-to-br from-rose-500 to-red-600" : "bg-gradient-to-br from-violet-500 to-indigo-600",
            status === "listening" && "ring-4 ring-violet-400/40",
            status === "speaking" && "animate-pulse"
          )}
        >
          {status === "connecting" || status === "thinking" ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : active ? (
            <MicOff className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </button>
        <p className="text-xs text-muted-foreground">{STATUS_LABEL[status]}</p>
      </div>
    </div>
  );
}
