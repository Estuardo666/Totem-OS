import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MonthlyFinancialSummaryData } from "@/actions/finance-actions";
import { formatCurrency, formatPercent, getStatusClasses } from "@/components/features/finance/monthly-summary-utils";

interface MonthlySummaryClientsTableProps {
  summary: MonthlyFinancialSummaryData;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function MonthlySummaryClientsTable({ summary }: MonthlySummaryClientsTableProps) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Contribución por cliente</CardTitle>
        <p className="text-sm text-muted-foreground">
          Esta tabla mezcla solo variables comparables: ingreso del mes, cobro del mes, costo directo registrado y saldo pendiente.
        </p>
        <p className="text-xs text-muted-foreground">
          Los honorarios globales no se prorratean por cliente si no están vinculados a una cuenta específica. Aquí se muestra contribución directa visible.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Ingreso del mes</TableHead>
                <TableHead>Cobrado</TableHead>
                <TableHead>Costo directo</TableHead>
                <TableHead>Margen visible</TableHead>
                <TableHead>Saldo pendiente</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border">
                        <AvatarImage src={client.logo || undefined} alt={client.name} />
                        <AvatarFallback>{getInitials(client.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{client.name}</p>
                        <p className="text-xs text-muted-foreground">{client.outstanding > 0 ? "Requiere seguimiento de cobro" : "Sin presión de cartera"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{client.billingModel}</Badge>
                  </TableCell>
                  <TableCell className="font-semibold">{formatCurrency(client.recognizedRevenue)}</TableCell>
                  <TableCell>{formatCurrency(client.collectedCash)}</TableCell>
                  <TableCell>{formatCurrency(client.directCosts)}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-semibold">{formatCurrency(client.contributionMargin)}</p>
                      <p className="text-xs text-muted-foreground">
                        {client.contributionMarginPct === null ? "Sin base" : formatPercent(client.contributionMarginPct)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{formatCurrency(client.outstanding)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusClasses(client.collectionStatus)}>
                      {client.collectionStatus}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
