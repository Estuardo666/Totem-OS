"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, Check, Loader2, Send, Sparkles, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { confirmAssistantDraft } from "@/actions/assistant-actions";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "¿Cómo va el mes?",
  "¿Qué tareas vencen esta semana?",
  "¿Cuánto gasté en software este mes?",
  "Registra un gasto de 25 en comida",
];

const TOOL_LABELS: Record<string, string> = {
  buscarClientes: "Buscando clientes",
  buscarUsuarios: "Buscando equipo",
  listarTareas: "Consultando tareas",
  listarGastos: "Consultando gastos",
  listarHonorarios: "Consultando honorarios",
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

function DraftCard({ draft }: { draft: DraftOutput }) {
  const [state, setState] = useState<"idle" | "done" | "cancelled" | { error: string }>("idle");
  const [isPending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      const result = await confirmAssistantDraft(draft.draftToken);
      setState(result.success ? "done" : { error: result.error ?? "No se pudo guardar" });
    });

  return (
    <div className="mt-2 rounded-xl border bg-card p-3 text-sm shadow-sm">
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
        {state === "idle" || typeof state === "object" ? (
          <>
            <Button size="sm" onClick={confirm} disabled={isPending}>
              {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
              Confirmar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setState("cancelled")} disabled={isPending}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Cancelar
            </Button>
            {typeof state === "object" && <span className="text-xs text-destructive">{state.error}</span>}
          </>
        ) : state === "done" ? (
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

function MessageParts({ message }: { message: UIMessage }) {
  return (
    <>
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          return message.role === "user" ? (
            <p key={i} className="whitespace-pre-wrap leading-relaxed">
              {part.text}
            </p>
          ) : (
            <div
              key={i}
              className="space-y-2 leading-relaxed [&_li]:pl-0.5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ul]:marker:text-muted-foreground"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
            </div>
          );
        }
        if (part.type.startsWith("tool-")) {
          const name = part.type.slice(5);
          const toolPart = part as { state: string; output?: unknown; errorText?: string };
          if (toolPart.state === "output-available" && isDraft(toolPart.output)) {
            return <DraftCard key={i} draft={toolPart.output} />;
          }
          if (toolPart.state === "output-error") {
            return (
              <p key={i} className="text-xs text-destructive">
                {TOOL_LABELS[name] ?? name}: {toolPart.errorText}
              </p>
            );
          }
          return (
            <p key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {toolPart.state === "output-available" ? (
                <Check className="h-3 w-3" />
              ) : (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
              {TOOL_LABELS[name] ?? name}
            </p>
          );
        }
        return null;
      })}
    </>
  );
}

export function AssistantChat() {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/assistant/chat" }),
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    void sendMessage({ text: trimmed });
    setInput("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
          {messages.length === 0 && (
            <div className="space-y-4 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Asistente Totem</h1>
                <p className="text-sm text-muted-foreground">
                  Consulta tareas, gastos y métricas, o crea gastos, tareas y honorarios.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <Button key={s} variant="outline" size="sm" onClick={() => send(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
              </div>
              <div
                className={cn(
                  "min-w-0 max-w-[85%] space-y-1 rounded-2xl px-3.5 py-2 text-sm",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/60"
                )}
              >
                <MessageParts message={m} />
              </div>
            </div>
          ))}

          {status === "submitted" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Pensando…
            </div>
          )}
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error.message}
            </p>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t bg-background/80 backdrop-blur">
        <form
          className="mx-auto flex max-w-2xl items-end gap-2 px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Escribe un mensaje…"
            className="max-h-40 min-h-[44px] resize-none"
          />
          {busy ? (
            <Button type="button" variant="outline" size="icon" onClick={() => stop()} aria-label="Detener">
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Enviar">
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
