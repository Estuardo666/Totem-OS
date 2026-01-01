"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LinkedExpensesSectionProps {
  expenses: Array<{
    id: string;
    description: string;
    amount: number;
    category: string;
    date: Date;
  }>;
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

export function LinkedExpensesSection({
  expenses,
  month,
  year,
}: LinkedExpensesSectionProps) {
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <Card className="bg-white shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-blue-600" />
          Gastos Vinculados al Proyecto
        </CardTitle>
      </CardHeader>
      <CardContent>
        {expenses.length > 0 ? (
          <div className="space-y-4">
            <div className="space-y-3">
              {expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {getCategoryLabel(expense.category)}
                    </Badge>
                    <span className="text-sm font-medium text-gray-900">
                      {expense.description}
                    </span>
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
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border-t-2 border-gray-300 bg-gray-50 mt-4">
              <span className="font-semibold text-gray-900">Total de Gastos Pendientes</span>
              <span className="font-bold text-red-600 text-lg">
                {formatCurrency(totalExpenses)}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              No hay gastos adicionales pendientes para este periodo
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

