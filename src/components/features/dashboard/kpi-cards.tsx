import { getFinancialStats } from "@/actions/finance-actions";
import { getPendingTasksCount } from "@/actions/content-actions";
import { getClients } from "@/actions/client-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <Card className="animate-fade-in" style={{ animationDelay: "0ms", animationFillMode: "both" }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ingresos del Mes
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {financialStats
                ? formatCurrency(financialStats.totalIncome)
                : "$0.00"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Facturas pagadas
            </p>
          </CardContent>
        </Card>
      ),
    });
  }

  cards.push(
    {
      key: "pending",
      content: (
        <Card className="animate-fade-in" style={{ animationDelay: `${cards.length * 120}ms`, animationFillMode: "both" }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tareas Pendientes
            </CardTitle>
            <CheckCircle2 className={`h-4 w-4 ${getCountColor(pendingTasksCount)}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-6xl font-bold ${getCountColor(pendingTasksCount)}`}>
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
          </CardContent>
        </Card>
      ),
    },
    {
      key: "clients",
      content: (
        <Card className="animate-fade-in" style={{ animationDelay: `${(cards.length + 1) * 120}ms`, animationFillMode: "both" }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Clientes Activos
            </CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {activeClientsCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Activos en el sistema
            </p>
          </CardContent>
        </Card>
      ),
    }
  );

  return cards.map((card, index) => (
    <div key={card.key} className="contents" style={{ animationDelay: `${index * 120}ms` }}>
      {card.content}
    </div>
  ));
}
