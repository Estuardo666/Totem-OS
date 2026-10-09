"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TransactionDialog } from "@/components/features/finance/transaction-dialog";
import { Plus } from "lucide-react";
import type { FinancialStats } from "@/actions/finance-actions";
import { format } from "date-fns";
import { PageHeader } from "@/components/shared";

interface PersonalFinanceDashboardProps {
  stats: FinancialStats;
  userId?: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function PersonalFinanceDashboard({ stats, userId }: PersonalFinanceDashboardProps) {
  const pendingReimbursements = stats.pendingReimbursements ?? 0;
  const honorariosReceived = stats.honorariosReceived ?? 0;
  const recentTransactions = stats.recentTransactions;
  const filteredTransactions = userId
    ? recentTransactions.filter((transaction) => {
        if (transaction.type === "INCOME" || transaction.sourceType === "INVOICE") {
          return false;
        }

        const assignedToId = transaction.assignedToId;
        const recipientId = transaction.userId ?? assignedToId;
        const isUserExpense =
          transaction.type === "EXPENSE" && assignedToId === userId;
        const isReimbursement =
          transaction.type === "EXPENSE" &&
          transaction.status === "PAID" &&
          assignedToId === userId;
        const isHonorario =
          transaction.type === "HONORARIOS" && recipientId === userId;

        return isUserExpense || isReimbursement || isHonorario;
      })
    : recentTransactions;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="Mis finanzas"
        description="Lo que te deben y lo que has cobrado."
        actions={
          <TransactionDialog>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva Transacción
            </Button>
          </TransactionDialog>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Te deben (reembolsos)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold text-amber-600">
              {formatCurrency(pendingReimbursements)}
            </div>
            <p className="text-xs text-muted-foreground">Gastos que pagaste tú y la empresa aún no te devuelve</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Honorarios cobrados este mes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold text-emerald-600">
              {formatCurrency(honorariosReceived)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mis últimos movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay transacciones registradas aún
            </p>
          ) : (
            <div className="space-y-3">
              {filteredTransactions.slice(0, 8).map((transaction) => {
                const isHonorario = transaction.type === "HONORARIOS";
                const isPaid = transaction.status === "PAID";
                const label = isHonorario
                  ? isPaid ? "Honorario pagado" : "Honorario pendiente"
                  : isPaid ? "Gasto reembolsado" : "Gasto por reembolsar";
                const tone = isPaid ? "text-emerald-600" : "text-amber-600";

                return (
                  <div key={transaction.id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{transaction.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(transaction.date), "dd/MM/yyyy")} · <span className={tone}>{label}</span>
                      </p>
                    </div>
                    <div className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(transaction.amount)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
