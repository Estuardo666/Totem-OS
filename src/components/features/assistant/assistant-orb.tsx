"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, CheckSquare, HandCoins, Keyboard, Loader2, Mic, MicOff, Receipt, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssistantChat, Avatar } from "./assistant-chat";
import { type DraftEntry, type VoiceStatus, useLiveVoice } from "./use-live-voice";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;

/** Sin hablar ni escuchar respuesta durante este tiempo, la voz se cierra. */
const IDLE_MS = 10_000;
/** Nivel de micrófono que cuenta como "el usuario está hablando". */
const SPEECH_LEVEL = 0.12;
/** Red de seguridad: corta aunque el estado se quede trabado (p. ej. "pensando"). */
const STUCK_MS = 45_000;
/** Duración máxima de una sesión de voz. */
const MAX_SESSION_MS = 15 * 60_000;

type Mode = "voice" | "chat";

const STATUS_LABEL: Record<VoiceStatus, string> = {
  idle: "Toca el orbe para hablar",
  connecting: "Conectando…",
  listening: "Te escucho",
  thinking: "Revisando…",
  speaking: "Hablando",
  error: "Algo falló",
};

const DRAFT_TITLES: Record<string, string> = {
  crearGasto: "Nuevo gasto",
  crearTarea: "Nueva tarea",
  registrarHonorario: "Pago de honorarios",
};

/** Esfera con degradado vivo; `size` en px. El brillo superior imita vidrio. */
function OrbSphere({ size, active, className }: { size?: number; active?: boolean; className?: string }) {
  return (
    <span
      className={cn("relative block overflow-hidden rounded-full", className)}
      style={size ? { width: size, height: size } : undefined}
      aria-hidden
    >
      <span
        className={cn(
          "absolute inset-[-25%] rounded-full bg-[conic-gradient(from_0deg,#8b5cf6,#6366f1,#38bdf8,#ec4899,#8b5cf6)] motion-safe:animate-[spin_6s_linear_infinite]",
          active && "motion-safe:animate-[spin_2.5s_linear_infinite]"
        )}
      />
      <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.55),transparent_55%)] mix-blend-overlay" />
      <span className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.75),rgba(255,255,255,0)_45%)]" />
      <span className="absolute inset-0 rounded-full shadow-[inset_0_-6px_14px_rgba(30,27,75,0.35),inset_0_2px_6px_rgba(255,255,255,0.4)]" />
    </span>
  );
}

const DRAFT_ICONS: Record<string, typeof Receipt> = {
  crearGasto: Receipt,
  crearTarea: CheckSquare,
  registrarHonorario: HandCoins,
};

/** Aprobación estilo alerta de macOS: compacta, con icono y botones a la derecha. */
function DraftCard({
  draft,
  onConfirm,
  onCancel,
}: {
  draft: DraftEntry;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const error = typeof draft.state === "object" ? draft.state.error : null;
  const open = draft.state === "pending" || Boolean(error);
  const Icon = DRAFT_ICONS[draft.action] ?? Receipt;
  const rows = Object.entries(draft.summary).filter(([, v]) => v !== null && v !== "");
  return (
    <motion.div
      layout
      initial={{ opacity: 0, transform: "translateY(6px) scale(0.97)" }}
      animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
      transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
      className="rounded-xl border border-black/[0.08] bg-white/80 p-3 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.25)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-800/80"
    >
      <div className="flex gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-gradient-to-b from-sky-400 to-blue-600 text-white shadow-sm">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-tight">{DRAFT_TITLES[draft.action] ?? draft.action}</p>
          <dl className="mt-1 space-y-0.5 text-[12px] leading-snug">
            {rows.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="w-16 shrink-0 text-muted-foreground">{k}</dt>
                <dd className={cn("min-w-0 truncate", k === "Monto" && "font-semibold tabular-nums")}>
                  {typeof v === "number" && k === "Monto" ? `$${v.toFixed(2)}` : String(v)}
                </dd>
              </div>
            ))}
          </dl>
          {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
        </div>
      </div>
      <div className="mt-2.5 flex justify-end">
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.div
              key="actions"
              exit={{ opacity: 0, filter: "blur(2px)", transition: { duration: 0.12 } }}
              className="flex gap-1.5"
            >
              <button
                type="button"
                onClick={onCancel}
                className="h-6 rounded-md border border-black/10 bg-white px-3 text-[12px] font-medium shadow-sm transition-transform duration-100 active:scale-[0.97] dark:border-white/10 dark:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="h-6 rounded-md bg-gradient-to-b from-sky-500 to-blue-600 px-3 text-[12px] font-medium text-white shadow-sm shadow-blue-600/30 transition-transform duration-100 active:scale-[0.97]"
              >
                Confirmar
              </button>
            </motion.div>
          ) : (
            <motion.span
              key={typeof draft.state === "string" ? draft.state : "error"}
              initial={{ opacity: 0, filter: "blur(2px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              className="flex h-6 items-center text-[12px]"
            >
              {draft.state === "saving" ? (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Guardando…
                </span>
              ) : draft.state === "done" ? (
                <span className="flex items-center gap-1 font-medium text-emerald-600">
                  <Check className="h-3.5 w-3.5" /> Guardado
                </span>
              ) : (
                <span className="text-muted-foreground">Cancelado</span>
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function VoiceView({
  voice,
  paused,
  onToggle,
  orbRef,
  userName,
  userImage,
}: {
  userName: string;
  userImage: string | null;
  voice: ReturnType<typeof useLiveVoice>;
  paused: boolean;
  onToggle: () => void;
  orbRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const { status, error, transcript, drafts, confirmDraft, cancelDraft } = voice;
  const live = status !== "idle" && status !== "error";
  const bottomRef = useRef<HTMLDivElement>(null);
  const recent = transcript.slice(-6);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [transcript, drafts]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col items-center gap-3 pb-2 pt-4 md:pt-6">
        <button
          ref={orbRef}
          type="button"
          onClick={onToggle}
          disabled={status === "connecting"}
          aria-label={live ? "Terminar conversación" : "Empezar a hablar"}
          className="relative rounded-full transition-transform duration-150 will-change-transform active:scale-[0.96] disabled:opacity-80"
        >
          <span
            className={cn(
              "absolute inset-[-14px] rounded-full bg-violet-500/25 blur-2xl transition-opacity duration-500",
              live ? "opacity-100" : "opacity-40"
            )}
          />
          <OrbSphere className="h-16 w-16 md:h-24 md:w-24" active={status === "thinking" || status === "speaking"} />
          {(status === "connecting" || status === "thinking") && (
            <Loader2 className="absolute inset-0 m-auto h-7 w-7 animate-spin text-white/90" />
          )}
        </button>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={paused && status === "idle" ? "paused" : status}
            initial={{ opacity: 0, filter: "blur(3px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(3px)", transition: { duration: 0.1 } }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="text-[13px] font-medium text-muted-foreground"
          >
            {paused && status === "idle" ? "Pausé la voz para no gastar. Toca el orbe para seguir." : STATUS_LABEL[status]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <div className="space-y-2 pb-4">
          {transcript.length === 0 && !live && !paused && (
            <p className="px-6 pt-2 text-center text-[13px] leading-relaxed text-muted-foreground">
              Pregunta cómo va el mes, qué tareas vencen o dicta un gasto. Confirmas diciendo &ldquo;sí&rdquo; o con el botón.
            </p>
          )}
          <AnimatePresence initial={false}>
            {recent.map((line) => (
              <motion.div
                key={line.id}
                layout="position"
                initial={{ opacity: 0, transform: "translateY(10px) scale(0.94)" }}
                animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
                transition={{ type: "spring", duration: 0.4, bounce: 0.18 }}
                style={{ transformOrigin: line.role === "user" ? "bottom right" : "bottom left" }}
                className={cn("flex items-end gap-2", line.role === "user" && "flex-row-reverse")}
              >
                {line.role === "user" && <Avatar src={userImage} name={userName} className="h-6 w-6 shrink-0 text-[10px]" />}
                <p
                  className={cn(
                    "max-w-[85%] rounded-[20px] px-3.5 py-2 text-[14px] leading-snug",
                    line.role === "user"
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md bg-muted/70 text-foreground"
                  )}
                >
                  {line.text}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
          {drafts.map((d) => (
            <DraftCard
              key={d.draftToken}
              draft={d}
              onConfirm={() => void confirmDraft(d.draftToken)}
              onCancel={() => cancelDraft(d.draftToken)}
            />
          ))}
          {error && (
            <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-[13px] text-destructive">
              {error}
            </p>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

/**
 * Orbe flotante del asistente: abre un panel con voz (predeterminada) y chat.
 * La voz se cierra sola tras 10 s sin actividad para no consumir tokens.
 */
export function AssistantOrb() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("voice");
  const [paused, setPaused] = useState(false);
  const [chatMounted, setChatMounted] = useState(false);
  const voice = useLiveVoice();
  const { status, transcript, drafts, start, stop, reset, prefetchToken, getInputLevel } = voice;
  const [chatKey, setChatKey] = useState(0);
  const live = status !== "idle" && status !== "error";

  const orbRef = useRef<HTMLButtonElement>(null);
  const lastActivityRef = useRef(0);
  const statusRef = useRef(status);
  statusRef.current = status;

  const startVoice = useCallback(() => {
    setPaused(false);
    lastActivityRef.current = Date.now();
    void start();
  }, [start]);

  /** Terminar: corta la voz y deja la ventana limpia para empezar de cero. */
  const endConversation = useCallback(() => {
    stop();
    reset();
    setPaused(false);
    setChatKey((k) => k + 1);
  }, [stop, reset]);

  const close = useCallback(() => {
    setOpen(false);
    stop();
    setPaused(false);
  }, [stop]);

  // Cualquier cambio de la conversación cuenta como actividad.
  useEffect(() => {
    lastActivityRef.current = Date.now();
  }, [status, transcript, drafts]);

  // Bucle por frame: anima el orbe con la voz del usuario y cierra por inactividad.
  useEffect(() => {
    if (!live) return;
    const orb = orbRef.current;
    const startedAt = Date.now();
    let raf = 0;
    let smooth = 0;
    const tick = () => {
      const level = getInputLevel();
      const now = Date.now();
      if (level > SPEECH_LEVEL) lastActivityRef.current = now;
      smooth += (level - smooth) * 0.25;
      if (orb && !reduceMotion) {
        orb.style.transform = `scale(${1 + Math.min(smooth, 1) * 0.12})`;
      }
      const idle = now - lastActivityRef.current;
      if (
        (statusRef.current === "listening" && idle > IDLE_MS) ||
        idle > STUCK_MS ||
        now - startedAt > MAX_SESSION_MS
      ) {
        stop();
        setPaused(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (orb) orb.style.transform = "";
    };
  }, [live, getInputLevel, stop, reduceMotion]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    if (next === "chat") {
      setChatMounted(true);
      if (live) stop();
    }
  };

  const hidden =
    !session?.user ||
    pathname?.startsWith("/sign-in") ||
    pathname?.startsWith("/sign-up") ||
    pathname?.startsWith("/admin/assistant");
  if (hidden) return null;

  const userName = session.user.name ?? "Usuario";
  const userImage = session.user.image ?? null;

  const panelMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, transform: "translateY(16px) scale(0.96)" },
        animate: { opacity: 1, transform: "translateY(0px) scale(1)" },
        exit: { opacity: 0, transform: "translateY(12px) scale(0.97)" },
      };

  return (
    <>
      {/* Lanzador: encima del botón de gastos */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="orb-launcher"
            type="button"
            data-totem-web-chrome
            initial={{ opacity: 0, transform: "scale(0.9)" }}
            animate={{ opacity: 1, transform: "scale(1)" }}
            exit={{ opacity: 0, transform: "scale(0.9)", transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            onPointerEnter={prefetchToken}
            onPointerDown={prefetchToken}
            onClick={() => {
              setOpen(true);
              setMode("voice");
              if (!live) startVoice();
            }}
            aria-label="Abrir asistente IA"
            title="Asistente IA"
            className="group fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-[1.125rem] z-40 rounded-full touch-manipulation select-none md:bottom-[4.5rem] md:right-[1.625rem]"
          >
            <span className="absolute inset-[-6px] rounded-full bg-violet-500/30 blur-lg transition-opacity duration-300 group-hover:opacity-100 md:opacity-70" />
            <span className="relative block transition-transform duration-150 ease-out group-hover:scale-105 group-active:scale-[0.94]">
              <OrbSphere size={46} className="shadow-lg shadow-indigo-500/30 ring-1 ring-white/30" />
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="orb-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px] md:bg-transparent md:backdrop-blur-0"
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.section
            key="orb-panel"
            role="dialog"
            aria-label="Asistente IA"
            {...panelMotion}
            transition={{ duration: 0.32, ease: EASE_DRAWER }}
            style={{ transformOrigin: "bottom right" }}
            className="fixed inset-x-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-50 flex h-[min(640px,82dvh)] flex-col overflow-hidden rounded-[28px] border border-white/20 bg-background/85 shadow-2xl shadow-black/20 backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 md:inset-x-auto md:bottom-6 md:right-6 md:w-[400px]"
          >
            <header className="flex items-center gap-2 px-3 pb-1 pt-3">
              <div className="flex flex-1 justify-center pl-9">
                <div className="inline-flex rounded-full bg-muted/80 p-0.5 text-[13px] font-medium">
                  {(
                    [
                      { id: "voice", label: "Voz", icon: Mic },
                      { id: "chat", label: "Chat", icon: Keyboard },
                    ] as const
                  ).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => switchMode(id)}
                      className={cn(
                        "relative flex items-center gap-1.5 rounded-full px-4 py-1.5 transition-colors duration-150",
                        mode === id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {mode === id && (
                        <motion.span
                          layoutId="orb-mode"
                          className="absolute inset-0 rounded-full bg-background shadow-sm"
                          transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
                        />
                      )}
                      <span className="relative flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" /> {label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Cerrar"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/70 text-muted-foreground transition-[background-color,transform] duration-150 hover:bg-muted active:scale-[0.94]"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="relative min-h-0 flex-1">
              <div className={cn("absolute inset-0", mode !== "voice" && "invisible")}>
                <VoiceView userName={userName} userImage={userImage} voice={voice} paused={paused} onToggle={live ? endConversation : startVoice} orbRef={orbRef} />
              </div>
              {chatMounted && (
                <div className={cn("absolute inset-0", mode !== "chat" && "invisible")}>
                  <AssistantChat key={chatKey} userName={userName} userImage={userImage} compact />
                </div>
              )}
            </div>

            {mode === "voice" && (
              <footer className="flex items-center justify-center gap-3 border-t border-border/50 px-4 py-3">
                <button
                  type="button"
                  onClick={live ? endConversation : startVoice}
                  disabled={status === "connecting"}
                  className={cn(
                    "flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-medium transition-[background-color,transform] duration-150 active:scale-[0.97] disabled:opacity-60",
                    live ? "bg-red-500/10 text-red-600 hover:bg-red-500/15" : "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  {live ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  {live ? "Terminar" : paused ? "Seguir hablando" : "Hablar"}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("chat")}
                  aria-label="Escribir en el chat"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-muted/80 text-muted-foreground transition-[background-color,transform] duration-150 hover:bg-muted active:scale-[0.95]"
                >
                  <Keyboard className="h-4 w-4" />
                </button>
              </footer>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
