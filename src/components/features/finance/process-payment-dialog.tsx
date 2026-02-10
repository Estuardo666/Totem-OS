"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { processSalaryPayment, type UserSettlementReport } from "@/actions/finance-actions";
import { processSalaryPaymentSchema, type ProcessSalaryPaymentInput } from "@/schemas/finance";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FormDescription,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

interface ProcessPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userReport: UserSettlementReport;
  month: number;
  year: number;
}

export function ProcessPaymentDialog({
  open,
  onOpenChange,
  userReport,
  month,
  year,
}: ProcessPaymentDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasReimbursements = userReport.reimbursements > 0;

  const form = useForm<ProcessSalaryPaymentInput>({
    resolver: zodResolver(processSalaryPaymentSchema),
    defaultValues: {
      recipientUserId: userReport.userId,
      amount: userReport.remaining,
      month,
      year,
      includeReimbursements: hasReimbursements,
      description: undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        recipientUserId: userReport.userId,
        amount: userReport.remaining,
        month,
        year,
        includeReimbursements: hasReimbursements,
        description: undefined,
      });
    }
  }, [open, userReport, month, year, hasReimbursements, form]);

  const onSubmit = async (data: ProcessSalaryPaymentInput) => {
    setIsSubmitting(true);
    try {
      const result = await processSalaryPayment(data);
      if (result.success) {
        toast({
          title: "Pago procesado",
          description: `El pago de $${data.amount.toFixed(2)} ha sido registrado correctamente.`,
        });
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo procesar el pago",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Ocurrió un error inesperado",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Procesar Pago</DialogTitle>
          <DialogDescription>
            Registrar el pago de salario/honorarios para {userReport.userName}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto a Pagar (USD)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      inputMode="decimal"
                      value={field.value === 0 ? "" : field.value ?? ""}
                      onChange={(e) => {
                        if (e.target.value === "") {
                          field.onChange(undefined);
                        } else {
                          field.onChange(Number(e.target.value));
                        }
                      }}
                      onFocus={(e) => {
                        if (field.value === 0) {
                          field.onChange(undefined);
                          e.currentTarget.value = "";
                        }
                      }}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Monto sugerido: ${userReport.remaining.toFixed(2)}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {hasReimbursements && (
              <FormField
                control={form.control}
                name="includeReimbursements"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Incluir reembolso de gastos pendientes</FormLabel>
                      <FormDescription>
                        Marcar los gastos pendientes (${userReport.reimbursements.toFixed(2)}) como reembolsados
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (Opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Pago de salario mensual"
                      {...field}
                      value={field.value ?? ""}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Procesar Pago
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

