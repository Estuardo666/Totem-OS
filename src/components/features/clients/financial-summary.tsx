"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FinancialSummaryProps {
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
      return "Pagada";
    case "PENDING":
      return "Pendiente";
    case "SENT":
      return "Enviada";
    default:
      return status;
  }
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" {
  switch (status) {
    case "PAID":
      return "default";
    case "PENDING":
      return "secondary";
    default:
      return "secondary";
  }
}

function getCategoryLabel(category: string): string {
  switch (category) {
    case "COMIDA":
      return "Comida";
    case "TRANSPORTE":
      return "Transporte";
    case "INVITACIONES":
      return "Invitaciones";
    case "SOFTWARE":
      return "Software";
    case "OFICINA":
      return "Oficina";
    case "EQUIPOS":
      return "Equipos";
    default:
      return category;
  }
}

export function FinancialSummary({
  financial,
  monthlyRate,
  month,
  year,
}: FinancialSummaryProps) {
  const totalExpenses = financial.linkedExpenses.reduce(
    (sum, expense) => sum + expense.amount,
    0
  );

  return (
    <Card className="print:border-gray-300 print:shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          Resumen Financiero - {month} {year}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Estado de Pago */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Estado de Pago Mensual</h3>
          {financial.currentMonthInvoice ? (
            <div className="rounded-lg border p-4 bg-blue-50 dark:bg-blue-950/20 print:bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Factura del Mes</span>
                <Badge
                  variant={getStatusBadgeVariant(financial.currentMonthInvoice.status)}
                  className={
                    financial.currentMonthInvoice.status === "PAID"
                      ? "bg-green-600 text-white"
                      : "bg-yellow-500 text-white"
                  }
                >
                  {getStatusLabel(financial.currentMonthInvoice.status)}
                </Badge>
              </div>
              <div className="text-2xl font-bold text-blue-700">
                {formatCurrency(financial.currentMonthInvoice.amount)}
              </div>
              {financial.currentMonthInvoice.dueDate && (
                <p className="text-xs text-muted-foreground mt-1">
                  Vencimiento:{" "}
                  {new Date(financial.currentMonthInvoice.dueDate).toLocaleDateString(
                    "es-ES"
                  )}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border p-4 bg-gray-50 print:bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Tarifa Mensual Contratada</span>
                <span className="text-lg font-bold">{formatCurrency(monthlyRate)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                No se ha generado factura para este mes
              </p>
            </div>
          )}
        </div>

        {/* Gastos Vinculados */}
        {financial.linkedExpenses.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Gastos Vinculados al Proyecto
            </h3>
            <div className="space-y-2">
              {financial.linkedExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-white print:border-gray-300"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {getCategoryLabel(expense.category)}
                    </Badge>
                    <span className="text-sm">{expense.description}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">
                      {new Date(expense.date).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                    <span className="font-medium text-red-600">
                      {formatCurrency(expense.amount)}
                    </span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between p-3 rounded-lg border-t-2 border-gray-300 bg-gray-50 print:bg-gray-100 mt-2">
                <span className="font-semibold">Total de Gastos</span>
                <span className="font-bold text-red-600">
                  {formatCurrency(totalExpenses)}
                </span>
              </div>
            </div>
          </div>
        )}

        {financial.linkedExpenses.length === 0 && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <p>No hay gastos vinculados a este proyecto en este mes.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

