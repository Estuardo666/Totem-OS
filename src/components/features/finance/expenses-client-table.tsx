"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, ChevronDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  type SortConfig,
  nextSortDirection,
  compareStrings,
  compareNumbers,
  formatCurrency,
  getCategoryLabel,
  getStatusLabel,
} from "./sortable-utils";

interface ExpenseItem {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: Date;
  status: string;
  assignedToName?: string;
  assignedToId?: string;
  reimbursed: boolean;
  sourceType?: "EXPENSE" | "TRANSACTION";
  clientName?: string;
  clientId?: string;
}

interface ExpensesClientTableProps {
  data: Array<{
    clientName: string;
    amount: number;
  }>;
  expenses: ExpenseItem[];
}

type SortKey = "clientName" | "amount" | "count" | "avg" | "pct";

export function ExpensesClientTable({ data, expenses }: ExpensesClientTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null });
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  const total = useMemo(() => data.reduce((sum, item) => sum + item.amount, 0), [data]);

  const clientRows = useMemo(() => {
    return data.map((item) => {
      const clientExpenses = expenses.filter(
        (e) => e.clientId === item.clientName || e.clientName === item.clientName || (item.clientName === "Sin cliente" && !e.clientId && !e.clientName)
      );
      const count = clientExpenses.length;
      return {
        key: item.clientName,
        clientName: item.clientName,
        amount: item.amount,
        count,
        avg: count > 0 ? item.amount / count : 0,
        pct: total > 0 ? (item.amount / total) * 100 : 0,
      };
    });
  }, [data, expenses, total]);

  const handleHeaderClick = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      return { key, direction: nextSortDirection(prev.direction) };
    });
  };

  const sortedRows = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return clientRows;
    const dir = sortConfig.direction;
    return [...clientRows].sort((a, b) => {
      switch (sortConfig.key) {
        case "clientName":
          return compareStrings(a.clientName, b.clientName, dir);
        case "amount":
          return compareNumbers(a.amount, b.amount, dir);
        case "count":
          return compareNumbers(a.count, b.count, dir);
        case "avg":
          return compareNumbers(a.avg, b.avg, dir);
        case "pct":
          return compareNumbers(a.pct, b.pct, dir);
        default:
          return 0;
      }
    });
  }, [clientRows, sortConfig]);

  const handleRowClick = (clientKey: string) => {
    setExpandedClientId((prev) => (prev === clientKey ? null : clientKey));
  };

  const getDetailExpenses = (clientKey: string) => {
    const row = clientRows.find((r) => r.key === clientKey);
    if (!row) return [];
    if (clientKey === "Sin cliente") {
      return expenses.filter((e) => !e.clientId && !e.clientName);
    }
    return expenses.filter(
      (e) => e.clientName === clientKey || e.clientId === clientKey
    );
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key || !sortConfig.direction) {
      return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    }
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  };

  const thClass = (key: SortKey) =>
    `cursor-pointer select-none ${key !== "clientName" ? "text-right" : ""}`;

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">No hay datos para mostrar</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead className={thClass("clientName")} onClick={() => handleHeaderClick("clientName")}>
              <span className="inline-flex items-center gap-1">Cliente {renderSortIcon("clientName")}</span>
            </TableHead>
            <TableHead className={thClass("amount")} onClick={() => handleHeaderClick("amount")}>
              <span className="inline-flex items-center gap-1 justify-end w-full">Gastos {renderSortIcon("amount")}</span>
            </TableHead>
            <TableHead className={thClass("count")} onClick={() => handleHeaderClick("count")}>
              <span className="inline-flex items-center gap-1 justify-end w-full"># Mov. {renderSortIcon("count")}</span>
            </TableHead>
            <TableHead className={thClass("avg")} onClick={() => handleHeaderClick("avg")}>
              <span className="inline-flex items-center gap-1 justify-end w-full">Ticket prom. {renderSortIcon("avg")}</span>
            </TableHead>
            <TableHead className={thClass("pct")} onClick={() => handleHeaderClick("pct")}>
              <span className="inline-flex items-center gap-1 justify-end w-full">% {renderSortIcon("pct")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row) => {
            const isExpanded = expandedClientId === row.key;
            const detailExpenses = isExpanded ? getDetailExpenses(row.key) : [];
            const detailTotal = detailExpenses.reduce((s, e) => s + e.amount, 0);

            return (
              <Collapsible
                key={row.key}
                open={isExpanded}
                onOpenChange={() => handleRowClick(row.key)}
                asChild
              >
                <>
                  <CollapsibleTrigger asChild>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(row.key)}
                    >
                      <TableCell className="w-8">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{row.clientName}</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        -{formatCurrency(row.amount)}
                      </TableCell>
                      <TableCell className="text-right">{row.count}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.avg)}</TableCell>
                      <TableCell className="text-right">{row.pct.toFixed(1)}%</TableCell>
                    </TableRow>
                  </CollapsibleTrigger>
                  <CollapsibleContent asChild>
                    <tr>
                      <TableCell colSpan={6} className="p-0 bg-muted/20">
                        <div className="p-4">
                          <div className="rounded-md border bg-background">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Fecha</TableHead>
                                  <TableHead>Descripción</TableHead>
                                  <TableHead>Categoría</TableHead>
                                  <TableHead>Asignado a</TableHead>
                                  <TableHead>Estado</TableHead>
                                  <TableHead className="text-right">Monto</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {detailExpenses.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                                      Sin movimientos
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  detailExpenses.map((exp) => {
                                    const isReimbursed = exp.reimbursed || exp.status === "PAID" || exp.status === "REIMBURSED";
                                    return (
                                      <TableRow key={exp.id}>
                                        <TableCell className="text-muted-foreground">
                                          {format(new Date(exp.date), "dd/MM/yyyy")}
                                        </TableCell>
                                        <TableCell className="font-medium">{exp.description}</TableCell>
                                        <TableCell>
                                          <Badge variant="outline">{getCategoryLabel(exp.category)}</Badge>
                                        </TableCell>
                                        <TableCell>
                                          {exp.assignedToName ? (
                                            <span className="text-sm">{exp.assignedToName}</span>
                                          ) : (
                                            <span className="text-muted-foreground text-sm">-</span>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          {exp.assignedToId ? (
                                            <Badge
                                              variant={isReimbursed ? "default" : "secondary"}
                                              className={
                                                isReimbursed
                                                  ? "bg-green-500 hover:bg-green-600 text-white"
                                                  : "bg-yellow-500 hover:bg-yellow-600 text-white"
                                              }
                                            >
                                              {getStatusLabel(exp.status, exp.reimbursed)}
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-muted-foreground">
                                              Empresa
                                            </Badge>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold text-red-600">
                                          -{formatCurrency(exp.amount)}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })
                                )}
                              </TableBody>
                            </Table>
                            {detailExpenses.length > 0 && (
                              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30 text-sm">
                                <span className="text-muted-foreground">
                                  {detailExpenses.length} movimiento{detailExpenses.length !== 1 ? "s" : ""}
                                </span>
                                <span className="font-semibold text-red-600">
                                  Subtotal: -{formatCurrency(detailTotal)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </tr>
                  </CollapsibleContent>
                </>
              </Collapsible>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
