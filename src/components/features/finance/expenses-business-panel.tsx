"use client";

import type { FinanceSettingsMetrics } from "@/types";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ExpensesBusinessPanelProps {
  financeSettingsMetrics?: FinanceSettingsMetrics;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getBudgetStatusLabel(status: FinanceSettingsMetrics["overview"]["globalBudgetStatus"]): string {
  if (status === "approval_required") return "Aprobación requerida";
  if (status === "alert") return "Alerta";
  if (status === "warning") return "Advertencia";
  return "Normal";
}

function getBudgetStatusClassName(status: FinanceSettingsMetrics["overview"]["globalBudgetStatus"]): string {
  if (status === "approval_required") return "bg-red-100 text-red-800 border-red-200";
  if (status === "alert") return "bg-orange-100 text-orange-800 border-orange-200";
  if (status === "warning") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-emerald-100 text-emerald-800 border-emerald-200";
}

function getProgressClassName(status: FinanceSettingsMetrics["overview"]["globalBudgetStatus"]): string {
  if (status === "approval_required") return "[&>div]:bg-red-500";
  if (status === "alert") return "[&>div]:bg-orange-500";
  if (status === "warning") return "[&>div]:bg-amber-500";
  return "[&>div]:bg-emerald-500";
}

export function ExpensesBusinessPanel({ financeSettingsMetrics }: ExpensesBusinessPanelProps) {
  if (!financeSettingsMetrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Control empresarial oficial</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Esta vista avanzada se habilita para ADMIN y usa la configuración financiera global de Totem.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { overview, adminBudgets } = financeSettingsMetrics;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <CardTitle>Control empresarial oficial</CardTitle>
            <p className="text-sm text-muted-foreground">
              Esta capa sí impacta la operación oficial: cupos mensuales, categorías monitoreadas y estado del gasto no honorarios.
            </p>
          </div>
          <Badge className={getBudgetStatusClassName(overview.globalBudgetStatus)}>
            {getBudgetStatusLabel(overview.globalBudgetStatus)}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">Base de ingresos del período</p>
              <p className="mt-2 text-2xl font-semibold">{formatCurrency(overview.baseIncome)}</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">Gasto monitoreado</p>
              <p className="mt-2 text-2xl font-semibold">{formatCurrency(overview.trackedExpenses)}</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">Disponible del cupo global</p>
              <p className="mt-2 text-2xl font-semibold">{formatCurrency(overview.globalBudgetRemaining)}</p>
            </div>
          </div>

          <div className="rounded-xl border p-4 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium">Tope global mensual de no honorarios</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(overview.trackedExpenses)} de {formatCurrency(overview.globalBudgetLimit)} usados
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">{overview.globalBudgetUsagePercent.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Consumo del cupo</p>
              </div>
            </div>
            <Progress
              value={Math.min(overview.globalBudgetUsagePercent, 100)}
              className={getProgressClassName(overview.globalBudgetStatus)}
            />
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {overview.trackedCategories.map((category) => (
                <Badge key={category} variant="outline">
                  {category}
                </Badge>
              ))}
            </div>
            <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 text-sm md:flex-row md:items-start">
              {overview.globalBudgetStatus === "normal" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : overview.globalBudgetStatus === "warning" ? (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-red-600" />
              )}
              <p className="text-muted-foreground">
                Se monitorean solo las categorías marcadas en configuración. Si se supera el umbral, se marca visualmente y
                {overview.approvalRequiredOnExceed ? " puede requerir aprobación." : " genera alerta sin bloquear."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cupo por ADMIN</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {adminBudgets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay usuarios ADMIN configurados para evaluar.</p>
          ) : (
            adminBudgets.map((budget) => (
              <div key={budget.userId} className="rounded-xl border p-4 space-y-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">{budget.userName}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(budget.consumedAmount)} de {formatCurrency(budget.limitAmount)}
                    </p>
                  </div>
                  <Badge className={getBudgetStatusClassName(budget.status)}>{getBudgetStatusLabel(budget.status)}</Badge>
                </div>
                <Progress value={Math.min(budget.usagePercent, 100)} className={getProgressClassName(budget.status)} />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Uso {budget.usagePercent.toFixed(1)}%</span>
                  <span>Disponible {formatCurrency(budget.remainingAmount)}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
