"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, CheckCircle2, CircleAlert, RefreshCw, Sparkles, TrendingUp, TriangleAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { Digest } from "@/lib/assistant/digest";

type Insight = Digest["finanzas"][number];

const TONES: Record<Insight["tono"], { icon: typeof Sparkles; className: string }> = {
  positivo: { icon: TrendingUp, className: "text-[hsl(var(--theme-success))] bg-[hsl(var(--theme-success)/0.12)]" },
  atencion: { icon: CircleAlert, className: "text-[hsl(var(--theme-warning))] bg-[hsl(var(--theme-warning)/0.12)]" },
  riesgo: { icon: TriangleAlert, className: "text-[hsl(var(--theme-error))] bg-[hsl(var(--theme-error)/0.12)]" },
  neutral: { icon: CheckCircle2, className: "text-muted-foreground bg-muted" },
};

const EASE = [0.23, 1, 0.32, 1] as const;

export function AiDigest({ showFinance }: { showFinance: boolean }) {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reduce = useReducedMotion();

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/assistant/digest", { method: refresh ? "POST" : "GET", cache: "no-store" });
      const data = (await res.json()) as { digest?: Digest; error?: string };
      if (!res.ok || !data.digest) throw new Error(data.error ?? "No se pudo generar el digest.");
      setDigest(data.digest);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el digest.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = [
    ...(showFinance ? [{ key: "finanzas", label: "Finanzas", items: digest?.finanzas ?? [] }] : []),
    { key: "tareas", label: "Operación", items: digest?.tareas ?? [] },
  ];

  return (
    <section
      aria-label="Digest inteligente"
      aria-busy={loading}
      className="relative mb-5 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_8px_30px_hsl(var(--foreground)/0.03)]"
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--theme-info)/0.6)] to-transparent" />
      <header className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--theme-info)/0.12)] text-[hsl(var(--theme-info))]">
            <Sparkles className="size-4" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Digest del día</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {loading
                ? digest ? "Actualizando con datos de ahora…" : "Analizando tareas y finanzas… puede tardar unos segundos"
                : digest
                  ? `Generado ${formatDistanceToNow(new Date(digest.generadoEn), { locale: es, addSuffix: true })} con el asistente`
                  : "Resumen generado con IA a partir de tus datos"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading}
          title="Se genera una vez al día. Actualiza para recalcular con datos de ahora."
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border/70 px-3 text-xs font-medium text-muted-foreground transition-[color,background-color,transform] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.97] disabled:opacity-60"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />{loading ? "Actualizando" : "Actualizar"}
        </button>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {loading && !digest ? (
          <motion.div key="skeleton" exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-3 px-5 pb-5 pt-4 sm:px-6">
            <div className="h-5 w-3/4 animate-pulse rounded-md bg-foreground/[0.07]" />
            <div className={`grid gap-3 ${showFinance ? "md:grid-cols-2" : ""}`}>
              {columns.map((c) => (
                <div key={c.key} className="space-y-2">
                  {[0, 1].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-foreground/[0.05]" />)}
                </div>
              ))}
            </div>
          </motion.div>
        ) : error && !digest ? (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap items-center justify-between gap-3 px-5 pb-5 pt-4 sm:px-6">
            <p className="text-sm text-muted-foreground">{error}</p>
            <button type="button" onClick={() => load(true)} className="text-xs font-medium text-primary hover:underline">Reintentar</button>
          </motion.div>
        ) : digest ? (
          <motion.div
            key={digest.generadoEn}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: loading ? 0.55 : 1, y: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="px-5 pb-5 pt-3 sm:px-6"
          >
            <p className="text-balance text-[17px] font-medium leading-snug tracking-[-0.015em] text-foreground">{digest.titular}</p>
            <div className={`mt-4 grid gap-4 ${showFinance ? "md:grid-cols-2" : ""}`}>
              {columns.map((col) => (
                <div key={col.key}>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{col.label}</p>
                  <ul className="space-y-2">
                    {col.items.length === 0 && <li className="text-xs text-muted-foreground">Sin novedades relevantes.</li>}
                    {col.items.map((item, i) => {
                      const tone = TONES[item.tono] ?? TONES.neutral;
                      const Icon = tone.icon;
                      const body = (
                        <>
                          <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md ${tone.className}`}><Icon className="size-3.5" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-medium leading-snug">{item.titulo}</span>
                            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{item.detalle}</span>
                          </span>
                          {item.enlace && <ArrowRight className="mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" />}
                        </>
                      );
                      return (
                        <motion.li
                          key={`${col.key}-${i}`}
                          initial={reduce ? false : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25, ease: EASE, delay: reduce ? 0 : 0.05 + i * 0.04 }}
                        >
                          {item.enlace?.startsWith("/") ? (
                            <Link href={item.enlace} className="group flex gap-3 rounded-xl border border-border/60 p-3 transition-colors hover:bg-muted/30">{body}</Link>
                          ) : (
                            <div className="flex gap-3 rounded-xl border border-border/60 p-3">{body}</div>
                          )}
                        </motion.li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            {digest.acciones.length > 0 && (
              <div className="mt-4 rounded-xl bg-muted/45 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Siguientes pasos</p>
                <ol className="mt-2 space-y-1.5">
                  {digest.acciones.map((a, i) => (
                    <li key={i} className="flex gap-2.5 text-[13px]">
                      <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-background text-[10px] font-semibold tabular-nums text-muted-foreground ring-1 ring-border">{i + 1}</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
