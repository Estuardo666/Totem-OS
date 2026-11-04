"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, CheckCircle2, Info, Loader2 } from "lucide-react";
import { getPendingReimbursements, markExpenseAsReimbursed } from "@/actions/finance-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/currency-format";
import type { PendingReimbursement } from "@/lib/finance-expense-service";
import { getCategoryLabel } from "./sortable-utils";

interface PendingExpensesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  /** Solo un administrador puede marcar gastos como devueltos. */
  canMarkReturned?: boolean;
}

type LoadState = "loading" | "ready" | "error";

interface MonthGroup {
  key: string;
  label: string;
  subtotal: number;
  items: PendingReimbursement[];
}

const monthFormatter = new Intl.DateTimeFormat("es-EC", { month: "long", year: "numeric" });
const dayFormatter = new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short" });

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Agrupa por mes, del más antiguo al más reciente (la lista ya llega ordenada). */
function groupByMonth(items: PendingReimbursement[]): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();
  for (const item of items) {
    const date = new Date(item.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, label: capitalize(monthFormatter.format(date)), subtotal: 0, items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
    group.subtotal += item.amount;
  }
  return [...groups.values()];
}

/**
 * Detalle de "Gastos por Reembolsar" en la liquidación. Muestra lo mismo que
 * suma la tarjeta: todo gasto que la persona pagó de su bolsillo y que aún no
 * se le devolvió, de cualquier mes.
 */
export function PendingExpensesDialog({
  open,
  onOpenChange,
  userId,
  userName,
  canMarkReturned = false,
}: PendingExpensesDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<PendingReimbursement[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const firstName = userName.trim().split(/\s+/)[0] || userName;

  const load = useCallback(async () => {
    setState("loading");
    setConfirmingId(null);
    try {
      const result = await getPendingReimbursements(userId);
      if (result.success && result.data) {
        setItems(result.data);
        setState("ready");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }, [userId]);

  useEffect(() => {
    if (open && userId) void load();
  }, [open, userId, load]);

  const groups = useMemo(() => groupByMonth(items), [items]);
  const total = useMemo(() => items.reduce((sum, item) => sum + item.amount, 0), [items]);

  const markReturned = async (item: PendingReimbursement) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast({
        variant: "destructive",
        title: "Sin conexión",
        description: "Conéctate a internet para marcar el gasto como devuelto.",
      });
      return;
    }

    setMarkingId(item.id);
    try {
      const result = await markExpenseAsReimbursed(item.id);
      if (!result.success) throw new Error(result.error);
      setItems((current) => current.filter((row) => row.id !== item.id));
      setConfirmingId(null);
      toast({
        title: "Marcado como devuelto",
        description: `${item.description} · ${formatCurrency(item.amount)}`,
      });
      router.refresh();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo marcar como devuelto",
        description: error instanceof Error && error.message ? error.message : "Inténtalo de nuevo.",
      });
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto custom-scroll">
        <DialogHeader>
          <DialogTitle>Gastos por devolver a {firstName}</DialogTitle>
          <DialogDescription>
            {firstName} pagó estos gastos con su propio dinero. Aquí ves lo que la empresa todavía
            le tiene que devolver, de todos los meses.
          </DialogDescription>
        </DialogHeader>

        {state === "loading" && (
          <div className="space-y-3" aria-busy="true" aria-label="Cargando gastos">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" aria-hidden />
            <p className="text-sm text-muted-foreground">No pudimos cargar los gastos.</p>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Reintentar
            </Button>
          </div>
        )}

        {state === "ready" && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-600" aria-hidden />
            <p className="font-medium">Todo al día</p>
            <p className="text-sm text-muted-foreground">
              No hay gastos pendientes de devolver a {firstName}.
            </p>
          </div>
        )}

        {state === "ready" && items.length > 0 && (
          <div className="space-y-5">
            <div className="flex items-end justify-between gap-4 rounded-xl bg-orange-50 p-4 dark:bg-orange-950/20">
              <div>
                <p className="text-sm text-muted-foreground">Le debemos</p>
                <p className="text-3xl font-bold tabular-nums text-orange-600">{formatCurrency(total)}</p>
              </div>
              <p className="text-right text-sm text-muted-foreground">
                {items.length} {items.length === 1 ? "gasto" : "gastos"}
                <br />
                desde {groups[0].label.toLowerCase()}
              </p>
            </div>

            {groups.map((group) => (
              <section key={group.key} aria-label={group.label} className="space-y-2">
                <div className="flex items-center justify-between px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <span>{group.label}</span>
                  <span className="tabular-nums">{formatCurrency(group.subtotal)}</span>
                </div>
                <ul className="space-y-2">
                  {group.items.map((item) => {
                    const isConfirming = confirmingId === item.id;
                    const isMarking = markingId === item.id;
                    const details = [
                      dayFormatter.format(new Date(item.date)),
                      getCategoryLabel(item.category),
                      item.clientName,
                    ].filter(Boolean);

                    return (
                      <li key={item.id} className="space-y-2 rounded-lg bg-muted/40 p-3">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium" title={item.description}>
                              {item.description}
                            </p>
                            <p className="mt-0.5 break-words text-xs text-muted-foreground">{details.join(" · ")}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-semibold tabular-nums">{formatCurrency(item.amount)}</p>
                            {canMarkReturned && !isConfirming && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 h-8 gap-1 px-3 text-xs"
                                disabled={markingId !== null}
                                onClick={() => setConfirmingId(item.id)}
                              >
                                <Check className="h-3.5 w-3.5" aria-hidden />
                                Ya se lo devolví
                              </Button>
                            )}
                          </div>
                        </div>

                        {isConfirming && (
                          <div className="space-y-2 rounded-md bg-background p-3" role="group" aria-label="Confirmar devolución">
                            <p className="text-sm">
                              ¿Ya le devolviste {formatCurrency(item.amount)} a {firstName}? Dejará de
                              aparecer como pendiente y no se puede deshacer.
                            </p>
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isMarking}
                                onClick={() => setConfirmingId(null)}
                              >
                                Cancelar
                              </Button>
                              <Button size="sm" disabled={isMarking} onClick={() => void markReturned(item)}>
                                {isMarking && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                                Sí, ya se lo devolví
                              </Button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}

            {canMarkReturned && (
              <p className="flex gap-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  ¿Le vas a devolver todo junto? Cierra esta ventana y usa <strong>Pagar</strong>: incluye
                  estos gastos y los marca como devueltos.
                </span>
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
