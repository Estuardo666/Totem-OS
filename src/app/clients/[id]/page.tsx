import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getClientById, getClientProfitability } from "@/actions/client-actions";
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
import { TrendingUp, Brain, BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/shared";

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
      <div className="container mx-auto px-2 md:px-3">
        <PageHeader 
          title="Cliente"
          breadcrumbs={[
            { label: "Inicio", href: "/" },
            { label: "Clientes", href: "/clients" },
            { label: "Cliente" }
          ]}
        />
        <div className="flex flex-col items-center justify-center py-12">
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
    <div className="container mx-auto px-2 md:px-3">
      <PageHeader 
        breadcrumbs={[
          { label: "Inicio", href: "/" },
          { label: "Clientes", href: "/clients" },
          { label: client.name }
        ]}
        actions={isAdmin ? <ClientDeleteButton clientId={client.id} clientName={client.name} /> : undefined}
      />
      <div className="mb-6">
        <ClientHeader client={client} users={users} isAdmin={isAdmin} canEditClient={canEditClient} />
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <div className="sticky top-[64px] z-30 w-full bg-background/95 backdrop-blur py-2 border-b border-border/50">
          <TabsList className="inline-flex w-full items-center justify-start overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-hide px-1 h-12 items-center rounded-full bg-muted px-3 py-1 text-muted-foreground">
            <TabsTrigger value="summary" className="flex-shrink-0 rounded-full">Resumen</TabsTrigger>
            <TabsTrigger value="brand-kit" className="flex-shrink-0 rounded-full">Brand Kit</TabsTrigger>
            <TabsTrigger value="vault" className="flex-shrink-0 rounded-full">Bóveda</TabsTrigger>
            <TabsTrigger value="strategy" className="flex-shrink-0 rounded-full">Estrategia de Marca</TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="performance" className="flex-shrink-0 rounded-full">Performance</TabsTrigger>
                <TabsTrigger value="metrics" className="flex-shrink-0 rounded-full">Métricas & Rendimiento</TabsTrigger>
                <TabsTrigger value="account" className="flex-shrink-0 rounded-full">Estado de Cuenta</TabsTrigger>
              </>
            )}
          </TabsList>
        </div>

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
            />
          )}
        </TabsContent>

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
          <TabsContent value="account" className="mt-6">
            <AccountStatus clientId={client.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

