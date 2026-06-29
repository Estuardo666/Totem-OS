// Dashboard de Facturación Electrónica
// /admin/facturacion

import { getResumenFacturas } from "@/services/facturacion/invoice-service";
import { getWorkerStatus } from "@/services/facturacion/configuracion-service";
import { getOrCreateConfig } from "@/services/facturacion/configuracion-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, XCircle, Ban, Plus, Activity, Wifi, WifiOff } from "lucide-react";
import Link from "next/link";

export default async function FacturacionDashboardPage() {
  const [resumen, config, worker] = await Promise.all([
    getResumenFacturas(),
    getOrCreateConfig(),
    getWorkerStatus(),
  ]);

  const kpis = [
    {
      label: "Pendientes",
      value: resumen.pendientes,
      monto: resumen.montoPendiente,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      label: "Autorizadas",
      value: resumen.autorizadas,
      monto: resumen.montoAutorizado,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      label: "Rechazadas",
      value: resumen.rechazadas,
      monto: resumen.montoRechazado,
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      label: "Anuladas",
      value: resumen.anuladas,
      monto: resumen.montoAnulado,
      icon: Ban,
      color: "text-gray-500",
      bgColor: "bg-gray-50",
    },
  ];

  const workerActivo = worker.activo;
  const ambienteLabel = config.sriAmbiente === "1" ? "Pruebas" : "Producción";
  const modoLabel = config.modoFirma;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{config.razonSocial}</h2>
          <p className="text-sm text-muted-foreground">
            RUC {config.ruc} · Est. {config.establecimiento} · Pto. {config.puntoEmision}
          </p>
        </div>
        <Link href="/admin/facturacion/facturas/nueva">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Factura
          </Button>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">
                    ${kpi.monto.toFixed(2)}
                  </p>
                </div>
                <div className={`rounded-full p-3 ${kpi.bgColor}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Estado del Worker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Estado del Worker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              {workerActivo ? (
                <Wifi className="h-4 w-4 text-green-600" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <Badge variant={workerActivo ? "default" : "destructive"}>
                {workerActivo ? "Activo" : "Inactivo"}
              </Badge>
            </div>

            <Badge variant="outline">Modo: {modoLabel}</Badge>
            <Badge variant="outline">Ambiente: {ambienteLabel}</Badge>

            {worker.hostname && (
              <span className="text-sm text-muted-foreground">
                Host: {worker.hostname}
              </span>
            )}

            {worker.ultimoLatido && (
              <span className="text-sm text-muted-foreground">
                Último latido: {new Date(worker.ultimoLatido).toLocaleTimeString("es-EC")}
              </span>
            )}

            <div className="flex items-center gap-2">
              {worker.sriAlcanzable ? (
                <Badge variant="default" className="bg-green-600">SRI alcanzable</Badge>
              ) : (
                <Badge variant="destructive">SRI no alcanzable</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
