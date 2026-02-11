import { redirect } from "next/navigation";
import { getFinancialStats } from "@/actions/finance-actions";
import { getPendingTasksCount } from "@/actions/content-actions";
import { getClients } from "@/actions/client-actions";
import { TrendingUp, CheckCircle2, Users, AlertCircle } from "lucide-react";
import { auth } from "@/auth";

// Función para formatear dinero como USD
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Función para obtener el color del contador según la cantidad (semáforo)
function getCountColor(count: number): string {
  if (count === 0) return "text-green-500";
  if (count >= 1 && count <= 3) return "text-emerald-500";
  if (count >= 4 && count <= 9) return "text-yellow-500";
  return "text-red-500";
}

// Función para obtener el mensaje según el conteo
function getCountMessage(count: number): string {
  if (count === 0) return "¡Todo al día!";
  if (count >= 1 && count <= 3) return "En progreso";
  if (count >= 4 && count <= 9) return "Carga moderada";
  return "Carga de trabajo alta";
}

export async function KPICards() {
  // Obtener sesión para determinar rol
  const session = await auth();
  const userRole = session?.user?.role;
  const isAdmin = userRole === "ADMIN";

  // Data fetching en paralelo
  const [financialResult, pendingTasksCountResult, clientsResult] =
    await Promise.all([
      getFinancialStats(),
      getPendingTasksCount(),
      getClients(),
    ]);

  // Verificar errores de autenticación en server component
  if (!clientsResult.success && clientsResult.error?.toLowerCase().includes("no autenticado")) {
    redirect("/sign-in");
  }

  // Procesar datos
  const financialStats = financialResult.success ? financialResult.data : null;
  const pendingTasksCount = pendingTasksCountResult.success
    ? pendingTasksCountResult.data ?? 0
    : 0;
  const allClients = clientsResult.success ? clientsResult.data ?? [] : [];

  // Contar clientes activos
  const activeClientsCount = allClients.filter(
    (client) => client.status === "ACTIVE"
  ).length;

  const cards: { key: string; content: React.ReactNode }[] = [];

  if (isAdmin) {
    cards.push({
      key: "income",
      content: (
        <div className="h-full rounded-2xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">
              Ingresos del Mes
            </span>
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="text-3xl font-bold text-emerald-600">
            {financialStats
              ? formatCurrency(financialStats.totalIncome)
              : "$0.00"}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Facturas pagadas
          </p>
        </div>
      ),
    });
  }

  cards.push(
    {
      key: "pending",
      content: (
        <div className="h-full rounded-2xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">
              Tareas Pendientes
            </span>
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${
              pendingTasksCount === 0 
                ? 'bg-gradient-to-br from-emerald-500 to-green-600' 
                : pendingTasksCount >= 10 
                  ? 'bg-gradient-to-br from-red-500 to-rose-600' 
                  : 'bg-gradient-to-br from-amber-500 to-orange-600'
            }`}>
              <CheckCircle2 className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className={`text-5xl font-bold ${getCountColor(pendingTasksCount)}`}>
            {pendingTasksCount}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <p className={`text-xs font-medium ${getCountColor(pendingTasksCount)}`}>
              {getCountMessage(pendingTasksCount)}
            </p>
            {pendingTasksCount >= 10 && (
              <AlertCircle className="h-3 w-3 text-red-500" />
            )}
          </div>
        </div>
      ),
    },
    {
      key: "clients",
      content: (
        <div className="h-full rounded-2xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">
              Clientes Activos
            </span>
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Users className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="text-3xl font-bold text-violet-600">
            {activeClientsCount}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Activos en el sistema
          </p>
        </div>
      ),
    }
  );

  return cards.map((card, index) => (
    <div key={card.key} className="w-full h-full" style={{ animationDelay: `${index * 120}ms` }}>
      {card.content}
    </div>
  ));
}
