"use client";

import { useState } from "react";
import { Settings, DollarSign } from "lucide-react";
import { UserSettlementReport } from "@/actions/finance-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SalaryConfigDialog } from "./salary-config-dialog";
import { ProcessPaymentDialog } from "./process-payment-dialog";
import { PendingExpensesDialog } from "./pending-expenses-dialog";
import type { User } from "@prisma/client";

interface SettlementCardProps {
  userReport: UserSettlementReport;
  user: User;
  month: number;
  year: number;
  isAdmin: boolean;
}

export function SettlementCard({
  userReport,
  user,
  month,
  year,
  isAdmin,
}: SettlementCardProps) {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [expensesDialogOpen, setExpensesDialogOpen] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getSalaryTypeBadge = (salaryType: string, role: string) => {
    // Si es ADMIN con PROFIT_SHARE, no mostrar badge de tipo de salario (ya se muestra el de rol)
    if (role === "ADMIN" && salaryType === "PROFIT_SHARE") {
      return null;
    }
    
    switch (salaryType) {
      case "MONTHLY":
        return <Badge variant="outline">Mensual</Badge>;
      case "HOURLY":
        return <Badge variant="outline">Por Hora</Badge>;
      case "PROFIT_SHARE":
        return <Badge variant="default" className="bg-purple-600">Socio</Badge>;
      default:
        return <Badge variant="outline">{salaryType}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "ADMIN":
        return <Badge className="bg-purple-600">Socio</Badge>;
      case "EDITOR":
        return <Badge className="bg-blue-600">Editor</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const getUserInitials = (name: string) => {
    return name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "";
  };

  const totalEstimated = userReport.salary + userReport.reimbursements;
  const progressPercentage = totalEstimated > 0 
    ? (userReport.paidSoFar / totalEstimated) * 100 
    : 0;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={user.image || undefined} alt={userReport.userName} />
                <AvatarFallback>{getUserInitials(userReport.userName)}</AvatarFallback>
              </Avatar>
              <div className="space-y-2 flex-1 min-w-0">
                <CardTitle className="text-xl truncate">{userReport.userName}</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  {getRoleBadge(userReport.userRole)}
                  {getSalaryTypeBadge(userReport.salaryType, userReport.userRole)}
                </div>
              </div>
            </div>
            {isAdmin && (
              <div className="flex gap-2 shrink-0 w-full md:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfigDialogOpen(true)}
                  className="flex-1 md:flex-initial"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar
                </Button>
                {userReport.remaining > 0 && (
                  <Button
                    size="sm"
                    onClick={() => setPaymentDialogOpen(true)}
                    className="flex-1 md:flex-initial"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Pagar
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Desglose Financiero */}
          <div className="space-y-3">
            {/* Salario Base / Participación */}
            {userReport.salaryType === "PROFIT_SHARE" && userReport.netIncome !== undefined ? (
              <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center text-sm">
                  <span className="text-muted-foreground">Ingresos Netos Globales:</span>
                  <span className="font-medium">{formatCurrency(userReport.netIncome)}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center text-sm">
                  <span className="text-muted-foreground">
                    Tu Participación ({user.profitSharePercent ?? 0}%):
                  </span>
                  <span className="font-semibold">{formatCurrency(userReport.share ?? 0)}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center p-3 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">
                  {userReport.salaryType === "HOURLY" ? "Salario (Horas × Tarifa):" : "Salario Base:"}
                </span>
                <span className="font-semibold">{formatCurrency(userReport.salary)}</span>
              </div>
            )}

            {/* Gastos por Reembolsar */}
            {userReport.reimbursements > 0 && (
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center p-3 bg-muted/50 rounded-lg">
                <button
                  onClick={() => setExpensesDialogOpen(true)}
                  className="text-left text-muted-foreground hover:text-foreground transition-colors cursor-pointer underline underline-offset-2"
                >
                  (+) Gastos por Reembolsar:
                </button>
                <span className="font-semibold text-orange-600">
                  {formatCurrency(userReport.reimbursements)}
                </span>
              </div>
            )}

            {/* Pagado hasta ahora */}
            {userReport.paidSoFar > 0 && (
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center p-3 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">(-) Pagado hasta ahora:</span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(userReport.paidSoFar)}
                </span>
              </div>
            )}

            {/* Total Pendiente */}
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center p-4 bg-primary/10 rounded-lg border-2 border-primary/20">
              <span className="font-semibold text-lg">(=) Total Pendiente:</span>
              <span className="font-bold text-xl text-primary">
                {formatCurrency(userReport.remaining)}
              </span>
            </div>
          </div>

          {/* Barra de Progreso */}
          {totalEstimated > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progreso de Pago</span>
                <span className="font-medium">{progressPercentage.toFixed(0)}%</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      {isAdmin && (
        <>
          <SalaryConfigDialog
            open={configDialogOpen}
            onOpenChange={setConfigDialogOpen}
            userReport={userReport}
            currentConfig={{
              salaryType: user.salaryType,
              baseSalary: user.baseSalary,
              hourlyRate: user.hourlyRate,
              profitSharePercent: user.profitSharePercent,
              bankAccountInfo: user.bankAccountInfo,
            }}
          />
          <ProcessPaymentDialog
            open={paymentDialogOpen}
            onOpenChange={setPaymentDialogOpen}
            userReport={userReport}
            month={month}
            year={year}
          />
        </>
      )}
      <PendingExpensesDialog
        open={expensesDialogOpen}
        onOpenChange={setExpensesDialogOpen}
        userId={userReport.userId}
        userName={userReport.userName}
      />
    </>
  );
}

