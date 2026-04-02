"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnimatedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  maxWidthClassName?: string;
}

// Modal reutilizable con animación de altura real (scrollHeight) usando useLayoutEffect.
export function AnimatedModal({ open, onOpenChange, children, title, description, className, maxWidthClassName = "max-w-lg" }: AnimatedModalProps) {
  const measureRef = React.useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = React.useState<number | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;

    const measure = () => {
      const next = el.scrollHeight;
      if (next !== height) setHeight(next);
    };

    // medir en el frame actual y en el siguiente para capturar layout completo
    measure();
    const raf = requestAnimationFrame(measure);

    // observar cambios dinámicos
    const observer = new ResizeObserver(measure);
    observer.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [open, children]);

  React.useLayoutEffect(() => {
    if (open) {
      setReady(true);
    } else {
      setReady(false);
    }
  }, [open]);

  const [viewportHeight, setViewportHeight] = React.useState<number | null>(null);

  React.useEffect(() => {
    const update = () => setViewportHeight(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const fallbackOpenHeight = 400; // altura base para evitar línea fina antes de medir
  const resolvedHeight = height ?? fallbackOpenHeight;
  const maxViewportHeight = viewportHeight ? Math.round(viewportHeight * 0.9) : null;
  const clampedHeight = maxViewportHeight ? Math.min(resolvedHeight, maxViewportHeight) : resolvedHeight;
  const animatedHeight = open ? `${clampedHeight}px` : "0px";
  const animateClassBase = "duration-700 ease-expressive data-[state=closed]:opacity-0 data-[state=closed]:scale-95 data-[state=open]:opacity-100 data-[state=open]:scale-100";
  const shouldAnimateHeight = ready && height !== null;
  const shouldAnimateScale = ready;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/20 backdrop-blur-3xl transition-opacity duration-300 ease-in-out",
            "data-[state=open]:opacity-100 data-[state=closed]:opacity-0",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[93vw] sm:w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[2.5rem] border border-white/20 bg-white/10 dark:bg-black/10 text-black dark:text-white shadow-2xl backdrop-blur-[40px]",
            // Use tailwindcss-animate utilities for entry/exit + fallback transitions
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "transition-transform transition-opacity duration-400 ease-modal",
            "data-[state=open]:opacity-100 data-[state=closed]:opacity-0",
            "data-[state=open]:translate-y-0 data-[state=closed]:translate-y-6",
            "data-[state=open]:scale-100 data-[state=closed]:scale-95",
            shouldAnimateScale
              ? shouldAnimateHeight
                ? `transition-[height,transform,opacity] ${animateClassBase}`
                : `transition-[transform,opacity] ${animateClassBase}`
              : "",
            maxWidthClassName,
            className
          )}
          style={{ height: shouldAnimateHeight ? animatedHeight : "auto", minHeight: open ? fallbackOpenHeight : 0 }}
        >
          <div ref={measureRef} className="relative w-full">
            <DialogPrimitive.Close className="absolute right-4 top-4 z-50 flex h-8 w-8 items-center justify-center rounded-[1.25rem] bg-red-500 p-1 text-white hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
              <X className="h-4 w-4" />
              <span className="sr-only">Cerrar</span>
            </DialogPrimitive.Close>

            {title ? (
              <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
            ) : null}
            {description ? (
              <DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description>
            ) : null}

            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const AnimatedModalTrigger = DialogPrimitive.Trigger;
