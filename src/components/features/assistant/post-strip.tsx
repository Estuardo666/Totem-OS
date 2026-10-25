"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/** Publicación destacada que devuelven las herramientas de Meta. */
export interface PostCardData {
  miniatura: string | null;
  enlace: string | null;
  formato: string;
  cliente: string;
  fecha: string;
  alcance: number;
  vistas: number;
  engagementPct: number | null;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const compact = new Intl.NumberFormat("es", { notation: "compact", maximumFractionDigits: 1 });

/** Extrae las publicaciones destacadas de la salida de una herramienta. */
export function postsFromOutput(output: unknown): PostCardData[] {
  const posts = (output as { publicacionesDestacadas?: PostCardData[] } | undefined)?.publicacionesDestacadas;
  return Array.isArray(posts) ? posts : [];
}

function Thumb({ src }: { src: string | null }) {
  // Las URLs de la CDN de Meta caducan: si falla, queda el fondo neutro.
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className="h-full w-full bg-gradient-to-br from-muted to-muted/40" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
  );
}

/** Fila deslizable de miniaturas de publicaciones, con sus cifras clave. */
export function PostStrip({ posts, className }: { posts: PostCardData[]; className?: string }) {
  const reduceMotion = useReducedMotion();
  if (!posts.length) return null;
  return (
    <div className={cn("-mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]", className)}>
      {posts.map((p, i) => {
        const card = (
          <>
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-muted">
              <Thumb src={p.miniatura} />
              <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-xs font-medium text-white backdrop-blur">
                {p.formato}
              </span>
            </div>
            <div className="mt-1.5 space-y-0.5 px-0.5">
              <p className="truncate text-xs font-semibold">{p.cliente}</p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {p.alcance > 0 ? `${compact.format(p.alcance)} alcance` : `${compact.format(p.vistas)} vistas`}
                {p.engagementPct !== null ? ` · ${p.engagementPct}% ER` : ""}
              </p>
            </div>
          </>
        );
        return (
          <motion.div
            key={`${p.enlace ?? p.fecha}-${i}`}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, filter: "blur(6px)", transform: "translateY(8px)" }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, filter: "blur(0px)", transform: "translateY(0px)" }}
            transition={{ duration: 0.4, ease: EASE_OUT, delay: i * 0.05 }}
            className="w-[124px] shrink-0 snap-start"
          >
            {p.enlace ? (
              <a
                href={p.enlace}
                target="_blank"
                rel="noopener noreferrer"
                className="block transition-transform duration-150 active:scale-[0.97]"
              >
                {card}
              </a>
            ) : (
              card
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
