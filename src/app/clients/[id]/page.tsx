import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getClientById, getClientProfitability } from "@/actions/client-actions";
import { getUsers } from "@/actions/user.actions";
import { getClientGlobalMetrics, getClientRecentTasksWithMetrics, getClientFacebookMetrics } from "@/actions/metrics-actions";
import { ClientHeader } from "@/components/features/clients/client-header";
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
import { ClientStrategyForm } from "@/components/features/clients/client-strategy-form";
import { AiOverviewCard } from "@/components/features/metrics/ai-overview-card";
import { KanbanBoard } from "@/components/features/content/kanban-board";
import { SyncMetricsButton } from "@/components/features/metrics/sync-metrics-button";
import { MetricsOverview } from "@/components/features/metrics/metrics-overview";
import { MetricsChart } from "@/components/features/metrics/metrics-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import { calculateMonthlyEngagement, calculateMonthlyEfficiency, formatCurrency } from "@/lib/metrics-calculations";
import { TrendingUp, Brain } from "lucide-react";

interface ClientDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({
  params,
}: ClientDetailPageProps) {
  const { id } = await params;
  const session = await auth();
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

  // Calcular eficiencia mensual
  const monthlyEngagement = calculateMonthlyEngagement(
    client.tasks.map((task) => ({
      metrics: task.metrics,
      publishedAt: task.publishedAt,
    }))
  );
  const monthlyEfficiency = calculateMonthlyEfficiency(monthlyEngagement, client.monthlyRate);

  // Convertir las tareas del cliente al formato esperado por KanbanBoard
  const tasksForKanban: ContentTaskWithClient[] = client.tasks.map((task) => ({
    ...task,
    client: {
      id: client.id,
      name: client.name,
      status: client.status,
      color: client.color,
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
  }));

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
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <ClientHeader client={client} users={users} />
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="summary">Resumen</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="metrics">Métricas & Rendimiento</TabsTrigger>
          <TabsTrigger value="strategy">Estrategia de Marca</TabsTrigger>
          <TabsTrigger value="brand-kit">Brand Kit</TabsTrigger>
          <TabsTrigger value="vault">Bóveda</TabsTrigger>
          <TabsTrigger value="account">Estado de Cuenta</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="mt-6 space-y-6">
          {globalMetricsResult.success && globalMetricsResult.data && recentTasksResult.success && recentTasksResult.data ? (
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
                <MetaPanel tasks={recentTasksResult.data} />
                <TikTokPanel tasks={recentTasksResult.data} />
              </div>
              <RevenueROIPanel
                tasks={recentTasksResult.data}
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
              <CardContent className="py-12">
                <p className="text-muted-foreground text-center">
                  {globalMetricsResult.error || "Cargando métricas de performance..."}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="summary" className="mt-6 space-y-6">
          <ContractFulfillment
            clientId={client.id}
            monthlyReels={client.monthlyReels}
            monthlyFlyers={client.monthlyFlyers}
          />
          
          {profitabilityResult.success && profitabilityResult.data && (
            <ClientProfitability
              income={profitabilityResult.data.income}
              expenses={profitabilityResult.data.expenses}
            />
          )}

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
            />
          )}
        </TabsContent>

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

        <TabsContent value="account" className="mt-6">
          <AccountStatus clientId={client.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

