import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import {
  getClientBillingExceptions,
  getClientById,
  getClientProfitability,
} from "@/actions/client-actions";
import { getUsers } from "@/actions/user.actions";
import { getClientGlobalMetrics, getClientRecentTasksWithMetrics, getClientFacebookMetrics } from "@/actions/metrics-actions";
import { ClientHeader } from "@/components/features/clients/client-header";
import { ClientDeleteButton } from "@/components/features/clients/client-delete-button";
import { VaultList } from "@/components/features/clients/vault-list";
import { BrandKit } from "@/components/features/clients/brand-kit";
import { ContractFulfillment } from "@/components/features/clients/contract-fulfillment";
import { AccountStatus } from "@/components/features/clients/account-status";
import { ClientProfitability } from "@/components/features/clients/client-profitability";
import { MetaPanel } from "@/components/features/clients/meta-panel";
import { TikTokPanel } from "@/components/features/clients/tiktok-panel";
import { StrategyCorePanel } from "@/components/features/clients/strategy-core-panel";
import { RevenueROIPanel } from "@/components/features/clients/revenue-roi-panel";
import { MetricsBulkEditor } from "@/components/features/clients/metrics-bulk-editor";
import { MonthlyBillingExceptionCard } from "@/components/features/clients/monthly-billing-exception-card";
import { ClientStrategyForm } from "@/components/features/clients/client-strategy-form";
import { AiOverviewCard } from "@/components/features/metrics/ai-overview-card";
import { KanbanBoard } from "@/components/features/content/kanban-board";
import { SyncMetricsButton } from "@/components/features/metrics/sync-metrics-button";
import { MetricsOverview } from "@/components/features/metrics/metrics-overview";
import { MetricsChart } from "@/components/features/metrics/metrics-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import type { TaskMetrics } from "@prisma/client";
import { calculateMonthlyEngagement, calculateMonthlyEfficiency, formatCurrency } from "@/lib/metrics-calculations";
import { TrendingUp, Brain, BarChart3, ArrowLeft, Receipt } from "lucide-react";
import { ClientBillingForm } from "@/components/features/facturacion/ClientBillingForm";

interface TaskWithMetrics {
  id: string;
  title: string;
  type: string;
  publishedAt: Date | null;
  metrics: {
    metaViews: number;
    metaReach: number;
    metaLikes: number;
    metaComments: number;
    metaShares: number;
    metaSaves: number;
    erMeta: number;
    ttViews: number;
    ttLikes: number;
    ttComments: number;
    ttShares: number;
    ttSaves: number;
    erTikTok: number;
    totalBrandAwareness: number;
    globalSocialProof: number;
    viralityIndex: number;
    efficiencyScore: number;
    revenue: number;
    conversions: number;
    salesCount: number;
    conversionRate: number;
    cpa: number;
    roas: number;
  } | null;
}

interface ClientDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({
  params,
}: ClientDetailPageProps) {
  const { id } = await params;
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const canEditClient = isAdmin || (session?.user?.role === "EDITOR" && session?.user?.specialty === "COMMUNITY");

  // Check if user is authenticated
  if (!session?.user?.id) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center py-12 rounded-xl border bg-card">
            <h2 className="text-2xl font-bold mb-4">Acceso Restringido</h2>
            <p className="text-muted-foreground text-center mb-6">
              Inicia sesión para ver la información de los clientes.
            </p>
            <Button asChild>
              <Link href="/clients">
                Ver Dashboard General
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  const [result, usersResult, profitabilityResult, globalMetricsResult, recentTasksResult, facebookMetricsResult] = await Promise.all([
    getClientById(id),
    getUsers(),
    getClientProfitability(id),
    getClientGlobalMetrics(id),
    getClientRecentTasksWithMetrics(id, 10),
    getClientFacebookMetrics(id, 30),
  ]);

  // Si no se encuentra el cliente, mostrar 404
  if (!result.success || !result.data) {
    notFound();
  }

  const client = result.data;
  const hasRecurringMonthlyFee = client.monthlyRate > 0 && Boolean(client.paymentDay);
  const billingExceptionsResult = isAdmin && hasRecurringMonthlyFee
    ? await getClientBillingExceptions(id)
    : { success: true as const, data: [] };
  const billingExceptions = billingExceptionsResult.success
    ? billingExceptionsResult.data ?? []
    : [];

  // Convertir recentTasksResult.data al tipo TaskWithMetrics[]
  const recentTasks: TaskWithMetrics[] = recentTasksResult.success && recentTasksResult.data 
    ? recentTasksResult.data as TaskWithMetrics[] 
    : [];

  // Calcular eficiencia mensual
  const monthlyEngagement = calculateMonthlyEngagement(
    client.tasks.map((task) => ({
      metrics: task.metrics,
      publishedAt: task.publishedAt,
    }))
  );
  const monthlyEfficiency = calculateMonthlyEfficiency(monthlyEngagement, client.monthlyRate);

  // Convertir las tareas del cliente al formato esperado por KanbanBoard
  const tasksForKanban = client.tasks.map((task) => ({
    ...task,
    client: {
      id: client.id,
      name: client.name,
      logo: client.logo,
      status: client.status,
      color: client.color,
      editorId: client.editorId,
      communityId: client.communityId,
      brandDNA: client.brandDNA, // ✅ Campo crítico para IA - agregado
      brandKit: client.brandKit,
      vault: client.vault,
      planConfig: client.planConfig,
      monthlyRate: client.monthlyRate,
      lastPostDate: client.lastPostDate,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
      brandAssets: client.brandAssets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        url: asset.url,
        fileType: asset.fileType,
      })),
    },
    assignedEditor: null,
    assignedCommunity: null,
  })) as (ContentTaskWithClient & { metrics: TaskMetrics | null })[];

  const users = usersResult.success ? usersResult.data ?? [] : [];

  // Parsear brandDNA del cliente
  let brandDNA: {
    businessDescription?: string;
    toneOfVoice?: string;
    audience?: string;
    values?: string;
    prohibitedTopics?: string;
  } = {};

  if (client.brandDNA) {
    try {
      brandDNA = JSON.parse(client.brandDNA);
    } catch (error) {
      console.error("Error al parsear brandDNA:", error);
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header iOS-style con navegación */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b">
        <div className="max-w-6xl mx-auto px-4">
          {/* Breadcrumb simple */}
          <div className="flex items-center gap-2 py-2 text-sm">
            <Link 
              href="/clients" 
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Clientes</span>
            </Link>
            <span className="text-muted-foreground/50">/</span>
            <span className="font-medium truncate">{client.name}</span>
            {isAdmin && (
              <div className="ml-auto">
                <ClientDeleteButton clientId={client.id} clientName={client.name} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Client Header */}
        <ClientHeader client={client} users={users} isAdmin={isAdmin} canEditClient={canEditClient} />

        {/* Tabs Navigation iOS-style */}
        <Tabs defaultValue="summary" className="w-full">
          <div className="sticky top-[52px] z-30 -mx-4 px-4 bg-muted/30 backdrop-blur-sm py-2">
            <TabsList className="inline-flex w-full items-center justify-start gap-1 overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-hide h-11 rounded-xl bg-card border p-1">
              <TabsTrigger 
                value="summary" 
                className="flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
              >
                Resumen
              </TabsTrigger>
              <TabsTrigger 
                value="brand-kit" 
                className="flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
              >
                Brand Kit
              </TabsTrigger>
              <TabsTrigger 
                value="vault" 
                className="flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
              >
                Bóveda
              </TabsTrigger>
              <TabsTrigger 
                value="strategy" 
                className="flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
              >
                Estrategia de Marca
              </TabsTrigger>
              {isAdmin && (
                <>
                  <TabsTrigger 
                    value="performance" 
                    className="flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                  >
                    Performance
                  </TabsTrigger>
                  <TabsTrigger 
                    value="metrics" 
                    className="flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                  >
                    Métricas & Rendimiento
                  </TabsTrigger>
                  <TabsTrigger 
                    value="account" 
                    className="flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                  >
                    Estado de Cuenta
                  </TabsTrigger>
                  <TabsTrigger 
                    value="billing" 
                    className="flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                  >
                    <Receipt className="h-3.5 w-3.5 mr-1.5" />
                    Facturación
                  </TabsTrigger>
                </>
              )}
            </TabsList>
          </div>

          <TabsContent value="summary" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ContractFulfillment
                clientId={client.id}
                monthlyReels={client.monthlyReels}
                monthlyFlyers={client.monthlyFlyers}
              />
              
              {isAdmin && profitabilityResult.success && profitabilityResult.data && (
                <ClientProfitability
                  income={profitabilityResult.data.income}
                  expenses={profitabilityResult.data.expenses}
                />
              )}
            </div>

            {/* Eficiencia Mensual */}
            {monthlyEngagement > 0 && client.monthlyRate > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Eficiencia Mensual
                    <Brain className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-3xl font-bold">
                        {formatCurrency(monthlyEfficiency)}
                      </p>
                      <CardDescription className="text-sm text-muted-foreground mt-2">
                        Cada interacción con un cliente potencial le costó{" "}
                        {formatCurrency(monthlyEfficiency)} este mes
                      </CardDescription>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>Engagement Total del Mes: {monthlyEngagement.toLocaleString()} interacciones</p>
                      <p>Inversión Mensual: {formatCurrency(client.monthlyRate)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {tasksForKanban.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-muted-foreground text-center text-lg">
                    No hay tareas para este cliente
                  </p>
                  <p className="text-muted-foreground mt-2 text-center text-sm">
                    Las tareas de contenido aparecerán aquí
                  </p>
                </CardContent>
              </Card>
            ) : (
              <KanbanBoard
                tasks={tasksForKanban}
                users={usersResult.success ? usersResult.data ?? [] : []}
                clientId={client.id}
              />
            )}
          </TabsContent>

          {isAdmin && (
            <TabsContent value="performance" className="mt-6 space-y-6">
              {globalMetricsResult.success && globalMetricsResult.data && recentTasks.length > 0 ? (
                <>
                  {/* IA Performance Overview */}
                  <AiOverviewCard
                    clientId={client.id}
                    initialOverview={client.lastAiOverview}
                    initialOverviewDate={client.lastAiOverviewDate}
                    userRole={session?.user?.role as "ADMIN" | "EDITOR" | "VIEWER" | undefined}
                  />

                  {/* Resumen Ejecutivo */}
                  {globalMetricsResult.data.businessMetrics.totalRevenue > 0 && (
                    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
                      <CardContent className="pt-6">
                        <p className="text-lg font-semibold text-center">
                          Este mes, el contenido de Totem generó{" "}
                          <span className="text-green-600 dark:text-green-400 font-bold">
                            {formatCurrency(globalMetricsResult.data.businessMetrics.totalRevenue)}
                          </span>{" "}
                          en ventas directas para tu marca con una tasa de conversión del{" "}
                          <span className="text-green-600 dark:text-green-400 font-bold">
                            {globalMetricsResult.data.businessMetrics.averageConversionRate.toFixed(2)}%
                          </span>
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  <StrategyCorePanel
                    totalImpressions={globalMetricsResult.data.totalImpressions}
                    totalCommunityGrowth={globalMetricsResult.data.totalCommunityGrowth}
                    globalVirality={globalMetricsResult.data.globalVirality}
                    crossPlatformEfficiency={globalMetricsResult.data.crossPlatformEfficiency}
                    metaMetrics={globalMetricsResult.data.metaMetrics}
                    tiktokMetrics={globalMetricsResult.data.tiktokMetrics}
                  />
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <MetaPanel tasks={recentTasks} />
                    <TikTokPanel tasks={recentTasks} />
                  </div>
                  <RevenueROIPanel
                    tasks={recentTasks}
                    totalRevenue={globalMetricsResult.data.businessMetrics.totalRevenue}
                    totalConversions={globalMetricsResult.data.businessMetrics.totalConversions}
                    totalSales={globalMetricsResult.data.businessMetrics.totalSales}
                    averageConversionRate={globalMetricsResult.data.businessMetrics.averageConversionRate}
                    averageCPA={globalMetricsResult.data.businessMetrics.averageCPA}
                    averageROAS={globalMetricsResult.data.businessMetrics.averageROAS}
                  />
                  <MetricsBulkEditor clientId={client.id} />
                </>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
                    <BarChart3 className="h-16 w-16 text-muted-foreground/30" />
                    <div className="text-center space-y-2">
                      <h3 className="font-semibold text-lg">Sin datos de performance</h3>
                      <p className="text-sm text-muted-foreground">
                        Aún no hay tareas publicadas o métricas sincronizadas para este cliente.
                      </p>
                    </div>
                    <SyncMetricsButton clientId={client.id} />
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="metrics" className="mt-6 space-y-6">
              {facebookMetricsResult.success && facebookMetricsResult.data ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold">Métricas de Facebook</h2>
                      <p className="text-sm text-muted-foreground">
                        Datos sincronizados desde la API de Meta
                      </p>
                    </div>
                    <SyncMetricsButton clientId={client.id} />
                  </div>

                  <MetricsOverview
                    impressions={facebookMetricsResult.data.overview.impressions}
                    engagements={facebookMetricsResult.data.overview.engagements}
                    fans={facebookMetricsResult.data.overview.fans}
                  />

                  <MetricsChart data={facebookMetricsResult.data.chartData} />
                </>
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <p className="text-muted-foreground text-center">
                        {facebookMetricsResult.error || "No hay métricas disponibles"}
                      </p>
                      <SyncMetricsButton clientId={client.id} />
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

          <TabsContent value="strategy" className="mt-6">
            <ClientStrategyForm
              clientId={client.id}
              initialData={brandDNA}
            />
          </TabsContent>

          <TabsContent value="brand-kit" className="mt-6">
            <BrandKit assets={client.brandAssets} clientId={client.id} />
          </TabsContent>

          <TabsContent value="vault" className="mt-6">
            <VaultList credentials={client.credentials} clientId={client.id} />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="account" className="mt-6 space-y-6">
              {hasRecurringMonthlyFee ? (
                <MonthlyBillingExceptionCard
                  clientId={client.id}
                  monthlyRate={client.monthlyRate}
                  exceptions={billingExceptions}
                />
              ) : null}
              <AccountStatus clientId={client.id} />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="billing" className="mt-6">
              <ClientBillingForm client={client} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

