"use client";

import { useMemo } from "react";
import { CalendarClock, CheckCircle2, Clock3, KanbanSquare, Video } from "lucide-react";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { KanbanBoard } from "./kanban-board";
import { ContentStrategyCard } from "./content-strategy-card";
import type { ContentFactoryShoot } from "./content-accounts-utils";
import {
  buildContentAccountSummary,
  formatAccountDate,
  getMonthOptions,
  type ContentMonthlyStrategyRecord,
} from "./content-accounts-utils";
import type { Client, User } from "@prisma/client";

interface ContentAccountsViewProps {
  tasks: ContentTaskWithClient[];
  clients: Client[];
  users: User[];
  shootings: ContentFactoryShoot[];
  strategies: ContentMonthlyStrategyRecord[];
  selectedClientId: string;
  selectedMonth: string;
  onClientChange: (clientId: string) => void;
  onMonthChange: (month: string) => void;
  onStrategySaved: (strategy: ContentMonthlyStrategyRecord) => void;
}

function EmptyList({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

function getClientInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "CL";
}

function DeliverableList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: ContentTaskWithClient[];
  emptyText: string;
}) {
  return (
    <Card className="rounded-3xl border-border/70">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? <EmptyList text={emptyText} /> : null}
        {items.map((task) => {
          const displayDate = task.status === "PUBLISHED" ? task.publishedAt : task.scheduledAt ?? task.dueDate ?? task.updatedAt;
          const previewLabel = task.coverImageUrl ? "Preview listo" : task.reviewToken ? "Preview interno" : "Sin preview";

          return (
            <div key={task.id} className="rounded-2xl border border-border/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{task.title}</p>
                  <p className="text-xs text-muted-foreground">{task.type} · {formatAccountDate(displayDate ? new Date(displayDate) : null)}</p>
                </div>
                <Badge variant="secondary" className="rounded-full text-[11px]">
                  {task.status}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{previewLabel}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function ContentAccountsView({
  tasks,
  clients,
  users,
  shootings,
  strategies,
  selectedClientId,
  selectedMonth,
  onClientChange,
  onMonthChange,
  onStrategySaved,
}: ContentAccountsViewProps) {
  const monthOptions = useMemo(() => getMonthOptions(tasks), [tasks]);
  const activeClients = useMemo(
    () => clients.filter((client) => client.status !== "INACTIVE").sort((a, b) => a.name.localeCompare(b.name, "es")),
    [clients]
  );
  const selectedClient = activeClients.find((client) => client.id === selectedClientId) ?? null;
  const selectedStrategyRecord = useMemo(() => {
    if (!selectedClient) {
      return null;
    }

    const [year, month] = selectedMonth.split("-").map(Number);
    return (
      strategies.find(
        (strategy) =>
          strategy.clientId === selectedClient.id &&
          strategy.year === year &&
          strategy.month === month
      ) ?? null
    );
  }, [selectedClient, selectedMonth, strategies]);

  const summary = useMemo(() => {
    if (!selectedClient) return null;

    const clientTasks = tasks.filter((task) => task.clientId === selectedClient.id);
    return buildContentAccountSummary({
      client: selectedClient,
      tasks: clientTasks,
      shootings,
      selectedMonth,
      strategyRecord: selectedStrategyRecord,
    });
  }, [selectedClient, selectedMonth, selectedStrategyRecord, shootings, tasks]);

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border-border/70">
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1fr_220px]">
          <Select value={selectedClientId} onValueChange={onClientChange}>
            <SelectTrigger className="h-11 rounded-full">
              {selectedClient ? (
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-6 w-6 border border-border/70">
                    {selectedClient.logo ? <AvatarImage src={selectedClient.logo} alt={selectedClient.name} /> : null}
                    <AvatarFallback className="text-[10px] font-semibold">{getClientInitials(selectedClient.name)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm">{selectedClient.name}</span>
                </div>
              ) : (
                <SelectValue placeholder="Selecciona cliente" />
              )}
            </SelectTrigger>
            <SelectContent>
              {activeClients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-5 w-5 border border-border/70">
                      {client.logo ? <AvatarImage src={client.logo} alt={client.name} /> : null}
                      <AvatarFallback className="text-[9px] font-semibold">{getClientInitials(client.name)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{client.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedMonth} onValueChange={onMonthChange}>
            <SelectTrigger className="h-11 rounded-full">
              <SelectValue placeholder="Selecciona mes" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((month) => (
                <SelectItem key={month} value={month}>{month}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {!summary ? (
        <Card className="rounded-3xl border-border/70">
          <CardContent className="py-12 text-center text-muted-foreground">
            Selecciona un cliente para ver su cuenta mensual.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="rounded-3xl border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-4 w-4" />
                  Entregables del mes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 lg:grid-cols-3">
                  <DeliverableList title="Publicados" items={summary.deliverables.published} emptyText="Sin publicaciones en este mes." />
                  <DeliverableList title="No publicados" items={summary.deliverables.unpublished} emptyText="Sin piezas pausadas, canceladas o rechazadas." />
                  <DeliverableList title="Pendientes" items={summary.deliverables.pending} emptyText="No hay piezas activas en pipeline." />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <ContentStrategyCard
                clientId={summary.client.id}
                selectedMonth={selectedMonth}
                strategyRecord={selectedStrategyRecord}
                onSaved={onStrategySaved}
              />

              <Card className="rounded-3xl border-border/70">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock3 className="h-4 w-4" />
                    Salud del mes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl border border-border/60 px-3 py-3">
                    <span className="text-sm font-medium">Semáforo</span>
                    <Badge
                      variant="secondary"
                      className={summary.health.status === "GREEN" ? "rounded-full bg-emerald-100 text-emerald-700" : summary.health.status === "YELLOW" ? "rounded-full bg-amber-100 text-amber-700" : "rounded-full bg-rose-100 text-rose-700"}
                    >
                      {summary.health.status === "GREEN" ? "En ritmo" : summary.health.status === "YELLOW" ? "Con leve rezago" : "Con rezago"}
                    </Badge>
                  </div>
                  <div className="rounded-2xl border border-border/60 px-3 py-3">
                    <p className="text-sm font-medium">{summary.health.detail}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Avance contractual visible al corte del mes.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-border/70">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarClock className="h-4 w-4" />
                    Qué sigue
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-2xl border border-border/60 px-3 py-3">
                    <p className="font-medium">{summary.nextMilestoneLabel}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {summary.nextShoot ? `Rodaje ${formatAccountDate(new Date(summary.nextShoot.startTime))}` : summary.nextDelivery ? `Entrega ${formatAccountDate(summary.nextDelivery.scheduledAt ? new Date(summary.nextDelivery.scheduledAt) : summary.nextDelivery.dueDate ? new Date(summary.nextDelivery.dueDate) : null)}` : "Sin fechas cargadas todavía."}
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 px-3 py-3">
                      <p className="mb-1 flex items-center gap-2 font-medium"><Video className="h-4 w-4" /> Próximo rodaje</p>
                      <p className="text-xs text-muted-foreground">{summary.nextShoot ? `${summary.nextShoot.title} · ${formatAccountDate(new Date(summary.nextShoot.startTime))}` : "Sin rodajes programados"}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 px-3 py-3">
                      <p className="mb-1 flex items-center gap-2 font-medium"><CalendarClock className="h-4 w-4" /> Próxima entrega</p>
                      <p className="text-xs text-muted-foreground">{summary.nextDelivery ? `${summary.nextDelivery.title} · ${summary.nextDelivery.status}` : "Sin entregas pendientes"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="rounded-3xl border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <KanbanSquare className="h-4 w-4" />
                Kanban de {summary.client.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <KanbanBoard
                tasks={summary.kanbanTasks}
                users={users}
                clients={[{ id: summary.client.id, name: summary.client.name, logo: summary.client.logo, color: summary.client.color }]}
                clientId={summary.client.id}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}