"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Check, X, Edit, Loader2, Minus, Plus } from "lucide-react";
import type { FinancialStats } from "@/actions/finance-actions";
import {
  markTransactionAsPaid,
  markInvoiceAsPaid,
  markExpenseAsReimbursed,
  cancelTransaction,
  getTransactionById,
  getInvoiceById,
  getExpenseById,
} from "@/actions/finance-actions";
import type { Transaction, Invoice } from "@prisma/client";
import { EditTransactionDialog } from "./edit-transaction-dialog";
import { EditInvoiceDialog } from "./edit-invoice-dialog";
import { EditExpenseDialog } from "./edit-expense-dialog";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface TransactionListProps {
  transactions: FinancialStats["recentTransactions"];
}

// Función para formatear dinero como USD
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Función para obtener el label de la categoría
function getCategoryLabel(category?: string): string {
  switch (category) {
    case "SOFTWARE":
      return "Software";
    case "EQUIPMENT":
    case "EQUIPOS":
      return "Equipos";
    case "OFFICE":
    case "OFICINA":
      return "Oficina";
    case "PAYROLL":
      return "Nómina";
    case "COMIDA":
      return "Comida";
    case "TRANSPORTE":
      return "Transporte";
    case "INVITACIONES":
      return "Invitaciones";
    case "OTROS":
      return "Otros";
    default:
      return category || "-";
  }
}

// Función para obtener el label del estado
function getStatusLabel(status?: string): string {
  switch (status) {
    case "PAID":
      return "Pagada";
    case "PENDING":
      return "Pendiente";
    case "SENT":
      return "Enviado";
    case "CANCELLED":
      return "Cancelada";
    default:
      return "-";
  }
}

// Función para obtener el variant del Badge según el estado
function getStatusBadgeVariant(status?: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "PAID":
      return "default"; // Verde por defecto
    case "PENDING":
      return "secondary"; // Amarillo/naranja
    case "CANCELLED":
      return "destructive"; // Rojo
    default:
      return "outline";
  }
}

// Función para obtener las clases de color del Badge según el estado
function getStatusBadgeClasses(status?: string): string {
  switch (status) {
    case "PAID":
      return "bg-green-500 hover:bg-green-600 text-white";
    case "PENDING":
      return "bg-yellow-500 hover:bg-yellow-600 text-white";
    case "CANCELLED":
      return "bg-red-500 hover:bg-red-600 text-white";
    default:
      return "";
  }
}

export function TransactionList({ transactions }: TransactionListProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all"); // todos, ingreso, gasto, reembolso
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEditInvoiceDialogOpen, setIsEditInvoiceDialogOpen] = useState(false);

  // Filtrar transacciones por estado y tipo
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Filtrar por estado
    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (t) => t.status?.toUpperCase() === statusFilter.toUpperCase()
      );
    }

    // Filtrar por tipo (reembolsos = gastos con assignedToId)
    if (typeFilter === "reimbursement") {
      filtered = filtered.filter(
        (t) => t.type === "EXPENSE" && t.assignedToId !== undefined && t.assignedToId !== null
      );
    } else if (typeFilter === "income") {
      filtered = filtered.filter((t) => t.type === "INCOME");
    } else if (typeFilter === "expense") {
      filtered = filtered.filter((t) => t.type === "EXPENSE");
    }

    return filtered;
  }, [transactions, statusFilter, typeFilter]);

  const handleMarkAsPaid = async (transactionId: string, sourceType?: string) => {
    setProcessingId(transactionId);
    try {
      let result;
      // Usar la función correcta según el tipo de transacción
      if (sourceType === "INVOICE") {
        result = await markInvoiceAsPaid(transactionId);
      } else if (sourceType === "TRANSACTION") {
        result = await markTransactionAsPaid(transactionId);
      } else if (sourceType === "EXPENSE") {
        result = await markExpenseAsReimbursed(transactionId);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Este tipo de transacción no puede marcarse como pagada",
        });
        setProcessingId(null);
        return;
      }

      if (result.success) {
        toast({
          title: sourceType === "EXPENSE" ? "Gasto actualizado" : "Transacción actualizada",
          description: sourceType === "EXPENSE" 
            ? "El gasto ha sido marcado como reembolsado." 
            : "La transacción ha sido marcada como pagada.",
        });
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo actualizar la transacción",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Ocurrió un error inesperado",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (transactionId: string) => {
    setProcessingId(transactionId);
    try {
      const result = await cancelTransaction(transactionId);
      if (result.success) {
        toast({
          title: "Transacción cancelada",
          description: "La transacción ha sido cancelada.",
        });
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo cancelar la transacción",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Ocurrió un error inesperado",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleEdit = async (transactionId: string, sourceType?: string) => {
    setProcessingId(transactionId);
    try {
      console.log("🔍 Intentando editar transacción:", transactionId, "Tipo:", sourceType);
      
      // Determinar el tipo de transacción
      const isExpense = sourceType === "EXPENSE";
      const isInvoice = sourceType === "INVOICE" || 
        (!sourceType && transactionId && transactions.find(t => t.id === transactionId)?.description?.startsWith("Factura"));
      
      if (isExpense) {
        // Intentar cargar como gasto
        const expenseResult = await getExpenseById(transactionId);
        console.log("🔍 Resultado de getExpenseById:", expenseResult);
        
        if (expenseResult.success && expenseResult.data) {
          console.log("✅ Gasto cargado:", expenseResult.data);
          setEditingExpenseId(transactionId);
        } else {
          // Si falla, intentar como transacción (puede ser una Transaction de tipo EXPENSE)
          const transactionResult = await getTransactionById(transactionId);
          if (transactionResult.success && transactionResult.data) {
            setEditingTransaction(transactionResult.data);
            setIsEditDialogOpen(true);
          } else {
            toast({
              variant: "destructive",
              title: "Error",
              description: expenseResult.error || transactionResult.error || "No se pudo cargar el gasto",
            });
          }
        }
      } else if (isInvoice) {
        // Intentar cargar como factura
        const invoiceResult = await getInvoiceById(transactionId);
        console.log("🔍 Resultado de getInvoiceById:", invoiceResult);
        
        if (invoiceResult.success && invoiceResult.data) {
          console.log("✅ Factura cargada:", invoiceResult.data);
          setEditingInvoice(invoiceResult.data);
          setIsEditInvoiceDialogOpen(true);
        } else {
          // Si falla, intentar como transacción
          const transactionResult = await getTransactionById(transactionId);
          if (transactionResult.success && transactionResult.data) {
            setEditingTransaction(transactionResult.data);
            setIsEditDialogOpen(true);
          } else {
            toast({
              variant: "destructive",
              title: "Error",
              description: invoiceResult.error || transactionResult.error || "No se pudo cargar la transacción",
            });
          }
        }
      } else {
        // Intentar cargar como transacción
        const transactionResult = await getTransactionById(transactionId);
        console.log("🔍 Resultado de getTransactionById:", transactionResult);
        
        if (transactionResult.success && transactionResult.data) {
          console.log("✅ Transacción cargada:", transactionResult.data);
          setEditingTransaction(transactionResult.data);
          setIsEditDialogOpen(true);
        } else {
          // Si falla, intentar como factura
          const invoiceResult = await getInvoiceById(transactionId);
          if (invoiceResult.success && invoiceResult.data) {
            setEditingInvoice(invoiceResult.data);
            setIsEditInvoiceDialogOpen(true);
          } else {
            toast({
              variant: "destructive",
              title: "Error",
              description: transactionResult.error || invoiceResult.error || "No se pudo cargar la transacción",
            });
          }
        }
      }
    } catch (error) {
      console.error("❌ Excepción al editar:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Ocurrió un error inesperado",
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">
            No hay transacciones registradas aún
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="PENDING">Pendientes</SelectItem>
              <SelectItem value="PAID">Pagadas</SelectItem>
              <SelectItem value="CANCELLED">Canceladas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="income">Ingresos</SelectItem>
              <SelectItem value="expense">Gastos</SelectItem>
              <SelectItem value="reimbursement">Reembolsos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-sm text-muted-foreground">
          {filteredTransactions.length} transacción(es)
        </span>
      </div>

      {/* Tabla de transacciones */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No hay transacciones con este filtro
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((transaction) => {
                const isProcessing = processingId === transaction.id;
                const isPending = transaction.status === "PENDING";
                const isPaid = transaction.status === "PAID";
                const isCancelled = transaction.status === "CANCELLED";

                return (
                  <TableRow key={transaction.id}>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(transaction.date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {transaction.clientName || (
                        <span className="text-muted-foreground">-</span>
                      )}
                      {transaction.assignedToName && transaction.description?.includes("(Compartido") && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {(() => {
                            // Extraer el número de personas del texto "(Compartido - X personas)"
                            const match = transaction.description?.match(/\(Compartido - (\d+) personas\)/);
                            const numPeople = match ? parseInt(match[1]) : 2;
                            const percentage = Math.round((1 / numPeople) * 100);
                            return `Reembolso ${percentage}% a: ${transaction.assignedToName}`;
                          })()}
                        </div>
                      )}
                      {transaction.assignedToName && !transaction.description?.includes("(Compartido") && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Reembolso a: {transaction.assignedToName}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{transaction.description}</span>
                        {transaction.category && (
                          <Badge variant="outline" className="w-fit mt-1">
                            {getCategoryLabel(transaction.category)}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={transaction.type === "INCOME" ? "default" : "secondary"}
                        className={
                          transaction.type === "INCOME"
                            ? "bg-green-500 hover:bg-green-600 text-white"
                            : "bg-red-500 hover:bg-red-600 text-white"
                        }
                      >
                        {transaction.type === "INCOME" ? "Ingreso" : "Gasto"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {transaction.status ? (
                        <Badge
                          variant={getStatusBadgeVariant(transaction.status)}
                          className={getStatusBadgeClasses(transaction.status)}
                        >
                          {getStatusLabel(transaction.status)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${
                        transaction.type === "INCOME"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      <div className="flex items-center justify-end gap-1">
                        {transaction.type === "EXPENSE" ? (
                          <Minus className="h-4 w-4 text-red-600" />
                        ) : (
                          <Plus className="h-4 w-4 text-green-600" />
                        )}
                        <span>{formatCurrency(transaction.amount)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Determinar el tipo de transacción */}
                        {(() => {
                          // Detectar si es un gasto basándose en el tipo de transacción
                          const isExpenseType = transaction.type === "EXPENSE";
                          
                          const sourceType = transaction.sourceType || 
                            (transaction.description?.startsWith("Factura") ? "INVOICE" : 
                             isExpenseType ? "EXPENSE" :
                             transaction.category ? "EXPENSE" : "TRANSACTION");
                          const isInvoice = sourceType === "INVOICE";
                          const isTransaction = sourceType === "TRANSACTION";
                          // Es un gasto si el tipo es EXPENSE (prioritario) o si el sourceType es EXPENSE
                          const isExpense = transaction.type === "EXPENSE" || sourceType === "EXPENSE";

                          // Mostrar acciones para facturas pendientes, transacciones y gastos
                          if ((isInvoice || isTransaction || isExpense) && isPending) {
                            return (
                              <>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleMarkAsPaid(transaction.id, sourceType)}
                                  disabled={isProcessing}
                                  className="h-8 bg-green-600 hover:bg-green-700 text-white"
                                >
                                  {isProcessing ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <Check className="h-3 w-3 mr-1" />
                                      {isExpense ? "Reembolsado" : "Marcar como Pagada"}
                                    </>
                                  )}
                                </Button>
                                {/* Botón Editar para transacciones y facturas pendientes */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isProcessing}
                                  className="h-8"
                                  onClick={() => handleEdit(transaction.id, sourceType)}
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  Editar
                                </Button>
                                {/* Solo mostrar cancelar para transacciones, no para facturas ni gastos del modelo Expense */}
                                {isTransaction && !isExpense && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={isProcessing}
                                        className="h-8"
                                      >
                                        <X className="h-3 w-3 mr-1" />
                                        Cancelar
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>
                                          ¿Cancelar transacción?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Esta acción marcará la transacción como
                                          cancelada. ¿Estás seguro?
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>No</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleCancel(transaction.id)}
                                        >
                                          Sí, cancelar
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </>
                            );
                          }

                          // Mostrar acciones para transacciones pagadas (solo TRANSACTION puede editarse/cancelarse)
                          if (isTransaction && isPaid) {
                            return (
                              <>
                                <Badge
                                  variant="default"
                                  className="bg-green-500 hover:bg-green-600 text-white"
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Pagada
                                </Badge>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isProcessing}
                                  className="h-8"
                                  onClick={() => handleEdit(transaction.id, sourceType)}
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  Editar
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={isProcessing}
                                      className="h-8"
                                    >
                                      <X className="h-3 w-3 mr-1" />
                                      Cancelar
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        ¿Cancelar transacción pagada?
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta acción marcará la transacción como cancelada, incluso si ya está pagada. ¿Estás seguro?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>No</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleCancel(transaction.id)}
                                      >
                                        Sí, cancelar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            );
                          }

                          // Mostrar solo badge para facturas pagadas (no se pueden editar/cancelar)
                          if (isInvoice && isPaid) {
                            return (
                              <Badge
                                variant="default"
                                className="bg-green-500 hover:bg-green-600 text-white"
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Pagada
                              </Badge>
                            );
                          }

                          // Mostrar acciones para transacciones canceladas (pueden editarse)
                          if (isTransaction && isCancelled) {
                            return (
                              <>
                                <Badge
                                  variant="destructive"
                                  className="bg-red-500 hover:bg-red-600 text-white"
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Cancelada
                                </Badge>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isProcessing}
                                  className="h-8"
                                  onClick={() => handleEdit(transaction.id, sourceType)}
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  Editar
                                </Button>
                              </>
                            );
                          }

                          // Para Expense o estados no manejados, mostrar guión
                          return <span className="text-muted-foreground text-sm">-</span>;
                        })()}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Diálogo de edición de transacciones */}
      <EditTransactionDialog
        transaction={editingTransaction}
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingTransaction(null);
          }
        }}
      />

      {/* Diálogo de edición de facturas */}
      <EditInvoiceDialog
        invoice={editingInvoice}
        open={isEditInvoiceDialogOpen}
        onOpenChange={(open) => {
          setIsEditInvoiceDialogOpen(open);
          if (!open) {
            setEditingInvoice(null);
          }
        }}
      />

      {/* Diálogo de edición de gastos */}
      <EditExpenseDialog
        expenseId={editingExpenseId}
        open={editingExpenseId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingExpenseId(null);
          }
        }}
      />
    </div>
  );
}
