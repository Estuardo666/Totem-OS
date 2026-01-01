import { format, isToday, isYesterday, differenceInDays, addDays, startOfDay, endOfDay, differenceInHours } from "date-fns";
import { auth } from "@/auth";
import { getFinancialStats } from "@/actions/finance-actions";
import { getTasks, getPendingTasksCount } from "@/actions/content-actions";
import { getClients } from "@/actions/client-actions";
import { getPendingFeedbacks } from "@/actions/client-feedback-actions";
import { getUserWorkloads } from "@/actions/workload-actions";
import { getPendingPartnerFee } from "@/actions/settlement-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, CheckCircle2, Users, AlertCircle, MessageSquare, DollarSign, Zap, UserCog, PlusCircle, FileText, Receipt } from "lucide-react";
import { TodayScheduledTasks } from "@/components/features/content/today-scheduled-tasks";
import { WorkloadPanel } from "@/components/features/content/workload-panel";
import { TransactionDialog } from "@/components/features/finance/transaction-dialog";
import { VoiceNotesWidget } from "@/components/features/dashboard/voice-notes-widget";
import { DashboardRefresh } from "@/components/features/content/dashboard-refresh";
import Link from "next/link";

// Función para formatear dinero como USD
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Función para obtener el color de la fecha según urgencia
function getDateColor(date: Date | null): string {
  if (!date) return "text-muted-foreground";
  if (isToday(date)) return "text-red-600 font-semibold";
  if (isYesterday(date)) return "text-orange-600 font-semibold";
  const daysDiff = differenceInDays(date, new Date());
  if (daysDiff < 3 && daysDiff >= 0) return "text-yellow-600";
  return "text-muted-foreground";
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

export default async function Home() {
  // Obtener sesión del usuario autenticado
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] || "Usuario";

  // Data fetching en paralelo
  const userId = session?.user?.id;
  
  // Log de depuración
  console.log("🔍 Dashboard - UserID:", userId);
  console.log("🔍 Dashboard - Session:", session?.user);

  const [financialResult, tasksResult, clientsResult, pendingTasksCountResult, feedbacksResult, workloadsResult, pendingFeeResult] =
    await Promise.all([
      getFinancialStats(),
      getTasks(),
      getClients(),
      getPendingTasksCount(),
      getPendingFeedbacks(),
      getUserWorkloads(),
      userId && session?.user?.role === "ADMIN" ? getPendingPartnerFee(userId) : Promise.resolve({ success: true, data: 0 }),
    ]);

  // Procesar datos
  const financialStats = financialResult.success ? financialResult.data : null;
  const allTasks = tasksResult.success ? tasksResult.data ?? [] : [];
  const allClients = clientsResult.success ? clientsResult.data ?? [] : [];
  const pendingTasksCount = pendingTasksCountResult.success
    ? pendingTasksCountResult.data ?? 0
    : 0;
  const pendingFeedbacks = feedbacksResult.success ? feedbacksResult.data ?? [] : [];
  const workloads = workloadsResult.success ? workloadsResult.data ?? [] : [];
  const pendingPartnerFee = pendingFeeResult.success ? pendingFeeResult.data ?? 0 : 0;

  // Tareas prioritarias: no publicadas, con dueDate en los próximos 3 días
  // Incluye tareas asignadas al usuario Y tareas sin asignar (assignedToId === null)
  const startOfToday = startOfDay(new Date());
  const endOfTomorrow = endOfDay(addDays(startOfToday, 1)); // Incluir mañana (31/12/2025)
  const endOfNextThreeDays = endOfDay(addDays(startOfToday, 3));
  
  const urgentTasks = allTasks
    .filter((task) => {
      // Filtrar por usuario asignado O sin asignar (misma lógica que getPendingTasksCount)
      if (userId && task.assignedToId !== null && task.assignedToId !== userId) {
        return false;
      }
      // Filtrar por estado (no publicado)
      if (task.status === "PUBLISHED") return false;
      // Filtrar por fecha (dentro de los próximos 3 días, usando endOfDay para incluir todo el día)
      if (!task.dueDate) return false;
      const taskDueDate = new Date(task.dueDate);
      // Usar startOfDay para la fecha de la tarea para comparar correctamente
      const taskDueDateStart = startOfDay(taskDueDate);
      // Incluir tareas que vencen hoy, mañana o en los próximos 3 días
      return taskDueDateStart >= startOfToday && taskDueDateStart <= endOfNextThreeDays;
    })
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    })
    .slice(0, 5);
  
  // Log de depuración para tareas prioritarias
  console.log("🔍 Tareas Prioritarias - Total encontradas:", urgentTasks.length);
  console.log("🔍 Rango de fechas:", {
    desde: format(startOfToday, "dd/MM/yyyy"),
    hasta: format(endOfNextThreeDays, "dd/MM/yyyy"),
    mañana: format(endOfTomorrow, "dd/MM/yyyy"),
  });
  console.log("🔍 Tareas prioritarias detalle:", urgentTasks.map(t => ({
    title: t.title,
    dueDate: t.dueDate ? format(new Date(t.dueDate), "dd/MM/yyyy") : null,
    assignedToId: t.assignedToId,
  })));

  // Contar clientes activos
  const activeClientsCount = allClients.filter(
    (client) => client.status === "ACTIVE"
  ).length;

  // Nombres de meses en español
  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];

  // Últimas 3 transacciones
  const recentTransactions = financialStats?.recentTransactions.slice(0, 3) || [];

  // Obtener rol del usuario
  const userRole = session?.user?.role;
  const isAdmin = userRole === "ADMIN";
  const isEditor = userRole === "EDITOR";

  // Filtrar workloads para EDITOR: solo mostrar su propio workload
  const filteredWorkloads = isEditor && userId
    ? workloads.filter((workload) => workload.userId === userId)
    : workloads;

  return (
    <div className="container mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Hola, {firstName} 👋
            </h1>
            <p className="text-muted-foreground mt-2">
              Aquí tienes el estado de tu agencia hoy.
            </p>
          </div>
          <div className="mt-1">
            <DashboardRefresh />
          </div>
        </div>
      </div>

      {/* Acciones Rápidas - Solo para ADMIN */}
      {isAdmin && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              ⚡ Acciones Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Button asChild variant="outline" className="justify-start">
                <Link href="/admin/users">
                  <UserCog className="mr-2 h-4 w-4" />
                  Gestión de Usuarios
                </Link>
              </Button>
              <TransactionDialog />
              <Button asChild variant="outline" className="justify-start">
                <Link href="/finance/settlement">
                  <DollarSign className="mr-2 h-4 w-4" />
                  Liquidación de Socios
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link href="/clients">
                  <FileText className="mr-2 h-4 w-4" />
                  Reportes de Clientes
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumen Rápido - Grid de Tarjetas (2 o 3 según rol) */}
      <div className={`grid grid-cols-1 gap-4 mb-8 ${isEditor ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
        {/* Ingresos del Mes - Solo para ADMIN */}
        {isAdmin && (
          <Card>
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
        )}

        {/* Tareas Pendientes */}
        <Card>
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

        {/* Clientes Activos */}
        <Card>
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
      </div>

      {/* Widget: Notas de Voz Personales */}
      <div className="mb-6">
        <VoiceNotesWidget />
      </div>

      {/* Widget: Hoy en Redes */}
      <TodayScheduledTasks tasks={allTasks} />
      
      {/* Mi Billetera (Solo para ADMIN) */}
      {session?.user?.role === "ADMIN" && pendingPartnerFee > 0 && (
        <Card className="mb-6 border-purple-300 bg-purple-50/50 dark:bg-purple-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-purple-600" />
              Mi Billetera
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600">
                  {formatCurrency(pendingPartnerFee)}
                </span>
                <span className="text-sm text-muted-foreground">
                  por cobrar este mes
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Honorarios calculados según la utilidad real de la agencia
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/finance/settlement">
                  Ver Liquidación Completa
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Panel de Carga de Trabajo */}
      {filteredWorkloads.length > 0 && <WorkloadPanel workloads={filteredWorkloads} />}

      {/* Alertas de Feedback de Clientes */}
      {pendingFeedbacks.length > 0 && (
        <Card className="mb-6 border-yellow-300 bg-yellow-50/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-yellow-700" />
              <CardTitle className="text-yellow-900">
                Feedback Pendiente de Revisar
              </CardTitle>
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                {pendingFeedbacks.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingFeedbacks.map((feedback) => {
                const monthNames = [
                  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
                ];
                return (
                  <div
                    key={feedback.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-lg border border-yellow-200 bg-white"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm text-gray-900">
                          {feedback.clientName}
                        </h4>
                        {feedback.approved && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-xs">
                            Aprobado
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {monthNames[feedback.month - 1]} {feedback.year}
                      </p>
                      {feedback.comment && (
                        <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded border">
                          "{feedback.comment}"
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(feedback.createdAt), "dd/MM/yyyy 'a las' HH:mm")}
                      </p>
                    </div>
                    <Link
                      href={`/clients/${feedback.clientId}`}
                      className="text-primary hover:underline text-sm whitespace-nowrap"
                    >
                      Ver Cliente →
                    </Link>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sección Principal - Dos Columnas */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Izquierda: Tareas Prioritarias */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle>Tareas Prioritarias</CardTitle>
                <Badge variant="outline" className="text-xs">
                  {urgentTasks.length} próximos 3 días
                </Badge>
              </div>
              <Link
                href="/content"
                className="text-sm text-primary hover:underline"
              >
                Ver todas
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {urgentTasks.length > 0 ? (
              <div className="space-y-3">
                {urgentTasks.map((task) => {
                  // Calcular si la tarea vence en menos de 24 horas
                  const now = new Date();
                  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                  const hoursUntilDue = dueDate
                    ? differenceInHours(dueDate, now)
                    : Infinity;
                  const isUrgent = hoursUntilDue < 24 && hoursUntilDue >= 0;
                  
                  return (
                    <div
                      key={task.id}
                      className={`flex items-start justify-between gap-3 p-3 rounded-lg border transition-colors ${
                        isUrgent
                          ? "border-rose-500 bg-rose-50/50 hover:bg-rose-100/50 animate-pulse"
                          : "hover:bg-accent/50"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={`font-medium text-sm leading-tight ${
                            isUrgent ? "text-rose-700 font-semibold" : ""
                          }`}>
                            {task.title}
                          </h4>
                          {isUrgent && (
                            <AlertCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {task.client.name}
                          </Badge>
                          {task.dueDate && (
                            <span
                              className={`text-xs font-medium ${
                                isUrgent
                                  ? "text-rose-600 font-semibold"
                                  : getDateColor(new Date(task.dueDate))
                              }`}
                            >
                              {isToday(new Date(task.dueDate))
                                ? "Hoy"
                                : isYesterday(new Date(task.dueDate))
                                  ? "Ayer"
                                  : hoursUntilDue < 24 && hoursUntilDue >= 0
                                    ? `Mañana (${Math.round(hoursUntilDue)}h)`
                                    : format(new Date(task.dueDate), "dd/MM/yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        className={`w-1 h-full rounded-full flex-shrink-0 ${
                          isUrgent ? "bg-rose-500" : ""
                        }`}
                        style={{
                          backgroundColor: isUrgent
                            ? undefined
                            : task.client.color || "#000000",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-2">
                  No hay tareas prioritarias esta semana
                </p>
                <p className="text-xs text-muted-foreground">
                  ¡Todo al día! 🎉
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Derecha: Últimas Transacciones */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Últimas Transacciones</CardTitle>
              <Link
                href="/finance"
                className="text-sm text-primary hover:underline"
              >
                Ver todas
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentTransactions.length > 0 ? (
              <div className="space-y-3">
                {recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm leading-tight">
                        {transaction.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(transaction.date), "dd/MM/yyyy")}
                      </p>
                    </div>
                    <div
                      className={`font-semibold ${
                        transaction.type === "INCOME"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {transaction.type === "INCOME" ? "+" : "-"}
                      {formatCurrency(transaction.amount)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No hay transacciones registradas
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
