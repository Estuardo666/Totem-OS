"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { saveClientMonthlyClosure, type ClientMonthlyClosurePageData } from "@/actions/finance-actions";
import { clientMonthlyClosureSchema, type ClientMonthlyClosureInput } from "@/schemas/finance";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ClosureItem = ClientMonthlyClosurePageData["items"][number];

interface MonthlyCloseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ClosureItem | null;
  year: number;
  month: number;
}

function getInitialValues(item: ClosureItem | null, year: number, month: number): ClientMonthlyClosureInput {
  return {
    clientId: item?.clientId ?? "",
    year,
    month,
    accrualStatus: item?.closure?.accrualStatus ?? item?.recommendation.status ?? "NONE",
    accruedAmount: item?.closure?.accruedAmount ?? item?.recommendation.amount ?? 0,
    notes: item?.closure?.notes ?? "",
  };
}

function getStatusLabel(status: ClientMonthlyClosureInput["accrualStatus"]) {
  if (status === "FULL") return "Devengado total";
  if (status === "PARTIAL") return "Devengado parcial";
  return "No devengado";
}

export function MonthlyCloseDialog({
  open,
  onOpenChange,
  item,
  year,
  month,
}: MonthlyCloseDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<ClientMonthlyClosureInput>({
    resolver: zodResolver(clientMonthlyClosureSchema),
    defaultValues: getInitialValues(item, year, month),
  });

  const currentStatus = form.watch("accrualStatus");

  useEffect(() => {
    form.reset(getInitialValues(item, year, month));
  }, [form, item, year, month]);

  useEffect(() => {
    if (currentStatus === "NONE") {
      form.setValue("accruedAmount", 0, { shouldValidate: true });
    }
  }, [currentStatus, form]);

  const handleSubmit = (data: ClientMonthlyClosureInput) => {
    startTransition(async () => {
      const result = await saveClientMonthlyClosure(data);

      if (!result.success) {
        toast({
          variant: "destructive",
          title: "No se pudo guardar el cierre",
          description: result.error || "Ocurrió un error al guardar el cierre mensual.",
        });
        return;
      }

      toast({
        title: "Cierre guardado",
        description: "El cierre mensual del cliente fue actualizado correctamente.",
      });
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader>
          <DialogTitle>Cerrar mes del cliente</DialogTitle>
          <DialogDescription>
            {item
              ? `${item.clientName} · ${new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1))}`
              : "Selecciona un cliente para registrar su cierre mensual."}
          </DialogDescription>
        </DialogHeader>

        {item ? (
          <div className="space-y-6 overflow-y-auto px-6 pb-6">
            <div className="grid gap-3 rounded-3xl border border-border/60 bg-muted/30 p-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Sugerencia del sistema</p>
                <p className="mt-2 text-sm font-semibold">{getStatusLabel(item.recommendation.status)}</p>
                <p className="text-sm text-muted-foreground">Monto sugerido: ${item.recommendation.amount.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Fundamento</p>
                <p className="mt-2 text-sm text-muted-foreground">{item.recommendation.reason}</p>
              </div>
            </div>

            <div className="grid gap-3 rounded-3xl border border-border/60 p-4 md:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Publicadas</p>
                <p className="mt-2 text-lg font-semibold">{item.evidence.publishedTasks}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Aprobadas</p>
                <p className="mt-2 text-lg font-semibold">{item.evidence.approvedTasks}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Rodajes</p>
                <p className="mt-2 text-lg font-semibold">{item.evidence.completedShoots}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Horas</p>
                <p className="mt-2 text-lg font-semibold">{item.evidence.trackedHours.toFixed(2)}</p>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="accrualStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Decisión de cierre</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={isPending}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona el cierre" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="FULL">Devengado total</SelectItem>
                          <SelectItem value="PARTIAL">Devengado parcial</SelectItem>
                          <SelectItem value="NONE">No devengado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accruedAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto devengado</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={isPending || currentStatus === "NONE"}
                          value={field.value}
                          onChange={(event) => field.onChange(Number(event.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas del cierre</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={5}
                          placeholder="Explica por qué este cliente sí o no se devenga en el mes."
                          disabled={isPending}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Guardando..." : "Guardar cierre"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}