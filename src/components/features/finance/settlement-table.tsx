"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { createOrUpdateTransfer, markTransferAsPaid, registerHonorariosPayment } from "@/actions/settlement-actions";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, DollarSign } from "lucide-react";
import type { UserSettlement } from "@/actions/settlement-actions";
import type { User } from "@prisma/client";

interface SettlementTableProps {
  userSettlements: UserSettlement[];
  users: User[];
  month: number;
  year: number;
}

export function SettlementTable({
  userSettlements,
  users,
  month,
  year,
}: SettlementTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const isAdmin = userRole === "ADMIN";
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const handleMarkAsTransferred = async (settlement: UserSettlement) => {
    setProcessingIds((prev) => new Set(prev).add(settlement.userId));

    try {
      let result;

      if (settlement.type === "HONORARIOS") {
        // Para honorarios, crear transacción HONORARIOS en Finanzas
        result = await registerHonorariosPayment(
          settlement.userId,
          settlement.amount,
          `Pago de honorarios - ${settlement.userName}`
        );
      } else {
        // Para salarios, solo marcar la transferencia como pagada
        if (settlement.transferId) {
          result = await markTransferAsPaid(settlement.transferId);
        } else {
          result = await createOrUpdateTransfer(
            settlement.userId,
            settlement.amount,
            settlement.type,
            month,
            year,
            "PAID"
          );
        }
      }

      if (result.success) {
        toast({
          title: settlement.type === "HONORARIOS" ? "Pago de honorarios registrado" : "Transferencia registrada",
          description: `Se ha registrado el pago de ${formatCurrency(settlement.amount)} ${settlement.type === "HONORARIOS" ? "en Finanzas" : "como transferido"}.`,
        });
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo registrar el pago",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado",
      });
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(settlement.userId);
        return newSet;
      });
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "ADMIN":
        return <Badge variant="default" className="bg-purple-600">Socio</Badge>;
      case "EDITOR":
        return <Badge variant="default" className="bg-blue-600">Editor</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const getTypeLabel = (type: string) => {
    return type === "HONORARIOS" ? "Honorarios" : "Salario";
  };

  if (userSettlements.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">
            No hay liquidaciones para este mes
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Liquidación por Integrante</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Integrante</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {userSettlements.map((settlement) => {
              const isProcessing = processingIds.has(settlement.userId);
              const isPaid = settlement.status === "PAID";

              return (
                <TableRow key={settlement.userId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{settlement.userName}</span>
                      {getRoleBadge(settlement.userRole)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getTypeLabel(settlement.type)}</Badge>
                  </TableCell>
                  <TableCell className="font-semibold">
                    {formatCurrency(settlement.amount)}
                  </TableCell>
                  <TableCell>
                    {isPaid ? (
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Pagado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                        Pendiente
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isPaid ? (
                      <Button variant="outline" size="sm" disabled>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Transferido
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleMarkAsTransferred(settlement)}
                        disabled={isProcessing || !isAdmin}
                        title={!isAdmin ? "Solo los administradores pueden registrar pagos" : undefined}
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Procesando...
                          </>
                        ) : (
                          <>
                            <DollarSign className="h-4 w-4 mr-2" />
                            {settlement.type === "HONORARIOS"
                              ? "Registrar Pago de Honorarios"
                              : "Marcar como Transferido"}
                          </>
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

