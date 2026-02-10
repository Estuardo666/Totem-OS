"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, differenceInDays } from "date-fns";
import { Check, MessageCircle, Loader2 } from "lucide-react";
import {
  markTransactionAsPaid,
  markInvoiceAsPaid,
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
    description: string;
    amount: number;
    date: Date;
    daysOverdue: number;
    sourceType: "INVOICE" | "TRANSACTION";
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

  const handleMarkAsPaid = async (transactionId: string, sourceType: "INVOICE" | "TRANSACTION") => {
    setProcessingId(transactionId);
    try {
      let result;
      if (sourceType === "INVOICE") {
        result = await markInvoiceAsPaid(transactionId);
      } else {
        result = await markTransactionAsPaid(transactionId);
      }

      if (result.success) {
        toast({
          title: "Transacción actualizada",
          description: "La transacción ha sido marcada como pagada.",
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

  if (transactions.length === 0) {
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
          {transactions.map((transaction) => {
            const isProcessing = processingId === transaction.id;
            const daysOverdue = transaction.daysOverdue;
            const isOverdue = daysOverdue > 0;
            const isVeryOverdue = daysOverdue > 15;
            const isModeratelyOverdue = daysOverdue > 5;

            // Determinar color del monto
            let amountColor = "";
            if (isVeryOverdue) {
              amountColor = "text-red-600 font-bold";
            } else if (isModeratelyOverdue) {
              amountColor = "text-orange-600 font-semibold";
            }

            return (
              <TableRow key={transaction.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={(transaction as any).clientLogo || undefined} alt={transaction.clientName || "Cliente"} />
                      <AvatarFallback className="text-xs">
                        {(transaction.clientName || "")
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2) || "?"}
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
                  {isOverdue ? (
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={isVeryOverdue ? "destructive" : "secondary"}
                        className={
                          isVeryOverdue
                            ? "bg-red-500 hover:bg-red-600 text-white"
                            : isModeratelyOverdue
                              ? "bg-orange-500 hover:bg-orange-600 text-white"
                              : ""
                        }
                      >
                        {isVeryOverdue ? "Vencido" : `${daysOverdue} días`}
                      </Badge>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">Al día</span>
                  )}
                </TableCell>
                <TableCell className={`text-right font-semibold ${amountColor}`}>
                  {formatCurrency(transaction.amount)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendWhatsApp(transaction)}
                      className="h-8 bg-green-500 hover:bg-green-600 text-white"
                    >
                      <MessageCircle className="h-3 w-3 mr-1" />
                      WhatsApp
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() =>
                        handleMarkAsPaid(transaction.id, transaction.sourceType)
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

