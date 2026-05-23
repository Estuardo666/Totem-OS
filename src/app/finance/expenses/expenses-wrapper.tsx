"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { getExpensesStats } from "@/actions/finance-actions";
import { getUsers } from "@/actions/user.actions";
import { getClients } from "@/actions/client-actions";
import { ExpensesSummary } from "@/components/features/finance/expenses-summary";
import { ExpensesTable } from "@/components/features/finance/expenses-table";
import { ExpensesPieChart } from "@/components/features/finance/expenses-pie-chart";
import { ExpensesBarChart } from "@/components/features/finance/expenses-bar-chart";
import { ExpensesFilters } from "@/components/features/finance/expenses-filters";
import { ExpensesBusinessPanel } from "@/components/features/finance/expenses-business-panel";
import { ExpensesPersonalAnalyticsPanel } from "@/components/features/finance/expenses-personal-analytics-panel";
import { FinanceOfflineNotice } from "@/components/features/finance/finance-offline-notice";
import { useFinanceOfflineState } from "@/components/features/finance/use-finance-offline-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { projectExpensesSnapshot } from "@/lib/finance-offline-projections";
import {
  cacheExpensesSnapshot,
  cacheFinanceClients,
  cacheFinanceUsers,
  getCachedExpensesSnapshot,
  getCachedFinanceClients,
  getCachedFinanceUsers,
} from "@/lib/finance-offline-store";
import type { ExpensesSnapshot } from "@/lib/finance-offline-types";
import { PageHeader } from "@/components/shared";

function hasExpensesData(snapshot: ExpensesSnapshot | null) {
  return Boolean(
    snapshot &&
      (snapshot.expenses.length > 0 ||
        snapshot.totalExpensesThisMonth > 0 ||
        snapshot.pendingReimbursement > 0)
  );
}

export function ExpensesWrapper() {
  const { toast } = useToast();
  const { queue } = useFinanceOfflineState();
  const [filters, setFilters] = useState({
    month: format(new Date(), "yyyy-MM"),
    userId: "all",
    clientId: "all",
    category: "all",
  });
  const [expensesData, setExpensesData] = useState<ExpensesSnapshot | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>(() =>
    getCachedFinanceUsers().map((user) => ({
      id: user.id,
      name: user.name || "Sin nombre",
    }))
  );
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>(() =>
    getCachedFinanceClients().map((client) => ({
      id: client.id,
      name: client.name,
    }))
  );
  const [loading, setLoading] = useState(true);

  // Cargar usuarios y clientes
  useEffect(() => {
    const cachedUsers = getCachedFinanceUsers();
    if (cachedUsers.length > 0) {
      setUsers(
        cachedUsers.map((user) => ({
          id: user.id,
          name: user.name || "Sin nombre",
        }))
      );
    }

    const cachedClients = getCachedFinanceClients();
    if (cachedClients.length > 0) {
      setClients(
        cachedClients.map((client) => ({
          id: client.id,
          name: client.name,
        }))
      );
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }

    Promise.all([getUsers(), getClients()])
      .then(([usersResult, clientsResult]) => {
        if (usersResult.success && usersResult.data) {
          setUsers(
            usersResult.data.map((user) => ({
              id: user.id,
              name: user.name,
            }))
          );
          cacheFinanceUsers(
            usersResult.data.map((user) => ({
              id: user.id,
              name: user.name,
              image: "image" in user ? user.image ?? null : null,
            }))
          );
        }
        if (clientsResult.success && clientsResult.data) {
          setClients(
            clientsResult.data.map((client) => ({
              id: client.id,
              name: client.name,
            }))
          );
          cacheFinanceClients(
            clientsResult.data.map((client) => ({
              id: client.id,
              name: client.name,
              logo: client.logo ?? null,
              monthlyRate: client.monthlyRate ?? 0,
            }))
          );
        }
      });
  }, []);

  // Cargar datos de gastos cuando cambian los filtros
  useEffect(() => {
    const cachedSnapshot = getCachedExpensesSnapshot();
    if (hasExpensesData(cachedSnapshot)) {
      setExpensesData((current) => current ?? cachedSnapshot);
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    getExpensesStats(filters)
      .then((result) => {
        if (cancelled) return;

        if (result.success && result.data) {
          const nextData: ExpensesSnapshot = result.data;
          setExpensesData(nextData);
          cacheExpensesSnapshot(nextData);
        } else {
          if (hasExpensesData(cachedSnapshot)) {
            return;
          }

          toast({
            variant: "destructive",
            title: "Error",
            description: result.error || "Error al cargar los gastos",
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filters, toast]);

  // Función para recargar datos después de actualizar un gasto
  const reloadData = () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const cachedSnapshot = getCachedExpensesSnapshot();
      if (hasExpensesData(cachedSnapshot)) {
        setExpensesData(cachedSnapshot);
      }
      return;
    }

    setLoading(true);
    getExpensesStats(filters)
      .then((result) => {
        if (result.success && result.data) {
          const nextData: ExpensesSnapshot = result.data;
          setExpensesData(nextData);
          cacheExpensesSnapshot(nextData);
        }
      })
      .finally(() => setLoading(false));
  };

  const projectedExpensesData = useMemo(() => {
    if (!expensesData) return null;

    return projectExpensesSnapshot(
      expensesData,
      queue,
      getCachedFinanceUsers(),
      getCachedFinanceClients()
    );
  }, [expensesData, queue]);

  if (loading && !projectedExpensesData) {
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

  if (!projectedExpensesData) {
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

      <FinanceOfflineNotice />

      <div className="mb-6">
        <ExpensesFilters
          users={users}
          clients={clients}
          expenses={projectedExpensesData.expenses}
          onFilterChange={setFilters}
          onLiquidate={reloadData}
        />
      </div>

      <div className="mb-8">
        <ExpensesSummary
          totalExpensesThisMonth={projectedExpensesData.totalExpensesThisMonth}
          pendingReimbursement={projectedExpensesData.pendingReimbursement}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          <ExpensesBusinessPanel financeSettingsMetrics={projectedExpensesData.financeSettingsMetrics} />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Distribución por categoría</CardTitle>
              </CardHeader>
              <CardContent>
                <ExpensesPieChart data={projectedExpensesData.categoryDistribution} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Gastos por cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <ExpensesBarChart data={projectedExpensesData.clientDistribution} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Registro operativo de gastos</CardTitle>
            </CardHeader>
            <CardContent>
              <ExpensesTable expenses={projectedExpensesData.expenses} onUpdate={reloadData} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <ExpensesPersonalAnalyticsPanel financeSettingsMetrics={projectedExpensesData.financeSettingsMetrics} />
        </div>
      </div>
    </div>
  );
}
