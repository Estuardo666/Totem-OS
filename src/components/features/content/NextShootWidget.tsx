"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NextShootWidgetProps {
  shoots: Array<{
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
    address?: string | null;
    mapLink?: string | null;
    scriptUrl?: string | null;
    notes?: string | null;
    client: {
      id: string;
      name: string;
      logo?: string | null;
      color?: string | null;
    };
    crew: Array<{
      id: string;
      name: string;
      image: string | null;
    }>;
  }>;
}

const initials = (name: string) =>
  name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2);

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Próximos rodajes como carrusel: un rodaje por diapositiva, flechas y puntos
 * para navegar y deslizamiento en táctil. La pista se mueve con transform
 * (interrumpible y en GPU) con la curva de cajón de iOS.
 */
export function NextShootWidget({ shoots }: NextShootWidgetProps) {
  const [index, setIndex] = useState(0);
  const [openNotes, setOpenNotes] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);

  if (shoots.length === 0) {
    return (
      <section className="rounded-2xl bg-card p-5">
        <h2 className="text-xl font-semibold">Próximos rodajes</h2>
        <p className="mt-1 text-sm text-muted-foreground">No hay rodajes programados.</p>
      </section>
    );
  }

  const total = shoots.length;
  const go = (next: number) => {
    setIndex((next + total) % total);
    setOpenNotes(null);
  };

  return (
    <section className="rounded-2xl bg-card p-5" aria-roledescription="carrusel" aria-label="Próximos rodajes">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">Próximos rodajes</h2>
          <p className="text-xs text-muted-foreground tabular-nums">
            {index + 1} de {total}
          </p>
        </div>
        {total > 1 && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => go(index - 1)} aria-label="Rodaje anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => go(index + 1)} aria-label="Rodaje siguiente">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div
        className="overflow-hidden rounded-lg"
        onTouchStart={(event) => (touchStartX.current = event.touches[0].clientX)}
        onTouchEnd={(event) => {
          if (touchStartX.current === null) return;
          const delta = event.changedTouches[0].clientX - touchStartX.current;
          if (Math.abs(delta) > 40) go(delta < 0 ? index + 1 : index - 1);
          touchStartX.current = null;
        }}
      >
        <div
          className="flex transition-transform duration-420 ease-smooth motion-reduce:transition-none"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {shoots.map((shoot, slideIndex) => {
            const accent = shoot.client.color || "#6366f1";
            const start = new Date(shoot.startTime);
            const end = new Date(shoot.endTime);
            return (
              <article
                key={shoot.id}
                aria-roledescription="diapositiva"
                aria-label={`${slideIndex + 1} de ${total}`}
                aria-hidden={slideIndex !== index}
                className="w-full shrink-0 space-y-4 rounded-lg bg-popover p-4"
              >
                {/* Cliente */}
                <div className="flex items-center gap-3">
                  <div
                    className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md text-sm font-semibold"
                    style={{ backgroundColor: hexToRgba(accent, 0.14), color: accent }}
                  >
                    {shoot.client.logo ? (
                      <Image src={shoot.client.logo} alt="" fill className="object-cover" sizes="44px" />
                    ) : (
                      initials(shoot.client.name)
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{shoot.client.name}</p>
                    <h3 className="truncate text-base font-semibold">{shoot.title}</h3>
                  </div>
                </div>

                {/* Cuándo: fecha y franja como bloque de lectura rápida */}
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground first-letter:uppercase">
                      {format(start, "EEEE d 'de' MMMM", { locale: es })}
                    </p>
                    <p className="whitespace-nowrap text-xl font-semibold tabular-nums">
                      {format(start, "HH:mm")}
                      <span className="mx-1.5 font-normal text-muted-foreground">–</span>
                      {format(end, "HH:mm")}
                    </p>
                  </div>
                  {shoot.crew.length > 0 && (
                    <div className="flex -space-x-2" aria-label={`Equipo: ${shoot.crew.map((m) => m.name).join(", ")}`}>
                      {shoot.crew.slice(0, 4).map((member) => (
                        <Avatar key={member.id} className="h-8 w-8 ring-2 ring-popover" title={member.name}>
                          <AvatarImage src={member.image || undefined} alt={member.name} />
                          <AvatarFallback className="text-xs">{initials(member.name)}</AvatarFallback>
                        </Avatar>
                      ))}
                      {shoot.crew.length > 4 && (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium ring-2 ring-popover">
                          +{shoot.crew.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {shoot.address && (
                  <div className="rounded-md bg-card px-3 py-2.5">
                    <p className="text-sm">{shoot.address}</p>
                    {shoot.mapLink && (
                      <a href={shoot.mapLink} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-block text-xs font-medium text-primary hover:underline">
                        Abrir en Maps
                      </a>
                    )}
                  </div>
                )}

                {shoot.notes && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setOpenNotes(openNotes === shoot.id ? null : shoot.id)}
                      aria-expanded={openNotes === shoot.id}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      {openNotes === shoot.id ? "Ocultar notas" : "Ver notas"}
                    </button>
                    <div
                      className={cn(
                        "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                        openNotes === shoot.id ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      )}
                    >
                      <p className="overflow-hidden whitespace-pre-wrap pt-2 text-sm text-muted-foreground">{shoot.notes}</p>
                    </div>
                  </div>
                )}

                {shoot.scriptUrl && (
                  <Button asChild className="w-full" tabIndex={slideIndex === index ? undefined : -1}>
                    <Link href={shoot.scriptUrl} target="_blank" rel="noopener noreferrer">
                      Ver guiones
                    </Link>
                  </Button>
                )}
              </article>
            );
          })}
        </div>
      </div>

      {total > 1 && (
        <div className="mt-4 flex justify-center gap-1.5" role="tablist" aria-label="Elegir rodaje">
          {shoots.map((shoot, dotIndex) => (
            <button
              key={shoot.id}
              type="button"
              role="tab"
              aria-selected={dotIndex === index}
              aria-label={`Rodaje ${dotIndex + 1}`}
              onClick={() => go(dotIndex)}
              className={cn(
                "h-1.5 rounded-full transition-[width,background-color] duration-300 ease-out",
                dotIndex === index ? "w-5 bg-primary" : "w-1.5 bg-primary/25 hover:bg-primary/40"
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}
