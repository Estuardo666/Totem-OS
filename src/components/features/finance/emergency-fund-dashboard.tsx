"use client";

import { useState } from "react";
import {
  Shield,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import type { EmergencyFundMovementWithUser } from "@/schemas/emergency-fund";
import { getMonthName } from "@/lib/finance-funds-logic";
import { executeEmergencyWithdrawal } from "@/actions/finance-funds-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { EmergencyWithdrawalForm } from "./emergency-withdrawal-form";

interface EmergencyFundDashboardProps {
  balance: {
    balance: number;
    lastMovementDate: Date | null;
    coverageMonths: number | null;
  } | null;
  movements: EmergencyFundMovementWithUser[];
  userRole: string;
}

export function EmergencyFundDashboard({
  balance,
  movements,
}: EmergencyFundDashboardProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleExecute = async (movementId: string) => {
    setProcessingId(movementId);
    try {
      const result = await executeEmergencyWithdrawal(movementId);
      if (result.success) {
        toast({
          title: "Retiro ejecutado",
          description: "Se creó la transacción de egreso correspondiente.",
        });
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
      }
    } finally {
      setProcessingId(null);
    }
  };

  const currentBalance = balance?.balance ?? 0;
  const contributions = movements.filter((m) => m.type === "CONTRIBUTION");
  const withdrawals = movements.filter((m) => m.type === "WITHDRAWAL");
  const totalContributed = contributions.reduce((s, m) => s + m.amount, 0);
  const totalWithdrawn = withdrawals.reduce((s, m) => s + m.amount, 0);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Saldo actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
              ${currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            {balance?.coverageMonths !== null && balance?.coverageMonths !== undefined && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                {balance.coverageMonths} meses de cobertura
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-green-600" />
              Total aportado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${totalContributed.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{contributions.length} aportes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowDownRight className="h-4 w-4 text-red-600" />
              Total retirado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${totalWithdrawn.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{withdrawals.length} retiros</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Último movimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {balance?.lastMovementDate
                ? new Date(balance.lastMovementDate).toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "Sin movimientos"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Movimientos del fondo</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <ArrowDownRight className="mr-2 h-4 w-4" />
              Solicitar retiro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Solicitar retiro del fondo</DialogTitle>
            </DialogHeader>
            <EmergencyWithdrawalForm
              currentBalance={currentBalance}
              onSuccess={() => setIsDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Movements table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Mes</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Autorizado por</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No hay movimientos registrados
                  </TableCell>
                </TableRow>
              ) : (
                movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm">
                      {new Date(m.createdAt).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      {m.type === "CONTRIBUTION" ? (
                        <Badge variant="default" className="gap-1 bg-green-600">
                          <ArrowUpRight className="h-3 w-3" /> Aporte
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <ArrowDownRight className="h-3 w-3" /> Retiro
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {getMonthName(m.month)} {m.year}
                    </TableCell>
                    <TableCell className={`font-semibold ${m.type === "CONTRIBUTION" ? "text-green-600" : "text-red-600"}`}>
                      {m.type === "CONTRIBUTION" ? "+" : "-"}${m.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      ${m.balanceAfter.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">
                      {m.reason || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.authorizedBy?.name || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {m.type === "WITHDRAWAL" && !m.relatedTransactionId && (
                        <Button
                          size="sm"
                          onClick={() => handleExecute(m.id)}
                          disabled={processingId === m.id}
                        >
                          {processingId === m.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <DollarSign className="mr-1 h-3 w-3" />
                              Ejecutar
                            </>
                          )}
                        </Button>
                      )}
                      {m.relatedTransactionId && (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Ejecutado
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
