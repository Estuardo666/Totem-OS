"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { upsertClientBillingException } from "@/actions/client-actions";
import { clientBillingExceptionSchema } from "@/schemas/client";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BillingExceptionFormInput = {
  clientId: string;
  period: string;
  type: "SKIP" | "OVERRIDE_AMOUNT" | "MARK_AS_PAID";
  overrideAmount: number | string | null;
  reason: string;
  notes: string | null;
};

type BillingExceptionItem = {
  id: string;
  clientId: string;
  month: number;
  year: number;
  type: string;
  overrideAmount: number | null;
  reason: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MonthlyBillingExceptionCardProps = {
  clientId: string;
  monthlyRate: number;
  exceptions: BillingExceptionItem[];
};

function getCurrentPeriodValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

function formatPeriod(month: number, year: number): string {
  return new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function getTypeLabel(type: string): string {
  if (type === "SKIP") {
    return "No cobrar";
  }

  if (type === "OVERRIDE_AMOUNT") {
    return "Monto especial";
  }

  return "Mes cubierto";
}

export function MonthlyBillingExceptionCard({
  clientId,
  monthlyRate,
  exceptions,
}: MonthlyBillingExceptionCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const sortedExceptions = useMemo(() => {
    return [...exceptions].sort((a, b) => {
      if (a.year !== b.year) {
        return b.year - a.year;
      }

      return b.month - a.month;
    });
  }, [exceptions]);

  const form = useForm<BillingExceptionFormInput>({
    resolver: zodResolver(clientBillingExceptionSchema),
    defaultValues: {
      clientId,
      period: getCurrentPeriodValue(),
      type: "MARK_AS_PAID",
      overrideAmount: monthlyRate,
      reason: "",
      notes: "",
    },
  });

  const selectedType = form.watch("type");

  const onSubmit = (data: BillingExceptionFormInput) => {
    startTransition(async () => {
      const result = await upsertClientBillingException(data);

      if (!result.success) {
        toast({
          variant: "destructive",
          title: "Error al guardar excepción",
          description: result.error || "No se pudo guardar la excepción mensual",
        });
        return;
      }

      toast({
        title: "Excepción mensual guardada",
        description: "La excepción se aplicó correctamente al período seleccionado.",
      });

      form.reset({
        clientId,
        period: data.period,
        type: data.type,
        overrideAmount: data.type === "OVERRIDE_AMOUNT" ? data.overrideAmount ?? monthlyRate : monthlyRate,
        reason: "",
        notes: "",
      });
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Excepción mensual de facturación</CardTitle>
        <CardDescription>
          Úsala para no cobrar un mes, marcarlo como cubierto o asignar un monto especial sin alterar el fee base del cliente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="period"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Período</FormLabel>
                    <FormControl>
                      <Input type="month" {...field} disabled={isPending} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de excepción</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isPending}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="MARK_AS_PAID">
                          <div className="flex flex-col items-start">
                            <span>Mes cubierto</span>
                            <span className="text-xs text-muted-foreground">
                              Úsalo cuando el mes ya fue pagado o debe considerarse cubierto.
                            </span>
                          </div>
                        </SelectItem>
                        <SelectItem value="SKIP">
                          <div className="flex flex-col items-start">
                            <span>No cobrar</span>
                            <span className="text-xs text-muted-foreground">
                              Omite completamente el cobro de ese mes sin afectar el fee base.
                            </span>
                          </div>
                        </SelectItem>
                        <SelectItem value="OVERRIDE_AMOUNT">
                          <div className="flex flex-col items-start">
                            <span>Monto especial</span>
                            <span className="text-xs text-muted-foreground">
                              Cobra un valor distinto solo para ese período.
                            </span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {selectedType === "OVERRIDE_AMOUNT" && (
              <FormField
                control={form.control}
                name="overrideAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto a cobrar en ese mes</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={typeof field.value === "number" || typeof field.value === "string" ? field.value : ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Pago anticipado aplicado a marzo" {...field} disabled={isPending} />
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
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detalles opcionales para auditoría interna"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar excepción"}
            </Button>
          </form>
        </Form>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Historial de excepciones</h3>
          {sortedExceptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay excepciones registradas para este cliente.
            </p>
          ) : (
            <div className="space-y-3">
              {sortedExceptions.map((exception) => (
                <div key={exception.id} className="rounded-lg border p-4 space-y-2">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{formatPeriod(exception.month, exception.year)}</Badge>
                      <Badge>{getTypeLabel(exception.type)}</Badge>
                      {exception.type === "OVERRIDE_AMOUNT" && exception.overrideAmount !== null && (
                        <Badge variant="secondary">${exception.overrideAmount.toFixed(2)}</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Creada: {new Date(exception.createdAt).toLocaleDateString("es-ES")}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{exception.reason}</p>
                  {exception.notes ? (
                    <p className="text-sm text-muted-foreground">{exception.notes}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
