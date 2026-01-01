"use client";

import { useState, useMemo, useEffect } from "react";
import { getExpensesStats } from "@/actions/finance-actions";
import { getUsers } from "@/actions/user.actions";
import { getClients } from "@/actions/client-actions";
import { ExpensesSummary } from "@/components/features/finance/expenses-summary";
import { ExpensesTable } from "@/components/features/finance/expenses-table";
import { ExpensesPieChart } from "@/components/features/finance/expenses-pie-chart";
import { ExpensesBarChart } from "@/components/features/finance/expenses-bar-chart";
import { ExpensesFilters } from "@/components/features/finance/expenses-filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

export function ExpensesWrapper() {
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    month: "",
    userId: "all",
    clientId: "all",
    category: "all",
  });
  const [expensesData, setExpensesData] = useState<any>(null);
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
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Gastos y Egresos</h1>
        </div>
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
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Gastos y Egresos</h1>
        </div>
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
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Gastos y Egresos</h1>
        <p className="text-muted-foreground mt-2">
          Gestiona los gastos de la agencia y reembolsos pendientes
        </p>
      </div>

      {/* Filtros */}
      <div className="mb-6">
        <ExpensesFilters
          users={users}
          clients={clients}
          expenses={expensesData.expenses}
          onFilterChange={setFilters}
          onLiquidate={reloadData}
        />
      </div>

      {/* Resumen de métricas */}
      <div className="mb-8">
        <ExpensesSummary
          totalExpensesThisMonth={expensesData.totalExpensesThisMonth}
          pendingReimbursement={expensesData.pendingReimbursement}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-6 mb-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribución por Categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpensesPieChart data={expensesData.categoryDistribution} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gastos por Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpensesBarChart data={expensesData.clientDistribution} />
          </CardContent>
        </Card>
      </div>

      {/* Tabla de gastos */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Gastos</h2>
        <ExpensesTable expenses={expensesData.expenses} onUpdate={reloadData} />
      </div>
    </div>
  );
}
