"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TransactionDialog } from "@/components/features/finance/transaction-dialog";
import { Plus } from "lucide-react";
import type { FinancialStats } from "@/actions/finance-actions";
import { format } from "date-fns";

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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard personal</h1>
          <p className="text-muted-foreground">
            Visualiza los ingresos, gastos y beneficios.
          </p>
        </div>
        <TransactionDialog>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva Transacción
          </Button>
        </TransactionDialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mis Gastos por Reembolsar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold text-amber-600">
              {formatCurrency(pendingReimbursements)}
            </div>
            <p className="text-xs text-muted-foreground">Gastos pendientes de reembolso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Honorarios Recibidos (Mes)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold text-emerald-600">
              {formatCurrency(honorariosReceived)}
            </div>
            <p className="text-xs text-muted-foreground">Honorarios pagados este mes</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transacciones Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay transacciones registradas aún
            </p>
          ) : (
            <div className="space-y-3">
              {filteredTransactions.slice(0, 5).map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{transaction.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(transaction.date), "dd/MM/yyyy")}
                    </p>
                  </div>
                  <div
                    className={`text-sm font-semibold ${
                      transaction.type === "EXPENSE" && transaction.status !== "PAID"
                        ? "text-rose-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {transaction.type === "EXPENSE" && transaction.status !== "PAID"
                      ? "-"
                      : "+"}
                    {formatCurrency(transaction.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
