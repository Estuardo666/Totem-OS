"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AccountStatusCardProps {
  financial: {
    currentMonthInvoice: {
      amount: number;
      status: string;
      dueDate: Date | null;
    } | null;
    linkedExpenses: Array<{
      id: string;
      description: string;
      amount: number;
      category: string;
      date: Date;
    }>;
  };
  monthlyRate: number;
  month: string;
  year: number;
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

function getStatusLabel(status: string): string {
  switch (status) {
    case "PAID":
      return "Pagado";
    case "PENDING":
      return "Pendiente";
    case "SENT":
      return "Enviado";
    default:
      return status;
  }
}

export function AccountStatusCard({
  financial,
  monthlyRate,
  month,
  year,
}: AccountStatusCardProps) {
  const status = financial.currentMonthInvoice?.status || "PENDING";
  const isPaid = status === "PAID";

  return (
    <Card className="bg-white shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          Estado de Cuenta
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {financial.currentMonthInvoice ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Mes Actual</span>
              <Badge
                variant={isPaid ? "default" : "secondary"}
                className={
                  isPaid
                    ? "bg-green-600 text-white"
                    : "bg-yellow-500 text-white"
                }
              >
                {getStatusLabel(status)}
              </Badge>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {formatCurrency(financial.currentMonthInvoice.amount)}
            </div>
            {financial.currentMonthInvoice.dueDate && (
              <p className="text-xs text-muted-foreground">
                Vencimiento:{" "}
                {new Date(financial.currentMonthInvoice.dueDate).toLocaleDateString(
                  "es-ES",
                  { day: "2-digit", month: "long", year: "numeric" }
                )}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Tarifa Mensual</span>
              <Badge variant="secondary" className="bg-gray-500 text-white">
                Pendiente
              </Badge>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {formatCurrency(monthlyRate)}
            </div>
            <p className="text-xs text-muted-foreground">
              No se ha generado factura para {month} {year}
            </p>
          </div>
        )}

        {financial.linkedExpenses.length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-xs font-medium text-gray-700 mb-2">
              Gastos Pendientes del Proyecto
            </p>
            <p className="text-sm text-gray-600">
              {financial.linkedExpenses.length} gasto(s) pendiente(s) este mes
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

