"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { updateUserSalaryConfig, type UserSettlementReport } from "@/actions/finance-actions";
import { updateUserSalaryConfigSchema, type UpdateUserSalaryConfigInput } from "@/schemas/finance";
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
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface SalaryConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userReport: UserSettlementReport;
  currentConfig: {
    salaryType?: string | null;
    baseSalary?: number | null;
    hourlyRate?: number | null;
    profitSharePercent?: number | null;
    bankAccountInfo?: string | null;
  };
}

export function SalaryConfigDialog({
  open,
  onOpenChange,
  userReport,
  currentConfig,
}: SalaryConfigDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<UpdateUserSalaryConfigInput>({
    resolver: zodResolver(updateUserSalaryConfigSchema),
    defaultValues: {
      salaryType: currentConfig.salaryType as "HOURLY" | "MONTHLY" | "PROFIT_SHARE" | undefined,
      baseSalary: currentConfig.baseSalary ?? undefined,
      hourlyRate: currentConfig.hourlyRate ?? undefined,
      profitSharePercent: currentConfig.profitSharePercent ?? undefined,
      bankAccountInfo: currentConfig.bankAccountInfo ?? undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        salaryType: currentConfig.salaryType as "HOURLY" | "MONTHLY" | "PROFIT_SHARE" | undefined,
        baseSalary: currentConfig.baseSalary ?? undefined,
        hourlyRate: currentConfig.hourlyRate ?? undefined,
        profitSharePercent: currentConfig.profitSharePercent ?? undefined,
        bankAccountInfo: currentConfig.bankAccountInfo ?? undefined,
      });
    }
  }, [open, currentConfig, form]);

  const onSubmit = async (data: UpdateUserSalaryConfigInput) => {
    setIsSubmitting(true);
    try {
      const result = await updateUserSalaryConfig(userReport.userId, data);
      if (result.success) {
        toast({
          title: "Configuración actualizada",
          description: `La configuración salarial de ${userReport.userName} ha sido actualizada.`,
        });
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo actualizar la configuración",
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

  const salaryType = form.watch("salaryType");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Salario</DialogTitle>
          <DialogDescription>
            Configura la estructura salarial para {userReport.userName}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="salaryType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Salario</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                    }}
                    defaultValue={field.value}
                    key={`salary-type-${open}-${userReport.userId}`}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="MONTHLY">Mensual Fijo</SelectItem>
                      <SelectItem value="HOURLY">Por Hora</SelectItem>
                      <SelectItem value="PROFIT_SHARE">Participación en Ganancias</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {salaryType === "MONTHLY" && (
              <FormField
                control={form.control}
                name="baseSalary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salario Base Mensual (USD)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {salaryType === "HOURLY" && (
              <FormField
                control={form.control}
                name="hourlyRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tarifa por Hora (USD)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {salaryType === "PROFIT_SHARE" && (
              <FormField
                control={form.control}
                name="profitSharePercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Porcentaje de Participación (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="50.0"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="bankAccountInfo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Información de Cuenta Bancaria (Opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Banco X - Cuenta 123456"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
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
                Guardar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

