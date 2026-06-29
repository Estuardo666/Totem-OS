"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import {
  type SortConfig,
  nextSortDirection,
  compareStrings,
  compareNumbers,
  formatCurrency,
  getCategoryLabel,
} from "./sortable-utils";

interface ExpensesCategoryTableProps {
  data: Array<{
    category: string;
    amount: number;
  }>;
}

type SortKey = "category" | "amount" | "pct";

export function ExpensesCategoryTable({ data }: ExpensesCategoryTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null });

  const total = useMemo(() => data.reduce((sum, item) => sum + item.amount, 0), [data]);

  const handleHeaderClick = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      return { key, direction: nextSortDirection(prev.direction) };
    });
  };

  const sortedData = useMemo(() => {
    const items = data.map((item) => ({
      ...item,
      label: getCategoryLabel(item.category),
      pct: total > 0 ? (item.amount / total) * 100 : 0,
    }));

    if (!sortConfig.key || !sortConfig.direction) return items;

    const dir = sortConfig.direction;
    return [...items].sort((a, b) => {
      switch (sortConfig.key) {
        case "category":
          return compareStrings(a.label, b.label, dir);
        case "amount":
          return compareNumbers(a.amount, b.amount, dir);
        case "pct":
          return compareNumbers(a.pct, b.pct, dir);
        default:
          return 0;
      }
    });
  }, [data, total, sortConfig]);

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
    `cursor-pointer select-none ${key === "amount" || key === "pct" ? "text-right" : ""}`;

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
            <TableHead className={thClass("category")} onClick={() => handleHeaderClick("category")}>
              <span className="inline-flex items-center gap-1">Categoría {renderSortIcon("category")}</span>
            </TableHead>
            <TableHead className={thClass("amount")} onClick={() => handleHeaderClick("amount")}>
              <span className="inline-flex items-center gap-1 justify-end w-full">Monto {renderSortIcon("amount")}</span>
            </TableHead>
            <TableHead className={thClass("pct")} onClick={() => handleHeaderClick("pct")}>
              <span className="inline-flex items-center gap-1 justify-end w-full">% {renderSortIcon("pct")}</span>
            </TableHead>
            <TableHead className="w-[140px]">Distribución</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((item) => (
            <TableRow key={item.category}>
              <TableCell className="font-medium">{item.label}</TableCell>
              <TableCell className="text-right font-semibold text-red-600">
                -{formatCurrency(item.amount)}
              </TableCell>
              <TableCell className="text-right">{item.pct.toFixed(1)}%</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary/70"
                      style={{ width: `${Math.min(item.pct, 100)}%` }}
                    />
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="font-semibold border-t-2">
            <TableCell>Total</TableCell>
            <TableCell className="text-right text-red-600">-{formatCurrency(total)}</TableCell>
            <TableCell className="text-right">100.0%</TableCell>
            <TableCell>
              <div className="h-2 w-full rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary/70" style={{ width: "100%" }} />
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
