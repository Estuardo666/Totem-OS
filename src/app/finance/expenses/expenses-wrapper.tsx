"use client";

import { useState, useEffect } from "react";
import { getExpensesStats } from "@/actions/finance-actions";
import { getUsers } from "@/actions/user.actions";
import { getClients } from "@/actions/client-actions";
import type { ExpensesStatsData } from "@/lib/finance-reporting-service";
import { ExpensesSummary } from "@/components/features/finance/expenses-summary";
import { ExpensesTable } from "@/components/features/finance/expenses-table";
import { ExpensesPieChart } from "@/components/features/finance/expenses-pie-chart";
import { ExpensesBarChart } from "@/components/features/finance/expenses-bar-chart";
import { ExpensesFilters } from "@/components/features/finance/expenses-filters";
import { ExpensesBusinessPanel } from "@/components/features/finance/expenses-business-panel";
import { ExpensesPersonalAnalyticsPanel } from "@/components/features/finance/expenses-personal-analytics-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { PageHeader } from "@/components/shared";

export function ExpensesWrapper() {
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    month: "",
    userId: "all",
    clientId: "all",
    category: "all",
  });
  const [expensesData, setExpensesData] = useState<ExpensesStatsData | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Cargar usuarios y clientes
  useEffect(() => {
    Promise.all([getUsers(), getClients()])
      .then(([usersResult, clientsResult]) => {
        if (usersResult.success && usersResult.data) {
          setUsers(usersResult.data);
        }
        if (clientsResult.success && clientsResult.data) {
          setClients(clientsResult.data);
        }
      });
  }, []);

  // Cargar datos de gastos cuando cambian los filtros
  useEffect(() => {
    setLoading(true);
    getExpensesStats(filters)
      .then((result) => {
        if (result.success && result.data) {
          setExpensesData(result.data);
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: result.error || "Error al cargar los gastos",
          });
        }
      })
      .finally(() => setLoading(false));
  }, [filters, toast]);

  // Función para recargar datos después de actualizar un gasto
  const reloadData = () => {
    setLoading(true);
    getExpensesStats(filters)
      .then((result) => {
        if (result.success && result.data) {
          setExpensesData(result.data);
        }
      })
      .finally(() => setLoading(false));
  };

  if (loading && !expensesData) {
    return (
      <div className="container mx-auto p-3">
        <PageHeader title="Gastos y Egresos" />
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">Cargando...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!expensesData) {
    return (
      <div className="container mx-auto p-3">
        <PageHeader title="Gastos y Egresos" />
        <Card>
          <CardContent className="py-12">
            <p className="text-destructive text-center">
              Error al cargar los gastos
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3">
      <PageHeader
        title="Gastos y Egresos"
        description="Controla la capa empresarial oficial y, en paralelo, revisa la analítica personal interna del equipo"
      />

      <div className="mb-6">
        <ExpensesFilters
          users={users}
          clients={clients}
          expenses={expensesData.expenses}
          onFilterChange={setFilters}
          onLiquidate={reloadData}
        />
      </div>

      <div className="mb-8">
        <ExpensesSummary
          totalExpensesThisMonth={expensesData.totalExpensesThisMonth}
          pendingReimbursement={expensesData.pendingReimbursement}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          <ExpensesBusinessPanel financeSettingsMetrics={expensesData.financeSettingsMetrics} />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Distribución por categoría</CardTitle>
              </CardHeader>
              <CardContent>
                <ExpensesPieChart data={expensesData.categoryDistribution} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Gastos por cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <ExpensesBarChart data={expensesData.clientDistribution} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Registro operativo de gastos</CardTitle>
            </CardHeader>
            <CardContent>
              <ExpensesTable expenses={expensesData.expenses} onUpdate={reloadData} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <ExpensesPersonalAnalyticsPanel financeSettingsMetrics={expensesData.financeSettingsMetrics} />
        </div>
      </div>
    </div>
  );
}
