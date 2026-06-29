"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Check, Loader2, Edit, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
import {
  type SortConfig,
  nextSortDirection,
  compareStrings,
  compareNumbers,
  compareDates,
  formatCurrency,
  getCategoryLabel,
  getStatusLabel,
  getStatusOrder,
} from "./sortable-utils";

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
    sourceType?: "EXPENSE" | "TRANSACTION";
    clientName?: string;
    clientId?: string;
  }>;
  onUpdate?: () => void;
}

type SortKey = "description" | "category" | "date" | "clientName" | "assignedToName" | "status" | "amount";

export function ExpensesTable({ expenses, onUpdate }: ExpensesTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null });

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      return { key, direction: nextSortDirection(prev.direction) };
    });
  };

  const sortedExpenses = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return expenses;
    const dir = sortConfig.direction;
    return [...expenses].sort((a, b) => {
      switch (sortConfig.key) {
        case "description":
          return compareStrings(a.description ?? "", b.description ?? "", dir);
        case "category":
          return compareStrings(
            getCategoryLabel(a.category),
            getCategoryLabel(b.category),
            dir
          );
        case "date":
          return compareDates(new Date(a.date), new Date(b.date), dir);
        case "clientName":
          return compareStrings(a.clientName ?? "", b.clientName ?? "", dir);
        case "assignedToName":
          return compareStrings(a.assignedToName ?? "", b.assignedToName ?? "", dir);
        case "status": {
          const oa = getStatusOrder(a.status, a.reimbursed);
          const ob = getStatusOrder(b.status, b.reimbursed);
          return dir === "asc" ? oa - ob : ob - oa;
        }
        case "amount":
          return compareNumbers(a.amount, b.amount, dir);
        default:
          return 0;
      }
    });
  }, [expenses, sortConfig]);

  const handleMarkAsReimbursed = async (expenseId: string, isTransaction: boolean) => {
    setProcessingId(expenseId);
    try {
      const currentExpense = expenses.find((expense) => expense.id === expenseId);

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (isTransaction) {
          enqueueFinanceAction({
            id: buildFinanceOfflineQueueId("expense-status"),
            kind: "MARK_TRANSACTION_PAID",
            createdAt: new Date().toISOString(),
            payload: {
              transactionId: expenseId,
              amount: currentExpense?.amount,
            },
          });
        } else {
          enqueueFinanceAction({
            id: buildFinanceOfflineQueueId("expense-status"),
            kind: "MARK_EXPENSE_REIMBURSED",
            createdAt: new Date().toISOString(),
            payload: {
              expenseId,
              amount: currentExpense?.amount,
            },
          });
        }

        toast({
          title: "Estado guardado offline",
          description: "Se sincronizará automáticamente cuando vuelva la conexión.",
        });
        return;
      }

      let result;

      if (isTransaction) {
        result = await markTransactionAsPaid(expenseId);
        if (!result.success && result.error?.includes("no encontrado")) {
          result = await markExpenseAsReimbursed(expenseId);
        }
      } else {
        result = await markExpenseAsReimbursed(expenseId);
        if (!result.success && result.error?.includes("no encontrado")) {
          result = await markTransactionAsPaid(expenseId);
        }
      }

      if (result.success) {
        toast({
          title: "Gasto actualizado",
          description: "El gasto ha sido marcado como reembolsado.",
        });
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

  const renderSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key || !sortConfig.direction) {
      return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    }
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  };

  const thClass = (align: "left" | "right" = "left") =>
    `cursor-pointer select-none${align === "right" ? " text-right" : ""}`;

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
            <TableHead className={thClass()} onClick={() => handleSort("description")}>
              <span className="inline-flex items-center gap-1">Descripción {renderSortIcon("description")}</span>
            </TableHead>
            <TableHead className={thClass()} onClick={() => handleSort("category")}>
              <span className="inline-flex items-center gap-1">Categoría {renderSortIcon("category")}</span>
            </TableHead>
            <TableHead className={thClass()} onClick={() => handleSort("date")}>
              <span className="inline-flex items-center gap-1">Fecha {renderSortIcon("date")}</span>
            </TableHead>
            <TableHead className={thClass()} onClick={() => handleSort("clientName")}>
              <span className="inline-flex items-center gap-1">Cliente {renderSortIcon("clientName")}</span>
            </TableHead>
            <TableHead className={thClass()} onClick={() => handleSort("assignedToName")}>
              <span className="inline-flex items-center gap-1">Asignado a {renderSortIcon("assignedToName")}</span>
            </TableHead>
            <TableHead className={thClass()} onClick={() => handleSort("status")}>
              <span className="inline-flex items-center gap-1">Estado {renderSortIcon("status")}</span>
            </TableHead>
            <TableHead className={thClass("right")} onClick={() => handleSort("amount")}>
              <span className="inline-flex items-center gap-1 justify-end w-full">Monto {renderSortIcon("amount")}</span>
            </TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedExpenses.map((expense) => {
            const isProcessing = processingId === expense.id;
            const isReimbursed = expense.reimbursed || expense.status === "PAID" || expense.status === "REIMBURSED";
            const canReimburse = expense.assignedToId && !isReimbursed;
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
                    {expense.assignedToId ? (
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
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Empresa
                      </Badge>
                    )}
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
