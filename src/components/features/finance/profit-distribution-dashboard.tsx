"use client";

import { useState } from "react";
import {
  PiggyBank,
  TrendingUp,
  TrendingDown,
  Plus,
  CheckCircle2,
  Clock,
  DollarSign,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import type { ProfitDistributionWithItems } from "@/schemas/profit-distribution";
import { getMonthName } from "@/lib/finance-funds-logic";
import {
  approveProfitDistribution,
  payProfitDistribution,
  deleteProfitDistributionAction,
} from "@/actions/finance-funds-actions";
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
import { CreateProfitDistributionForm } from "./create-profit-distribution-form";

interface ProfitDistributionDashboardProps {
  distributions: ProfitDistributionWithItems[];
  preview: {
    collectedCash: number;
    totalExpensesPaid: number;
    totalHonorariosPaid: number;
    netProfit: number;
    fundContribution: number;
    distributableAmount: number;
    canDistribute: boolean;
    reasonNoDistribution?: string;
    eligibleUsers: Array<{
      userId: string;
      userName: string;
      profitSharePercent: number;
    }>;
    existingDistribution: { id: string; status: string } | null;
  } | null;
  currentYear: number;
  currentMonth: number;
  userRole: string;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    DRAFT: { label: "Borrador", variant: "outline" },
    APPROVED: { label: "Aprobada", variant: "secondary" },
    PAID: { label: "Pagada", variant: "default" },
  };
  const v = variants[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={v.variant}>{v.label}</Badge>;
}

export function ProfitDistributionDashboard({
  distributions,
  preview,
  currentYear,
  currentMonth,
}: ProfitDistributionDashboardProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      const result = await approveProfitDistribution(id);
      if (result.success) {
        toast({ title: "Distribución aprobada" });
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handlePay = async (id: string) => {
    setProcessingId(id);
    try {
      const result = await payProfitDistribution(id);
      if (result.success) {
        toast({
          title: "Distribución pagada",
          description: `Se crearon ${result.data?.transactionsCreated} transacciones de honorarios.`,
        });
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setProcessingId(id);
    try {
      const result = await deleteProfitDistributionAction(id);
      if (result.success) {
        toast({ title: "Distribución eliminada" });
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
      }
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      {preview && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Caja cobrada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${preview.collectedCash.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground mt-1">{getMonthName(currentMonth)} {currentYear}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Gastos + Honorarios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                ${(preview.totalExpensesPaid + preview.totalHonorariosPaid).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Utilidad neta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${preview.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                ${preview.netProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <PiggyBank className="h-4 w-4" />
                Distribuible
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                ${preview.distributableAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              {preview.fundContribution > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  (${preview.fundContribution.toLocaleString("en-US", { minimumFractionDigits: 2 })} al fondo)
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Historial de distribuciones</h2>
        {preview?.canDistribute && !preview.existingDistribution && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Crear distribución
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nueva distribución de utilidades</DialogTitle>
              </DialogHeader>
              <CreateProfitDistributionForm
                preview={preview}
                currentYear={currentYear}
                currentMonth={currentMonth}
                onSuccess={() => setIsDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* No distribution possible notice */}
      {preview && !preview.canDistribute && !preview.existingDistribution && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {preview.reasonNoDistribution || "No se puede crear una distribución para este mes."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Distributions table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead>Utilidad neta</TableHead>
                <TableHead>Fondo</TableHead>
                <TableHead>Distribuido</TableHead>
                <TableHead>Socios</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {distributions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No hay distribuciones registradas
                  </TableCell>
                </TableRow>
              ) : (
                distributions.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      {getMonthName(d.month)} {d.year}
                    </TableCell>
                    <TableCell>${d.totalProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {d.fundContribution > 0 ? `$${d.fundContribution.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                    </TableCell>
                    <TableCell className="font-semibold text-emerald-600">
                      ${d.distributableAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{d.items.length}</TableCell>
                    <TableCell><StatusBadge status={d.status} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {d.status === "DRAFT" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(d.id)}
                              disabled={processingId === d.id}
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Aprobar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(d.id)}
                              disabled={processingId === d.id}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        {d.status === "APPROVED" && (
                          <Button
                            size="sm"
                            onClick={() => handlePay(d.id)}
                            disabled={processingId === d.id}
                          >
                            <DollarSign className="mr-1 h-3 w-3" />
                            Pagar
                          </Button>
                        )}
                        {d.status === "PAID" && (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Completada
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Distribution items detail for latest */}
      {distributions.length > 0 && distributions[0].items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Detalle — {getMonthName(distributions[0].month)} {distributions[0].year}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Socio</TableHead>
                  <TableHead>%</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distributions[0].items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.user.name}</TableCell>
                    <TableCell>{item.percent.toFixed(1)}%</TableCell>
                    <TableCell className="font-semibold">
                      ${item.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      {item.paidTransactionId ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Pagado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <Clock className="h-3 w-3" /> Pendiente
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
