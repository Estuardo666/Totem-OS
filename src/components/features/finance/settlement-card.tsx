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

  const getSalaryTypeBadge = (salaryType: string, _role: string, hasProfitShare: boolean) => {
    const badges = [];

    // Profit share badge (if user has any profitSharePercent)
    if (hasProfitShare) {
      badges.push(
        <Badge key="profit" variant="default" className="bg-purple-600">Participación</Badge>
      );
    }

    // Salary type badge
    switch (salaryType) {
      case "MONTHLY":
        badges.push(<Badge key="type" variant="outline">Mensual</Badge>);
        break;
      case "HOURLY":
        badges.push(<Badge key="type" variant="outline">Por Hora</Badge>);
        break;
      case "PROFIT_SHARE":
        if (!hasProfitShare) {
          badges.push(<Badge key="type" variant="default" className="bg-purple-600">Socio</Badge>);
        }
        break;
      default:
        badges.push(<Badge key="type" variant="outline">{salaryType}</Badge>);
    }

    return badges.length > 0 ? <div className="flex gap-1">{badges}</div> : null;
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
                  {getSalaryTypeBadge(userReport.salaryType, userReport.userRole, (userReport.profitSharePercent ?? 0) > 0)}
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
            {/* Salario Base */}
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center p-3 bg-muted/50 rounded-lg">
              <span className="text-muted-foreground">
                {userReport.salaryType === "HOURLY" ? "Salario (Horas × Tarifa):" : "Salario Base:"}
              </span>
              <span className="font-semibold">{formatCurrency(userReport.salary)}</span>
            </div>

            {/* Participación en Utilidades */}
            {userReport.profitShare > 0 && (
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                <span className="text-muted-foreground">
                  (+) Participación en Utilidades ({userReport.profitSharePercent}%):
                </span>
                <span className="font-semibold text-purple-600">{formatCurrency(userReport.profitShare)}</span>
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

