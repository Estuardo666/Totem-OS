"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getClientAccountStatus } from "@/actions/finance-actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AccountStatusProps {
  clientId: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function AccountStatus({ clientId }: AccountStatusProps) {
  const [pendingDebts, setPendingDebts] = useState<
    Array<{
      id: string;
      description: string;
      amount: number;
      date: Date;
      daysOverdue: number;
      sourceType: "INVOICE" | "TRANSACTION";
    }>
  >([]);
  const [paymentHistory, setPaymentHistory] = useState<
    Array<{
      id: string;
      description: string;
      amount: number;
      date: Date;
      status: string;
      sourceType: "INVOICE" | "TRANSACTION";
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAccountStatus() {
      setLoading(true);
      try {
        const result = await getClientAccountStatus(clientId);
        if (result.success && result.data) {
          setPendingDebts(result.data.pendingDebts);
          setPaymentHistory(result.data.paymentHistory);
        }
      } catch (error) {
        console.error("Error al cargar estado de cuenta:", error);
      } finally {
        setLoading(false);
      }
    }

    loadAccountStatus();
  }, [clientId]);

  const totalPending = pendingDebts.reduce((sum, debt) => sum + debt.amount, 0);
  const totalPaid = paymentHistory.reduce((sum, payment) => sum + payment.amount, 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">Cargando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="pending" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="pending">
          Deudas Pendientes ({pendingDebts.length})
        </TabsTrigger>
        <TabsTrigger value="history">
          Historial de Pagos ({paymentHistory.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="pending" className="mt-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Deudas Pendientes</CardTitle>
              <Badge variant="secondary" className="text-lg">
                Total: {formatCurrency(totalPending)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {pendingDebts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay deudas pendientes
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Días de Atraso</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingDebts.map((debt) => {
                      const isVeryOverdue = debt.daysOverdue > 15;
                      const isModeratelyOverdue = debt.daysOverdue > 5;

                      return (
                        <TableRow key={debt.id}>
                          <TableCell className="font-medium">
                            {debt.description}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(debt.date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            {debt.daysOverdue > 0 ? (
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
                                {isVeryOverdue ? "Vencido" : `${debt.daysOverdue} días`}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">Al día</span>
                            )}
                          </TableCell>
                          <TableCell
                            className={`text-right font-semibold ${
                              isVeryOverdue
                                ? "text-red-600"
                                : isModeratelyOverdue
                                  ? "text-orange-600"
                                  : ""
                            }`}
                          >
                            {formatCurrency(debt.amount)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="history" className="mt-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Historial de Pagos</CardTitle>
              <Badge variant="default" className="text-lg bg-green-500 hover:bg-green-600">
                Total: {formatCurrency(totalPaid)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {paymentHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay historial de pagos
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Fecha de Pago</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentHistory.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">
                          {payment.description}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(payment.date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

