"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import {
  deleteClientBillingException,
  upsertClientBillingException,
} from "@/actions/client-actions";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  type: "SKIP" | "OVERRIDE_AMOUNT" | "MARK_AS_PAID";
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
    return "Exonerado";
  }

  if (type === "OVERRIDE_AMOUNT") {
    return "Monto especial";
  }

  return "Cubierto por pago previo";
}

function getTypeDescription(type: BillingExceptionItem["type"]): string {
  if (type === "SKIP") {
    return "Este período no se cobrará. El fee base del cliente se mantiene para los demás meses.";
  }

  if (type === "OVERRIDE_AMOUNT") {
    return "Este período se cobrará con un valor distinto al fee mensual configurado.";
  }

  return "Este período se considera cubierto por un pago realizado previamente, así que no volverá a cobrarse.";
}

function getTypeBadgeClass(type: BillingExceptionItem["type"]): string {
  if (type === "SKIP") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (type === "OVERRIDE_AMOUNT") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function MonthlyBillingExceptionCard({
  clientId,
  monthlyRate,
  exceptions,
}: MonthlyBillingExceptionCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, startSaveTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const isBusy = isSaving || isDeleting;

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
    startSaveTransition(async () => {
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

  const handleDelete = (exceptionId: string) => {
    startDeleteTransition(async () => {
      const result = await deleteClientBillingException(exceptionId);

      if (!result.success) {
        toast({
          variant: "destructive",
          title: "Error al eliminar excepción",
          description: result.error || "No se pudo eliminar la excepción mensual",
        });
        return;
      }

      toast({
        title: "Excepción eliminada",
        description: "La excepción mensual se eliminó correctamente.",
      });

      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exonerar o ajustar fee mensual</CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          Úsala para exonerar el fee de un mes, marcarlo como cubierto por un pago previo o asignar un monto especial sin alterar el fee base del cliente.
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
                      <Input type="month" {...field} disabled={isBusy} />
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
                    <Select onValueChange={field.onChange} value={field.value} disabled={isBusy}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="MARK_AS_PAID">
                          <div className="flex flex-col items-start">
                            <span>Mes cubierto por pago previo</span>
                            <span className="text-xs text-muted-foreground">
                              Ejemplo: si febrero se pagó pero el trabajo se ejecuta en marzo, marca marzo como cubierto para no volver a cobrarlo.
                            </span>
                          </div>
                        </SelectItem>
                        <SelectItem value="SKIP">
                          <div className="flex flex-col items-start">
                            <span>Exonerar cobro</span>
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
                        disabled={isBusy}
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
                    <Input placeholder="Ej: Pago de febrero cubre el trabajo de marzo" {...field} disabled={isBusy} />
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
                      disabled={isBusy}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isBusy}>
              {isSaving ? "Guardando..." : "Guardar excepción"}
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
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{formatPeriod(exception.month, exception.year)}</Badge>
                      <Badge variant="outline" className={getTypeBadgeClass(exception.type)}>
                        {getTypeLabel(exception.type)}
                      </Badge>
                      {exception.type === "OVERRIDE_AMOUNT" && exception.overrideAmount !== null && (
                        <Badge variant="secondary">${exception.overrideAmount.toFixed(2)}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 self-start md:self-center">
                      <span className="text-xs text-muted-foreground">
                        Creada: {new Date(exception.createdAt).toLocaleDateString("es-ES")}
                      </span>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            disabled={isBusy}
                            title="Eliminar excepción"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Eliminar excepción</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar excepción mensual?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se eliminará la excepción de {formatPeriod(exception.month, exception.year)} y el sistema volverá a calcular ese período según el fee base y los pagos registrados.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(exception.id)}
                              disabled={isDeleting}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {isDeleting ? "Eliminando..." : "Eliminar"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <p className="text-sm font-medium">{exception.reason}</p>
                  <p className="text-xs text-muted-foreground">{getTypeDescription(exception.type)}</p>
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
