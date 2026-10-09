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

export const CLOSURE_OPTIONS = [
  { value: "FULL", label: "Cobrar completo", hint: "Se cumplió el plan del mes" },
  { value: "PARTIAL", label: "Cobrar una parte", hint: "Se hizo solo parte del trabajo" },
  { value: "NONE", label: "No cobrar este mes", hint: "No hubo trabajo o se pausó" },
] as const;

export function getClosureLabel(status: ClientMonthlyClosureInput["accrualStatus"]) {
  return CLOSURE_OPTIONS.find((option) => option.value === status)?.label ?? status;
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
          <DialogTitle>{item ? item.clientName : "Cerrar mes"}</DialogTitle>
          <DialogDescription>
            {item
              ? `Plan de ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(item.monthlyRate)} · ${new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1))}`
              : "Selecciona un cliente para registrar su cierre mensual."}
          </DialogDescription>
        </DialogHeader>

        {item ? (
          <div className="space-y-5 overflow-y-auto px-6 pb-6">
            <div className="rounded-xl border bg-muted/30 p-4 text-sm">
              <p className="font-medium">Trabajo entregado en el mes</p>
              <p className="mt-1 text-muted-foreground">
                Reels {item.evidence.publishedReels + item.evidence.approvedReels} de {item.monthlyReels}
                {" · "}Diseños {item.evidence.publishedFlyers + item.evidence.approvedFlyers} de {item.monthlyFlyers}
                {item.evidence.completedShoots > 0 ? ` · ${item.evidence.completedShoots} rodaje(s)` : ""}
              </p>
              <p className="mt-2 text-muted-foreground">
                Sugerencia: <span className="font-medium text-foreground">{getClosureLabel(item.recommendation.status)}</span>
                {item.recommendation.status !== "NONE" ? ` (${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(item.recommendation.amount)})` : ""}
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="accrualStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>¿Cuánto cuenta como ingreso de este mes?</FormLabel>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {CLOSURE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            disabled={isPending}
                            onClick={() => {
                              field.onChange(option.value);
                              if (option.value === "FULL") form.setValue("accruedAmount", item.monthlyRate, { shouldValidate: true });
                            }}
                            className={`rounded-xl border p-3 text-left transition-colors ${field.value === option.value ? "border-primary bg-primary/10" : "hover:bg-muted/50"}`}
                          >
                            <p className="text-sm font-semibold">{option.label}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{option.hint}</p>
                          </button>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accruedAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto que cuenta este mes</FormLabel>
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
                      <FormLabel>Nota (opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={2}
                          placeholder="Ej.: faltaron 2 diseños, se cobran el próximo mes."
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
                    {isPending ? "Guardando..." : "Guardar"}
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