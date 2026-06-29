"use client";

import { useEffect, useState } from "react";
import {
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  getHonorariosOverview,
  type HonorariosUserRow,
} from "@/actions/finance-honorarios-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function HonorariosOverviewPanel() {
  const [rows, setRows] = useState<HonorariosUserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const result = await getHonorariosOverview();
      if (result.success && result.data) {
        setRows(result.data);
      }
      setLoading(false);
    })();
  }, []);

  const totalBase = rows.reduce((s, r) => s + r.baseSalary, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paidThisMonth, 0);
  const totalRemaining = rows.reduce((s, r) => s + r.remaining, 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Resumen de honorarios mensuales
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Total mensual</p>
            <p className="text-xl font-bold">${totalBase.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Pagado este mes</p>
            <p className="text-xl font-bold text-green-600">${totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Pendiente</p>
            <p className={`text-xl font-bold ${totalRemaining > 0 ? "text-amber-600" : "text-green-600"}`}>
              ${totalRemaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Table — read-only, edit via "Configurar" en cada tarjeta */}
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Persona</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Honorario fijado</TableHead>
                <TableHead>Pagado este mes</TableHead>
                <TableHead>Pendiente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No hay usuarios registrados
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {row.userImage && (
                          <img
                            src={row.userImage}
                            alt=""
                            className="h-6 w-6 rounded-full object-cover"
                          />
                        )}
                        <span className="font-medium">{row.userName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {row.salaryType === "MONTHLY"
                          ? "Mensual"
                          : row.salaryType === "HOURLY"
                            ? "Por hora"
                            : row.salaryType === "PROFIT_SHARE"
                              ? "Socio"
                              : row.salaryType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">
                        ${row.baseSalary.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={row.paidThisMonth > 0 ? "text-green-600" : "text-muted-foreground"}>
                        ${row.paidThisMonth.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </TableCell>
                    <TableCell>
                      {row.remaining > 0 ? (
                        <span className="flex items-center gap-1 text-amber-600 font-medium">
                          <AlertCircle className="h-3 w-3" />
                          ${row.remaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      ) : row.baseSalary > 0 ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-3 w-3" />
                          Completo
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          Para editar honorarios, usa el botón <strong>Configurar</strong> en cada tarjeta de liquidación.
        </p>
      </CardContent>
    </Card>
  );
}
