"use client";

import type { FinanceSettingsMetrics } from "@/types";
import { ArrowRightLeft, Scale, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ExpensesPersonalAnalyticsPanelProps {
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

export function ExpensesPersonalAnalyticsPanel({
  financeSettingsMetrics,
}: ExpensesPersonalAnalyticsPanelProps) {
  const personalAnalytics = financeSettingsMetrics?.personalAnalytics;

  if (!personalAnalytics?.enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Analítica personal entre usuarios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Esta capa es opcional y privada. Si la activas desde configuración financiera, aquí verás saldos personales y cruces sugeridos.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-4 w-4" />
            Analítica personal entre usuarios
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Referencia interna únicamente. No modifica reembolsos, cuentas de empresa ni contabilidad oficial.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border bg-amber-50 p-4 text-sm text-amber-900">
            Empresa: reembolsa según quién pagó. Esta capa solo ayuda a cuadrar cuentas personales internas del equipo.
          </div>
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Pagó</TableHead>
                  <TableHead>Consumió</TableHead>
                  <TableHead>Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {personalAnalytics.summaries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No hay datos suficientes para el período seleccionado.
                    </TableCell>
                  </TableRow>
                ) : (
                  personalAnalytics.summaries.map((summary) => (
                    <TableRow key={summary.userId}>
                      <TableCell className="font-medium">{summary.userName}</TableCell>
                      <TableCell>{formatCurrency(summary.paidAmount)}</TableCell>
                      <TableCell>{formatCurrency(summary.consumedAmount)}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            summary.balance >= 0
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : "bg-rose-100 text-rose-800 border-rose-200"
                          }
                        >
                          {formatCurrency(summary.balance)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Transferencias sugeridas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {personalAnalytics.suggestedTransfers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay cruces sugeridos en este período.</p>
          ) : (
            personalAnalytics.suggestedTransfers.map((transfer, index) => (
              <div key={`${transfer.fromUserId}-${transfer.toUserId}-${index}`} className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {transfer.fromUserName} → {transfer.toUserName}
                    </p>
                    <p className="text-sm text-muted-foreground">Ajuste sugerido entre personas</p>
                  </div>
                  <p className="text-sm font-semibold">{formatCurrency(transfer.amount)}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
