"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2, Save, Settings2 } from "lucide-react";
import { updateFinanceSettings } from "@/actions/finance-settings-actions";
import {
  updateFinanceSettingsSchema,
  type FinanceBudgetCategory,
  type FinanceSettings,
  type UpdateFinanceSettingsInput,
} from "@/schemas/finance-settings";
import type { User } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

const trackedCategoryOptions: Array<{ label: string; value: FinanceBudgetCategory }> = [
  { label: "Comida", value: "COMIDA" },
  { label: "Transporte", value: "TRANSPORTE" },
  { label: "Invitaciones", value: "INVITACIONES" },
  { label: "Software", value: "SOFTWARE" },
  { label: "Oficina", value: "OFICINA" },
  { label: "Equipos", value: "EQUIPOS" },
  { label: "Otros", value: "OTROS" },
];

interface FinanceSettingsFormProps {
  initialSettings: FinanceSettings;
  adminUsers: User[];
}

export function FinanceSettingsForm({ initialSettings, adminUsers }: FinanceSettingsFormProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<UpdateFinanceSettingsInput>({
    resolver: zodResolver(updateFinanceSettingsSchema),
    defaultValues: initialSettings,
  });

  useEffect(() => {
    form.reset(initialSettings);
  }, [form, initialSettings]);

  const approverMode = form.watch("approverMode");
  const adminBudgetMode = form.watch("adminBudgetMode");
  const selectedCategories = form.watch("trackedCategories") ?? [];

  const onSubmit = async (data: UpdateFinanceSettingsInput) => {
    setIsSaving(true);

    try {
      const result = await updateFinanceSettings(data);

      if (!result.success || !result.data) {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo guardar la configuración",
        });
        return;
      }

      form.reset(result.data);
      toast({
        title: "Configuración guardada",
        description: "Las reglas financieras fueron actualizadas correctamente.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          Configuración financiera
        </CardTitle>
        <CardDescription>
          Define reglas de cupo, categorías controladas y analítica interna sin afectar la lógica oficial de empresa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold">Política de cupo mensual</h3>
                <p className="text-sm text-muted-foreground">Controla el gasto no honorario contra los ingresos del mes.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="budgetControlEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <FormLabel>Activar control de cupo</FormLabel>
                        <p className="text-sm text-muted-foreground">Habilita el tope global mensual de gastos no honorarios.</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="globalBudgetPercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Porcentaje global máximo</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" max="100" step="0.1" {...field} onChange={(event) => field.onChange(Number(event.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="budgetBase"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base del cálculo</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona la base" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="COLLECTED_INCOME">Ingresos cobrados del mes</SelectItem>
                        <SelectItem value="PAID_INCOME">Ingresos pagados registrados</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold">Cupo recomendado por ADMIN</h3>
                <p className="text-sm text-muted-foreground">Define el consumo interno permitido por ADMIN según split, no según quién pagó.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="adminBudgetEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <FormLabel>Activar cupo individual</FormLabel>
                        <p className="text-sm text-muted-foreground">Evalúa el consumo mensual por ADMIN.</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="allowAdminBudgetOverrides"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <FormLabel>Permitir overrides por ADMIN</FormLabel>
                        <p className="text-sm text-muted-foreground">Permite personalizar el cupo por usuario administrativo.</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
                <FormField
                  control={form.control}
                  name="adminBudgetMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modo de cupo</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona modo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PERCENTAGE">Porcentaje</SelectItem>
                          <SelectItem value="FIXED">Monto fijo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="adminBudgetDefaultValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{adminBudgetMode === "PERCENTAGE" ? "Valor por defecto (%)" : "Valor por defecto ($)"}</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.1" {...field} onChange={(event) => field.onChange(Number(event.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold">Categorías que cuentan para el cupo</h3>
                <p className="text-sm text-muted-foreground">Solo las categorías marcadas consumirán presupuesto mensual.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {trackedCategoryOptions.map((category) => (
                  <Label key={category.value} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer">
                    <Checkbox
                      checked={selectedCategories.includes(category.value)}
                      onCheckedChange={(checked) => {
                        const currentValues = form.getValues("trackedCategories") ?? [];
                        if (checked) {
                          form.setValue("trackedCategories", [...currentValues, category.value], { shouldValidate: true, shouldDirty: true });
                          return;
                        }
                        form.setValue(
                          "trackedCategories",
                          currentValues.filter((value) => value !== category.value),
                          { shouldValidate: true, shouldDirty: true }
                        );
                      }}
                    />
                    <span className="text-sm">{category.label}</span>
                  </Label>
                ))}
              </div>
              <FormField control={form.control} name="trackedCategories" render={() => <FormMessage />} />
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold">Umbrales y aprobación</h3>
                <p className="text-sm text-muted-foreground">Configura advertencias, alertas y el comportamiento cuando se supera un cupo.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="warningThresholdPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Umbral de advertencia (%)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" max="100" step="1" {...field} onChange={(event) => field.onChange(Number(event.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="alertThresholdPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Umbral de alerta (%)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" max="100" step="1" {...field} onChange={(event) => field.onChange(Number(event.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="approvalRequiredOnExceed"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <FormLabel>Requerir aprobación al exceder</FormLabel>
                      <p className="text-sm text-muted-foreground">No bloquea el gasto, pero lo marca para seguimiento administrativo.</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="approverMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quién aprueba</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona aprobador" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ANY_ADMIN">Cualquier ADMIN</SelectItem>
                        <SelectItem value="PRIMARY_ADMIN">Solo ADMIN principal</SelectItem>
                        <SelectItem value="SELECTED_USERS">Usuarios seleccionados</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {approverMode === "SELECTED_USERS" ? (
                <FormField
                  control={form.control}
                  name="approverUserIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aprobadores seleccionados</FormLabel>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {adminUsers.map((user) => (
                          <Label key={user.id} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer">
                            <Checkbox
                              checked={field.value.includes(user.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...field.value, user.id]);
                                  return;
                                }
                                field.onChange(field.value.filter((value) => value !== user.id));
                              }}
                            />
                            <span className="text-sm">{user.name}</span>
                          </Label>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold">Analítica personal entre usuarios</h3>
                <p className="text-sm text-muted-foreground">Solo referencia interna. No afecta contabilidad, reembolsos ni nómina.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="personalAnalyticsEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <FormLabel>Activar analítica personal</FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="showPersonalAnalyticsInDashboard"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <FormLabel>Mostrar en dashboard</FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="personalAnalyticsAdminsOnly"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <FormLabel>Solo para ADMIN</FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <p>Esta capa es solo analítica interna para orientar conversaciones personales. No impacta reembolsos oficiales de la empresa.</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar configuración
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
