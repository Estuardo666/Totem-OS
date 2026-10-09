"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Wand2 } from "lucide-react";
import type { ClientMonthlyClosurePageData } from "@/actions/finance-actions";
import { closeMonthRecommended } from "@/actions/finance-actions";
import { useToast } from "@/components/ui/use-toast";
import { FinanceSectionNav } from "@/components/features/finance/finance-section-nav";
import { MonthYearSelector } from "@/components/features/finance/month-year-selector";
import { MonthlyCloseDialog, getClosureLabel } from "@/components/features/finance/monthly-close-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

function getClosureTone(status: "FULL" | "PARTIAL" | "NONE") {
  if (status === "FULL") return "text-emerald-600";
  if (status === "PARTIAL") return "text-amber-600";
  return "text-muted-foreground";
}

export function MonthlyClosePageClient({ data, userRole }: MonthlyClosePageClientProps) {
  const router = useRouter();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const { toast } = useToast();
  const [isClosing, startClosing] = useTransition();

  // Cierra solo los casos sin ambiguedad. Los parciales se quedan para revisar
  // a mano, porque ahi la cifra la decide el socio y no el sistema.
  const pendientesAutomaticos = data.items.filter(
    (item) => !item.closure && item.recommendation.status !== "PARTIAL"
  ).length;

  const handleCloseRecommended = () => {
    startClosing(async () => {
      const result = await closeMonthRecommended(data.period.month, data.period.year);
      if (result.success && result.data) {
        const { cerrados, omitidosParciales } = result.data;
        toast({
          title: cerrados > 0 ? `${cerrados} cliente(s) cerrados` : "No había nada que cerrar",
          description: omitidosParciales > 0
            ? `${omitidosParciales} quedan pendientes de revisar: el sistema no sabe cuánto corresponde cobrar.`
            : "Todos los casos claros del mes quedaron cerrados.",
        });
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
      }
    });
  };

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

  // Pendientes primero: es lo único que requiere acción
  const sortedItems = useMemo(
    () => [...data.items].sort((a, b) => Number(Boolean(a.closure)) - Number(Boolean(b.closure))),
    [data.items]
  );
  const doneCount = stats.totalClients - stats.pending;

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

        <Card>
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">
                Decide cuánto se le cobra a cada cliente por {data.period.label}. Hasta cerrar, los ingresos del mes son provisionales.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-2 max-w-xs flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${stats.totalClients ? (doneCount / stats.totalClients) * 100 : 0}%` }} />
                </div>
                <span className="text-sm font-medium">{doneCount} de {stats.totalClients} listos</span>
                <span className="text-sm text-muted-foreground">· {formatCurrency(stats.totalAccrued)} confirmado</span>
              </div>
            </div>
            <Button onClick={handleCloseRecommended} disabled={isClosing || pendientesAutomaticos === 0} className="shrink-0">
              {isClosing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Aceptar sugerencias{pendientesAutomaticos > 0 ? ` (${pendientesAutomaticos})` : ""}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Cliente</TableHead>
                    <TableHead>Entregado</TableHead>
                    <TableHead>Sugerencia</TableHead>
                    <TableHead>Decisión</TableHead>
                    <TableHead className="text-right">Ya pagó</TableHead>
                    <TableHead className="pr-5 text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedItems.map((item) => {
                    const reels = item.evidence.publishedReels + item.evidence.approvedReels;
                    const flyers = item.evidence.publishedFlyers + item.evidence.approvedFlyers;
                    return (
                      <TableRow key={item.clientId}>
                        <TableCell className="pl-5">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 border">
                              <AvatarImage src={item.clientLogo ?? undefined} alt={item.clientName} />
                              <AvatarFallback className="text-xs">{getInitials(item.clientName)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{item.clientName}</p>
                              <p className="text-xs text-muted-foreground">Plan {formatCurrency(item.monthlyRate)}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          Reels {reels}/{item.monthlyReels} · Diseños {flyers}/{item.monthlyFlyers}
                          {item.evidence.completedShoots > 0 ? ` · ${item.evidence.completedShoots} rodaje(s)` : ""}
                        </TableCell>
                        <TableCell className="text-sm" title={item.recommendation.reason}>
                          {getClosureLabel(item.recommendation.status)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.closure ? (
                            <span className={`inline-flex items-center gap-1.5 font-medium ${getClosureTone(item.closure.accrualStatus)}`}>
                              <CheckCircle2 className="h-4 w-4" />
                              {getClosureLabel(item.closure.accrualStatus)}
                              {item.closure.accrualStatus === "PARTIAL" ? ` · ${formatCurrency(item.closure.accruedAmount)}` : ""}
                            </span>
                          ) : (
                            <span className="text-amber-600">Pendiente</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{formatCurrency(item.paidThisMonth)}</TableCell>
                        <TableCell className="pr-5 text-right">
                          <Button size="sm" variant={item.closure ? "ghost" : "outline"} onClick={() => setSelectedClientId(item.clientId)}>
                            {item.closure ? "Cambiar" : "Decidir"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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