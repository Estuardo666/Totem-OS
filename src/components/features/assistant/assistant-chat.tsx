"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUp, Check, Loader2, Sparkles, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmAssistantDraft } from "@/actions/assistant-actions";
import { cn } from "@/lib/utils";

// Curva fuerte de ease-out para entradas: respuesta inmediata.
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const SUGGESTIONS = [
  "¿Qué tareas tengo para hoy?",
  "¿Cómo va el mes?",
  "¿Cuánto gasté en software este mes?",
  "Registra un gasto de 25 en comida",
];

const TOOL_LABELS: Record<string, string> = {
  buscarClientes: "Buscando clientes",
  buscarUsuarios: "Buscando equipo",
  listarTareas: "Revisando tareas",
  listarGastos: "Revisando gastos",
  listarHonorarios: "Revisando honorarios",
  resumenMetricas: "Calculando métricas",
  crearGasto: "Preparando gasto",
  crearTarea: "Preparando tarea",
  registrarHonorario: "Preparando honorario",
};

const DRAFT_TITLES: Record<string, string> = {
  crearGasto: "Nuevo gasto",
  crearTarea: "Nueva tarea",
  registrarHonorario: "Pago de honorarios",
};

interface DraftOutput {
  status: "requires_confirmation";
  action: string;
  summary: Record<string, string | number | null>;
  draftToken: string;
}

function isDraft(output: unknown): output is DraftOutput {
  return (
    typeof output === "object" &&
    output !== null &&
    (output as DraftOutput).status === "requires_confirmation" &&
    typeof (output as DraftOutput).draftToken === "string"
  );
}

type ToolPart = { type: string; state: string; output?: unknown; errorText?: string };

/** Logos de clientes que devolvieron las herramientas en la conversación. */
const ClientLogos = createContext<Map<string, string>>(new Map());

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function Avatar({ src, name, className }: { src?: string | null; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-1 ring-border",
        className
      )}
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/** Negritas: si el texto es un cliente conocido, va con su logo al lado. */
function Strong({ children }: { children?: React.ReactNode }) {
  const logos = useContext(ClientLogos);
  const text = typeof children === "string" ? children : Array.isArray(children) ? children.join("") : "";
  const logo = text ? logos.get(text.trim()) : undefined;
  if (logo) {
    return (
      <strong className="inline-flex items-center gap-1.5 align-bottom font-semibold text-foreground">
        <Avatar src={logo} name={text} className="h-5 w-5" />
        {children}
      </strong>
    );
  }
  return <strong className="font-semibold text-foreground">{children}</strong>;
}

const MARKDOWN: Components = {
  strong: Strong,
  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
  // Viñeta propia con ::before para que las listas anidadas (tareas bajo cada
  // cliente) queden indentadas y alineadas.
  ul: ({ children }) => <ul className="space-y-1.5 [&_ul]:mt-1.5 [&_ul]:space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1.5 pl-5">{children}</ol>,
  li: ({ children }) => (
    <li className="relative pl-4 leading-relaxed before:absolute before:left-0.5 before:top-[0.7em] before:h-1 before:w-1 before:rounded-full before:bg-muted-foreground/50 [&_li]:text-muted-foreground [&_li_strong]:text-foreground [&>p]:inline">
      {children}
    </li>
  ),
};

function DraftCard({ draft }: { draft: DraftOutput }) {
  const [state, setState] = useState<"idle" | "done" | "cancelled" | { error: string }>("idle");
  const [isPending, startTransition] = useTransition();
  const logos = useContext(ClientLogos);

  const confirm = () =>
    startTransition(async () => {
      const result = await confirmAssistantDraft(draft.draftToken);
      setState(result.success ? "done" : { error: result.error ?? "No se pudo guardar" });
    });

  const rows = Object.entries(draft.summary).filter(([, v]) => v !== null && v !== "");

  return (
    <motion.div
      initial={{ opacity: 0, transform: "translateY(6px) scale(0.98)" }}
      animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
      transition={{ duration: 0.24, ease: EASE_OUT }}
      className="mt-3 overflow-hidden rounded-2xl border bg-card/80 shadow-sm backdrop-blur"
    >
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <p className="text-sm font-semibold">{DRAFT_TITLES[draft.action] ?? draft.action}</p>
        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
          Por confirmar
        </span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 px-4 py-3 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="flex min-w-0 items-center gap-1.5 break-words font-medium">
              {k === "Cliente" && typeof v === "string" && <Avatar src={logos.get(v)} name={v} className="h-4 w-4" />}
              {typeof v === "number" && k === "Monto" ? `$${v.toFixed(2)}` : v}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center gap-2 border-t bg-muted/30 px-4 py-2.5">
        <AnimatePresence mode="wait" initial={false}>
          {state === "idle" || typeof state === "object" ? (
            <motion.div
              key="actions"
              exit={{ opacity: 0, filter: "blur(2px)" }}
              transition={{ duration: 0.15 }}
              className="flex flex-wrap items-center gap-2"
            >
              <Button size="sm" onClick={confirm} disabled={isPending} className="transition-transform active:scale-[0.97]">
                {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                Confirmar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setState("cancelled")}
                disabled={isPending}
                className="transition-transform active:scale-[0.97]"
              >
                Cancelar
              </Button>
              {typeof state === "object" && <span className="text-xs text-destructive">{state.error}</span>}
            </motion.div>
          ) : (
            <motion.span
              key="result"
              initial={{ opacity: 0, filter: "blur(2px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium",
                state === "done" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
              )}
            >
              {state === "done" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              {state === "done" ? "Guardado" : "Cancelado"}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function ToolStatus({ part }: { part: ToolPart }) {
  const name = part.type.slice(5);
  const done = part.state === "output-available";
  if (part.state === "output-error") {
    return (
      <p className="text-xs text-destructive">
        {TOOL_LABELS[name] ?? name}: {part.errorText}
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {done ? <Check className="h-3 w-3" /> : <Loader2 className="h-3 w-3 animate-spin" />}
      <span className={cn(!done && "animate-pulse")}>{TOOL_LABELS[name] ?? name}</span>
    </p>
  );
}

function AssistantBubble({ message }: { message: UIMessage }) {
  return (
    <div className="min-w-0 flex-1 space-y-2.5 pt-0.5 text-[15px]">
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          return (
            <div key={i} className="space-y-2.5">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN}>
                {part.text}
              </ReactMarkdown>
            </div>
          );
        }
        if (part.type.startsWith("tool-")) {
          const toolPart = part as unknown as ToolPart;
          if (toolPart.state === "output-available" && isDraft(toolPart.output)) {
            return <DraftCard key={i} draft={toolPart.output} />;
          }
          return <ToolStatus key={i} part={toolPart} />;
        }
        return null;
      })}
    </div>
  );
}

function AssistantMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm",
        className
      )}
    >
      <Sparkles className="h-3.5 w-3.5" />
    </span>
  );
}

export function AssistantChat({ userName, userImage }: { userName: string; userImage?: string | null }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/assistant/chat" }),
  });
  const busy = status === "submitted" || status === "streaming";

  const logos = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of messages) {
      for (const part of m.parts) {
        const out = (part as unknown as ToolPart).output as { logos?: Record<string, string> } | undefined;
        if (part.type.startsWith("tool-") && out?.logos) {
          for (const [name, url] of Object.entries(out.logos)) map.set(name, url);
        }
      }
    }
    return map;
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "end" });
  }, [messages, status, reduceMotion]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    void sendMessage({ text: trimmed });
    setInput("");
  };

  // Con movimiento reducido solo hay fundido, sin desplazamiento.
  const enter = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, transform: "translateY(8px)" },
        animate: { opacity: 1, transform: "translateY(0px)" },
      };

  return (
    <ClientLogos.Provider value={logos}>
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
            {messages.length === 0 && (
              <motion.div {...enter} transition={{ duration: 0.3, ease: EASE_OUT }} className="space-y-6 py-12 text-center">
                <AssistantMark className="mx-auto h-12 w-12 [&_svg]:h-5 [&_svg]:w-5" />
                <div className="space-y-1">
                  <h1 className="text-xl font-semibold tracking-tight">Hola, {userName.split(" ")[0]}</h1>
                  <p className="text-sm text-muted-foreground">
                    ¿Qué revisamos hoy? Tareas, gastos, métricas o algo que registrar.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s, i) => (
                    <motion.button
                      key={s}
                      type="button"
                      {...enter}
                      transition={{ duration: 0.25, ease: EASE_OUT, delay: 0.08 + i * 0.04 }}
                      onClick={() => send(s)}
                      className="rounded-full border bg-card px-3.5 py-1.5 text-sm text-muted-foreground transition-[transform,color,background-color] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.97]"
                    >
                      {s}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {messages.map((m) => (
              <motion.div
                key={m.id}
                {...enter}
                transition={{ duration: 0.22, ease: EASE_OUT }}
                className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}
              >
                {m.role === "user" ? (
                  <Avatar src={userImage} name={userName} className="mt-0.5 h-7 w-7 text-[11px]" />
                ) : (
                  <AssistantMark className="mt-0.5 h-7 w-7" />
                )}
                {m.role === "user" ? (
                  <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-[15px] leading-relaxed text-primary-foreground">
                    {m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")}
                  </p>
                ) : (
                  <AssistantBubble message={m} />
                )}
              </motion.div>
            ))}

            <AnimatePresence>
              {status === "submitted" && (
                <motion.div
                  key="thinking"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  className="flex items-center gap-3"
                >
                  <AssistantMark className="h-7 w-7" />
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
                        animate={reduceMotion ? undefined : { opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error.message}
              </p>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="px-4 pb-4 pt-2">
          <form
            className="mx-auto flex max-w-2xl items-end gap-2 rounded-2xl border bg-card px-3 py-2 shadow-sm transition-shadow duration-200 focus-within:shadow-md"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Pregunta o pide algo…"
              className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-[15px] outline-none placeholder:text-muted-foreground"
            />
            {busy ? (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={() => stop()}
                aria-label="Detener"
                className="h-9 w-9 rounded-xl transition-transform active:scale-[0.95]"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim()}
                aria-label="Enviar"
                className="h-9 w-9 rounded-xl transition-transform active:scale-[0.95]"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </form>
        </div>
      </div>
    </ClientLogos.Provider>
  );
}
