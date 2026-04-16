"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Check, Loader2, Edit } from "lucide-react";
import { markExpenseAsReimbursed, markTransactionAsPaid } from "@/actions/finance-actions";
import {
  buildFinanceOfflineQueueId,
  enqueueFinanceAction,
} from "@/lib/finance-offline-store";
import { EditExpenseDialog } from "./edit-expense-dialog";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

interface ExpensesTableProps {
  expenses: Array<{
    id: string;
    description: string;
    amount: number;
    category: string;
    date: Date;
    status: string;
    assignedToName?: string;
    assignedToId?: string;
    reimbursed: boolean;
    sourceType?: "EXPENSE" | "TRANSACTION"; // Para identificar el origen
    clientName?: string;
    clientId?: string;
  }>;
  onUpdate?: () => void; // Callback para recargar datos
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Función para obtener el label de la categoría
function getCategoryLabel(category: string): string {
  switch (category) {
    case "COMIDA":
      return "Comida";
    case "TRANSPORTE":
      return "Transporte";
    case "INVITACIONES":
      return "Invitaciones";
    case "SOFTWARE":
      return "Software";
    case "OFICINA":
      return "Oficina";
    case "EQUIPOS":
      return "Equipos";
    case "OTROS":
      return "Otros";
    default:
      return category;
  }
}

// Función para obtener el label del estado
function getStatusLabel(status: string, reimbursed: boolean): string {
  if (reimbursed || status === "PAID" || status === "REIMBURSED") {
    return "Reembolsado";
  }
  return "Pendiente";
}

export function ExpensesTable({ expenses, onUpdate }: ExpensesTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const handleMarkAsReimbursed = async (expenseId: string, isTransaction: boolean) => {
    setProcessingId(expenseId);
    try {
      const currentExpense = expenses.find((expense) => expense.id === expenseId);

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        enqueueFinanceAction({
          id: buildFinanceOfflineQueueId("expense-status"),
          kind: isTransaction ? "MARK_TRANSACTION_PAID" : "MARK_EXPENSE_REIMBURSED",
          createdAt: new Date().toISOString(),
          payload: isTransaction
            ? {
                transactionId: expenseId,
                amount: currentExpense?.amount,
              }
            : {
                expenseId,
                amount: currentExpense?.amount,
              },
        });

        toast({
          title: "Estado guardado offline",
          description: "Se sincronizará automáticamente cuando vuelva la conexión.",
        });
        return;
      }

      let result;
      
      // Intentar primero con el tipo detectado, si falla, intentar con el otro
      if (isTransaction) {
        // Si es una transacción, usar markTransactionAsPaid
        result = await markTransactionAsPaid(expenseId);
        
        // Si falla y el error indica que no es una transacción, intentar como Expense
        if (!result.success && result.error?.includes("no encontrado")) {
          result = await markExpenseAsReimbursed(expenseId);
        }
      } else {
        // Si es un gasto del modelo Expense, usar markExpenseAsReimbursed
        result = await markExpenseAsReimbursed(expenseId);
        
        // Si falla y el error indica que no es un Expense, intentar como Transaction
        if (!result.success && result.error?.includes("no encontrado")) {
          result = await markTransactionAsPaid(expenseId);
        }
      }

      if (result.success) {
        toast({
          title: "Gasto actualizado",
          description: "El gasto ha sido marcado como reembolsado.",
        });
        // Recargar datos si hay callback, sino usar router.refresh
        if (onUpdate) {
          onUpdate();
        } else {
          router.refresh();
        }
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo actualizar el gasto",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Ocurrió un error inesperado",
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (expenses.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">
            No hay gastos registrados este mes
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Descripción</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Asignado a</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense) => {
            const isProcessing = processingId === expense.id;
            const isReimbursed = expense.reimbursed || expense.status === "PAID" || expense.status === "REIMBURSED";
            const canReimburse = expense.assignedToId && !isReimbursed;
            // Determinar si es una transacción usando sourceType o fallback a lógica anterior
            const isTransaction = expense.sourceType === "TRANSACTION" || 
              (expense.sourceType === undefined && (expense.category === "OTROS" || !expense.category));

            return (
              <TableRow key={expense.id}>
                  <TableCell className="font-medium">
                    {expense.description}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getCategoryLabel(expense.category)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(expense.date), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    {expense.clientName ? (
                      <span className="text-sm font-medium">{expense.clientName}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {expense.assignedToName ? (
                      <span className="text-sm">{expense.assignedToName}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={isReimbursed ? "default" : "secondary"}
                      className={
                        isReimbursed
                          ? "bg-green-500 hover:bg-green-600 text-white"
                          : "bg-yellow-500 hover:bg-yellow-600 text-white"
                      }
                    >
                      {getStatusLabel(expense.status, expense.reimbursed)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-red-600">
                    -{formatCurrency(expense.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingExpenseId(expense.id)}
                        disabled={isProcessing}
                        className="h-8"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                      {canReimburse && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleMarkAsReimbursed(expense.id, isTransaction)}
                          disabled={isProcessing}
                          className="h-8 bg-green-600 hover:bg-green-700 text-white"
                        >
                          {isProcessing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Check className="h-3 w-3 mr-1" />
                              Reembolsado
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <EditExpenseDialog
        expenseId={editingExpenseId}
        open={editingExpenseId !== null}
        onOpenChange={(open) => {
          if (!open) setEditingExpenseId(null);
        }}
      />
    </div>
  );
}

