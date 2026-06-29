"use client";

// Página de lista de facturas electrónicas
// /admin/facturacion/facturas

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Download,
  Mail,
  Eye,
  Filter,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  Ban,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { getFacturasAction, getResumenFacturasAction } from "@/actions/admin/facturacion/facturas";

interface Factura {
  id: string;
  secuencial: string;
  razonSocial: string;
  numeroIdentificacion: string;
  importeTotal: number;
  valorIva: number;
  estado: string;
  fechaEmision: string;
  claveAcceso: string | null;
  client: { name: string; logo: string | null } | null;
  creditNote: { secuencial: string; estado: string } | null;
}

interface Resumen {
  pendientes: number;
  autorizadas: number;
  rechazadas: number;
  anuladas: number;
  montoAutorizado: number;
  montoPendiente: number;
  montoRechazado: number;
  montoAnulado: number;
}

const ESTADO_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  PENDIENTE_FIRMA: { icon: Clock, color: "bg-yellow-100 text-yellow-800", label: "Pendiente" },
  FIRMADA: { icon: Loader2, color: "bg-blue-100 text-blue-800", label: "Firmada" },
  ENVIADA: { icon: Loader2, color: "bg-violet-100 text-violet-800", label: "Enviada" },
  AUTORIZADA: { icon: CheckCircle, color: "bg-green-100 text-green-800", label: "Autorizada" },
  RECHAZADA: { icon: XCircle, color: "bg-red-100 text-red-800", label: "Rechazada" },
  ANULADA: { icon: Ban, color: "bg-gray-100 text-gray-600", label: "Anulada" },
  ERROR: { icon: AlertTriangle, color: "bg-orange-100 text-orange-800", label: "Error" },
  CANCELADA_LOCAL: { icon: Ban, color: "bg-gray-100 text-gray-500", label: "Cancelada" },
};

function EstadoBadge({ estado }: { estado: string }) {
  const config = ESTADO_CONFIG[estado] ?? { icon: AlertTriangle, color: "bg-gray-100", label: estado };
  const Icon = config.icon;
  return (
    <Badge className={`${config.color} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export default function FacturasListPage() {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [facturasResult, resumenResult] = await Promise.all([
        getFacturasAction({
          page,
          busqueda: busqueda || undefined,
          estado: filtroEstado !== "TODOS" ? filtroEstado : undefined,
        }),
        getResumenFacturasAction(),
      ]);
      setFacturas(facturasResult.facturas as unknown as Factura[]);
      setTotalPages(facturasResult.totalPages);
      setResumen(resumenResult as unknown as Resumen);
    } catch {
      toast.error("Error al cargar facturas");
    } finally {
      setLoading(false);
    }
  }, [page, busqueda, filtroEstado]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBuscar = () => {
    setPage(1);
    loadData();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Facturas Electrónicas</h2>
        <Link href="/admin/facturacion/facturas/nueva">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Factura
          </Button>
        </Link>
      </div>

      {/* Resumen rápido */}
      {resumen && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Autorizadas", value: resumen.autorizadas, monto: resumen.montoAutorizado, color: "text-green-600" },
            { label: "Pendientes", value: resumen.pendientes, monto: resumen.montoPendiente, color: "text-yellow-600" },
            { label: "Rechazadas", value: resumen.rechazadas, monto: resumen.montoRechazado, color: "text-red-600" },
            { label: "Anuladas", value: resumen.anuladas, monto: resumen.montoAnulado, color: "text-gray-500" },
          ].map((item) => (
            <Card
              key={item.label}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                const map: Record<string, string> = {
                  Autorizadas: "AUTORIZADA",
                  Pendientes: "PENDIENTE_FIRMA",
                  Rechazadas: "RECHAZADA",
                  Anuladas: "ANULADA",
                };
                setFiltroEstado(map[item.label] ?? "TODOS");
                setPage(1);
              }}
            >
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-muted-foreground">${item.monto.toFixed(2)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, cliente, RUC..."
              className="pl-9"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
            />
          </div>
        </div>
        <Select value={filtroEstado} onValueChange={(v) => { setFiltroEstado(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos</SelectItem>
            <SelectItem value="PENDIENTE_FIRMA">Pendientes</SelectItem>
            <SelectItem value="AUTORIZADA">Autorizadas</SelectItem>
            <SelectItem value="RECHAZADA">Rechazadas</SelectItem>
            <SelectItem value="ANULADA">Anuladas</SelectItem>
            <SelectItem value="ERROR">Con Error</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleBuscar}>
          <Filter className="mr-2 h-4 w-4" />
          Filtrar
        </Button>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : facturas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No se encontraron facturas</p>
            <Link href="/admin/facturacion/facturas/nueva" className="mt-4">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Emitir primera factura
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {facturas.map((f) => (
            <Link key={f.id} href={`/admin/facturacion/facturas/${f.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-mono text-sm font-medium">{f.secuencial}</p>
                        <p className="text-sm text-muted-foreground">{f.razonSocial}</p>
                        <p className="text-xs text-muted-foreground">{f.numeroIdentificacion}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold">${f.importeTotal.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">IVA: ${f.valorIva.toFixed(2)}</p>
                      </div>
                      <EstadoBadge estado={f.estado} />
                      {f.creditNote && (
                        <Badge variant="outline" className="text-xs">
                          NC: {f.creditNote.secuencial}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
