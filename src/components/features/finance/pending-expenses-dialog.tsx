"use client";

import { useEffect, useState } from "react";
import { getExpensesStats } from "@/actions/finance-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";

interface PendingExpensesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

export function PendingExpensesDialog({
  open,
  onOpenChange,
  userId,
  userName,
}: PendingExpensesDialogProps) {
  const [expenses, setExpenses] = useState<
    Array<{
      id: string;
      description: string;
      amount: number;
      category: string;
      date: Date;
    }>
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && userId) {
      setLoading(true);
      getExpensesStats({ userId })
        .then((result) => {
          if (result.success && result.data) {
            // Filtrar solo los gastos pendientes de reembolso (no reembolsados)
            const pendingExpenses = result.data.expenses.filter(
              (exp) => exp.reimbursed === false && (exp.assignedToId === userId || exp.assignedToId === undefined)
            );
            setExpenses(pendingExpenses);
          }
        })
        .catch((error) => {
          console.error("Error al cargar gastos:", error);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, userId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gastos Pendientes de Reembolso</DialogTitle>
          <DialogDescription>
            Gastos pendientes de reembolso para {userName}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : expenses.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No hay gastos pendientes de reembolso
          </p>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{formatDate(expense.date)}</TableCell>
                    <TableCell>{expense.description}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {expense.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex justify-end border-t pt-4">
              <div className="text-right space-y-1">
                <p className="text-sm text-muted-foreground">Total Pendiente:</p>
                <p className="text-2xl font-bold">{formatCurrency(total)}</p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

