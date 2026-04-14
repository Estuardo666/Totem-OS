"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, differenceInDays } from "date-fns";
import { Check, MessageCircle, Loader2 } from "lucide-react";
import {
  markTransactionAsPaid,
  markInvoiceAsPaid,
  markRecurringAsPaid,
} from "@/actions/finance-actions";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

interface ReceivablesTableProps {
  transactions: Array<{
    id: string;
    clientName?: string;
    clientLogo?: string | null;
    description: string;
    amount: number;
    date: Date;
    daysOverdue: number;
    status: "PENDING" | "PAID";
    sourceType: "INVOICE" | "TRANSACTION" | "RECURRING";
  }>;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ReceivablesTable({ transactions }: ReceivablesTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Ensure transactions is an array
  const safeTransactions = Array.isArray(transactions) ? transactions : [];

  const handleMarkAsPaid = async (transactionId: string, sourceType: "INVOICE" | "TRANSACTION" | "RECURRING", amount?: number) => {
    setProcessingId(transactionId);
    try {
      let result;
      if (sourceType === "INVOICE") {
        result = await markInvoiceAsPaid(transactionId);
      } else if (sourceType === "TRANSACTION") {
        result = await markTransactionAsPaid(transactionId);
      } else if (sourceType === "RECURRING") {
        result = await markRecurringAsPaid(transactionId, amount ?? 0);
      }

      if (result && result.success) {
        toast({
          title: "Transacción actualizada",
          description: "La transacción ha sido marcada como pagada.",
        });
        router.refresh();
      } else if (result) {
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

  const handleSendWhatsApp = (transaction: ReceivablesTableProps["transactions"][0]) => {
    // Crear mensaje predefinido
    const message = `Hola ${transaction.clientName || "Cliente"}, te saluda Totem OS. Recordamos que tienes un pago pendiente de ${formatCurrency(transaction.amount)} por el concepto de ${transaction.description}.`;
    
    // Codificar el mensaje para URL
    const encodedMessage = encodeURIComponent(message);
    
    // Abrir WhatsApp Web/App con el mensaje
    // Nota: Necesitarías el número de teléfono del cliente para enviar directamente
    // Por ahora, abrimos WhatsApp con el mensaje listo para pegar
    window.open(`https://wa.me/?text=${encodedMessage}`, "_blank");
    
    toast({
      title: "WhatsApp abierto",
      description: "El mensaje está listo para enviar. Pega el número del cliente.",
    });
  };

  if (!safeTransactions || safeTransactions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">
            No hay cuentas por cobrar pendientes
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
            <TableHead>Cliente</TableHead>
            <TableHead>Concepto</TableHead>
            <TableHead>Fecha de Emisión</TableHead>
            <TableHead>Días de Atraso</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {safeTransactions.map((transaction) => {
            const isProcessing = processingId === transaction.id;
            const daysOverdue = transaction.daysOverdue;
            const isVeryOverdue = daysOverdue > 15;
            const isModeratelyOverdue = daysOverdue > 5 && daysOverdue <= 15;
            const isUpcoming = daysOverdue < 0;

            // Determinar color del monto basado en estado
            let amountColor = "";
            if (isVeryOverdue) {
              amountColor = "text-red-600 font-bold";
            } else if (isModeratelyOverdue) {
              amountColor = "text-orange-600 font-semibold";
            } else if (isUpcoming) {
              amountColor = "text-blue-600 font-semibold";
            }

            return (
              <TableRow key={transaction.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={transaction.clientLogo || undefined} alt={transaction.clientName || "Cliente"} />
                      <AvatarFallback className="text-xs">
                        {(() => {
                          const initials = (transaction.clientName || "")
                            .split(" ")
                            .filter((n) => n.length > 0)
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2);
                          return initials || "?";
                        })()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{transaction.clientName || "-"}</span>
                  </div>
                </TableCell>
                <TableCell>{transaction.description}</TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(transaction.date), "dd/MM/yyyy")}
                </TableCell>
                <TableCell>
                  {isVeryOverdue ? (
                    <Badge className="bg-red-500 hover:bg-red-600 text-white">
                      Vencido ({daysOverdue} días)
                    </Badge>
                  ) : isModeratelyOverdue ? (
                    <Badge className="bg-orange-500 hover:bg-orange-600 text-white">
                      {daysOverdue} días atrasado
                    </Badge>
                  ) : isUpcoming ? (
                    <Badge className="bg-blue-500 hover:bg-blue-600 text-white">
                      Próximo {Math.abs(daysOverdue)} días
                    </Badge>
                  ) : daysOverdue === 0 ? (
                    <Badge className="bg-blue-500 hover:bg-blue-600 text-white">
                      Hoy
                    </Badge>
                  ) : (
                    <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">
                      {daysOverdue} días atrasado
                    </Badge>
                  )}
                </TableCell>
                <TableCell className={`text-right font-semibold ${amountColor}`}>
                  {formatCurrency(transaction.amount)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {transaction.sourceType === "RECURRING" && (
                      <Badge className="bg-purple-500 hover:bg-purple-600 text-white">
                        Tarifa Mensual
                      </Badge>
                    )}
                    {transaction.sourceType !== "RECURRING" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendWhatsApp(transaction)}
                        className="h-8 bg-green-500 hover:bg-green-600 text-white"
                      >
                        <MessageCircle className="h-3 w-3 mr-1" />
                        WhatsApp
                      </Button>
                    )}
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() =>
                        handleMarkAsPaid(transaction.id, transaction.sourceType, transaction.amount)
                      }
                      disabled={isProcessing}
                      className="h-8 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {isProcessing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Marcar como Pagada
                        </>
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

