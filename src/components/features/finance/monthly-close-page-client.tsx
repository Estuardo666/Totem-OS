"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, FileWarning, PencilLine } from "lucide-react";
import type { ClientMonthlyClosurePageData } from "@/actions/finance-actions";
import { FinanceSectionNav } from "@/components/features/finance/finance-section-nav";
import { MonthYearSelector } from "@/components/features/finance/month-year-selector";
import { MonthlyCloseDialog } from "@/components/features/finance/monthly-close-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface MonthlyClosePageClientProps {
  data: ClientMonthlyClosurePageData;
  userRole?: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getClosureBadge(status: "FULL" | "PARTIAL" | "NONE") {
  if (status === "FULL") {
    return <Badge className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Devengado total</Badge>;
  }
  if (status === "PARTIAL") {
    return <Badge className="rounded-full bg-amber-100 text-amber-700 hover:bg-amber-100">Devengado parcial</Badge>;
  }
  return <Badge className="rounded-full bg-slate-200 text-slate-700 hover:bg-slate-200">No devengado</Badge>;
}

function getRecommendationBadge(status: "FULL" | "PARTIAL" | "NONE") {
  if (status === "FULL") {
    return <Badge variant="outline" className="rounded-full border-emerald-300 text-emerald-700">Sugerido total</Badge>;
  }
  if (status === "PARTIAL") {
    return <Badge variant="outline" className="rounded-full border-amber-300 text-amber-700">Revisar parcial</Badge>;
  }
  return <Badge variant="outline" className="rounded-full border-slate-300 text-slate-700">Sugerido no devengar</Badge>;
}

export function MonthlyClosePageClient({ data, userRole }: MonthlyClosePageClientProps) {
  const router = useRouter();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const selectedItem = data.items.find((item) => item.clientId === selectedClientId) ?? null;

  const stats = useMemo(() => {
    const closed = data.items.filter((item) => item.closure);
    const full = closed.filter((item) => item.closure?.accrualStatus === "FULL").length;
    const partial = closed.filter((item) => item.closure?.accrualStatus === "PARTIAL").length;
    const none = closed.filter((item) => item.closure?.accrualStatus === "NONE").length;
    const totalAccrued = closed.reduce((sum, item) => sum + (item.closure?.accruedAmount ?? 0), 0);

    return {
      totalClients: data.items.length,
      pending: data.items.length - closed.length,
      full,
      partial,
      none,
      totalAccrued,
    };
  }, [data.items]);

  const handleMonthChange = (month: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("month", month.toString());
    params.set("year", data.period.year.toString());
    router.push(`/finance/monthly-close?${params.toString()}`);
  };

  const handleYearChange = (year: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("month", data.period.month.toString());
    params.set("year", year.toString());
    router.push(`/finance/monthly-close?${params.toString()}`);
  };

  return (
    <>
      <div className="space-y-8">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <FinanceSectionNav userRole={userRole} />
            <MonthYearSelector
              month={data.period.month}
              year={data.period.year}
              onMonthChange={handleMonthChange}
              onYearChange={handleYearChange}
            />
          </div>

          <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-white shadow-sm">
            <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.4fr_1fr] lg:items-end">
              <div className="space-y-3">
                <Badge className="w-fit rounded-full bg-white/10 text-white hover:bg-white/10">
                  Cierre contable de {data.period.label}
                </Badge>
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold tracking-tight">Cierra el mes cliente por cliente antes de leer ingresos y cartera.</h2>
                  <p className="max-w-2xl text-sm leading-relaxed text-white/80">
                    Esta vista obliga a decidir si el fee del mes se devenga, se devenga parcialmente o no se reconoce.
                    El sistema sugiere una postura usando publicaciones, aprobaciones, rodajes y horas registradas.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">Pendientes</p>
                  <p className="mt-2 text-2xl font-semibold">{stats.pending}</p>
                  <p className="mt-1 text-xs text-white/70">Clientes sin cierre confirmado</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">Devengado cerrado</p>
                  <p className="mt-2 text-2xl font-semibold">{formatCurrency(stats.totalAccrued)}</p>
                  <p className="mt-1 text-xs text-white/70">Monto confirmado del período</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-border/60 shadow-sm">
            <CardContent className="flex items-center gap-3 p-5">
              <Clock3 className="h-5 w-5 text-slate-500" />
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pendiente</p>
                <p className="text-2xl font-semibold">{stats.pending}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardContent className="flex items-center gap-3 p-5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total</p>
                <p className="text-2xl font-semibold">{stats.full}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardContent className="flex items-center gap-3 p-5">
              <FileWarning className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Parcial</p>
                <p className="text-2xl font-semibold">{stats.partial}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardContent className="flex items-center gap-3 p-5">
              <FileWarning className="h-5 w-5 text-slate-600" />
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">No devengado</p>
                <p className="text-2xl font-semibold">{stats.none}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Cierre mensual por cliente</CardTitle>
            <p className="text-sm text-muted-foreground">
              El cierre define si el fee del período entra al resultado del mes. Sin cierre, el sistema conserva la lógica histórica.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Evidencia del mes</TableHead>
                    <TableHead>Sugerencia</TableHead>
                    <TableHead>Cierre aplicado</TableHead>
                    <TableHead>Cobrado</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => (
                    <TableRow key={item.clientId}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border">
                            <AvatarImage src={item.clientLogo ?? undefined} alt={item.clientName} />
                            <AvatarFallback>{getInitials(item.clientName)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">{item.clientName}</p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>{formatCurrency(item.monthlyRate)}</span>
                              <span>Dia {item.paymentDay ?? "-"}</span>
                              <span>{item.clientStatus}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p>{item.evidence.publishedTasks} publicadas · {item.evidence.approvedTasks} aprobadas</p>
                          <p>{item.evidence.completedShoots} rodajes · {item.evidence.trackedHours.toFixed(2)} horas</p>
                          <p>Reels {item.evidence.publishedReels + item.evidence.approvedReels}/{item.monthlyReels} · Flyers {item.evidence.publishedFlyers + item.evidence.approvedFlyers}/{item.monthlyFlyers}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          {getRecommendationBadge(item.recommendation.status)}
                          <p className="max-w-sm text-sm text-muted-foreground">{item.recommendation.reason}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.closure ? (
                          <div className="space-y-2">
                            {getClosureBadge(item.closure.accrualStatus)}
                            <p className="text-sm font-medium">{formatCurrency(item.closure.accruedAmount)}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.closure.approvedByName ? `Por ${item.closure.approvedByName}` : "Sin aprobador"}
                            </p>
                          </div>
                        ) : (
                          <Badge variant="outline" className="rounded-full">Sin cierre</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{formatCurrency(item.paidThisMonth)}</p>
                          <p className="text-xs text-muted-foreground">Caja del período</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" className="rounded-full" onClick={() => setSelectedClientId(item.clientId)}>
                          <PencilLine className="mr-2 h-4 w-4" />
                          {item.closure ? "Editar" : "Cerrar"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <MonthlyCloseDialog
        open={Boolean(selectedItem)}
        onOpenChange={(open) => {
          if (!open) setSelectedClientId(null);
        }}
        item={selectedItem}
        year={data.period.year}
        month={data.period.month}
      />
    </>
  );
}