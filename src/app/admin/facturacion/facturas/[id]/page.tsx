"use client";

// Detalle de factura electrónica con tabs, timeline y acciones
// /admin/facturacion/facturas/[id]

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Mail,
  Printer,
  Ban,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Loader2,
  Copy,
} from "lucide-react";
import {
  anularFacturaAction,
  cancelarFacturaLocalAction,
} from "@/actions/admin/facturacion/facturas";

interface FacturaDetalle {
  id: string;
  claveAcceso: string | null;
  numeroAutorizacion: string | null;
  secuencial: string;
  tipoIdentificacion: string;
  numeroIdentificacion: string;
  razonSocial: string;
  direccionCliente: string | null;
  emailCliente: string | null;
  subtotalSinImpuestos: number;
  subtotal0: number;
  subtotal15: number;
  valorIva: number;
  totalDescuento: number;
  importeTotal: number;
  moneda: string;
  formaPagoCodigo: string;
  formaPagoPlazo: string | null;
  estado: string;
  fechaEmision: string;
  fechaAutorizacion: string | null;
  fechaAnulacion: string | null;
  rideUrl: string | null;
  xmlUrl: string | null;
  xmlSriResponse: string | null;
  ultimoErrorSri: string | null;
  codigoErrorSri: string | null;
  intentosSri: number;
  creditNote: { id: string; secuencial: string; estado: string; motivo: string } | null;
  items: Array<{
    id: string;
    codigoPrincipal: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    descuento: number;
    precioTotalSinImpuesto: number;
    tarifa: number;
    valorImpuesto: number;
  }>;
  client: { name: string } | null;
}

const ESTADO_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  PENDIENTE_FIRMA: { icon: Clock, color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
  FIRMADA: { icon: Loader2, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  ENVIADA: { icon: Loader2, color: "text-violet-700", bg: "bg-violet-50 border-violet-200" },
  AUTORIZADA: { icon: CheckCircle, color: "text-green-700", bg: "bg-green-50 border-green-200" },
  RECHAZADA: { icon: XCircle, color: "text-red-700", bg: "bg-red-50 border-red-200" },
  ANULADA: { icon: Ban, color: "text-gray-600", bg: "bg-gray-50 border-gray-200" },
  ERROR: { icon: AlertTriangle, color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
};

export default function DetalleFacturaPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [factura, setFactura] = useState<FacturaDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"info" | "detalle" | "timeline" | "errores">("info");
  const [showAnular, setShowAnular] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const [anulando, setAnulando] = useState(false);

  const loadFactura = useCallback(async () => {
    try {
      const res = await fetch(`/api/facturacion/${id}/estado`);
      if (!res.ok) throw new Error("No se pudo cargar la factura");
      const data = await res.json();
      // Cargar datos completos desde una API extendida o usar server action
      setFactura(data as FacturaDetalle);
    } catch {
      toast.error("Error al cargar la factura");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadFactura();
    // Polling si está en proceso
    const interval = setInterval(() => {
      if (factura && ["PENDIENTE_FIRMA", "FIRMADA", "ENVIADA"].includes(factura.estado)) {
        loadFactura();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [loadFactura, factura]);

  const handleAnular = async () => {
    if (!motivoAnulacion || motivoAnulacion.length < 5) {
      toast.error("El motivo debe tener al menos 5 caracteres");
      return;
    }
    setAnulando(true);
    try {
      await anularFacturaAction(id, motivoAnulacion);
      toast.success("Nota de Crédito generada y encolada para envío al SRI");
      setShowAnular(false);
      setMotivoAnulacion("");
      loadFactura();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al anular");
    } finally {
      setAnulando(false);
    }
  };

  const handleCancelarLocal = async () => {
    if (!confirm("¿Cancelar esta factura? No se enviará al SRI.")) return;
    try {
      await cancelarFacturaLocalAction(id);
      toast.success("Factura cancelada");
      loadFactura();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado al portapapeles");
  };

  if (loading || !factura) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const estadoConf = ESTADO_CONFIG[factura.estado] ?? ESTADO_CONFIG.ERROR;
  const EstadoIcon = estadoConf.icon;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">Factura {factura.secuencial}</h2>
            <p className="text-sm text-muted-foreground">{factura.razonSocial}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {factura.rideUrl && (
            <Button variant="outline" size="sm" onClick={() => window.open(factura.rideUrl!, "_blank")}>
              <Download className="mr-2 h-4 w-4" /> PDF
            </Button>
          )}
          {factura.xmlSriResponse && (
            <Button variant="outline" size="sm" onClick={() => window.open(`/api/facturacion/${id}/xml`, "_blank")}>
              <Download className="mr-2 h-4 w-4" /> XML
            </Button>
          )}
          {factura.estado === "AUTORIZADA" && (
            <Button variant="destructive" size="sm" onClick={() => setShowAnular(true)}>
              <Ban className="mr-2 h-4 w-4" /> Anular
            </Button>
          )}
          {["PENDIENTE_FIRMA", "ERROR"].includes(factura.estado) && (
            <Button variant="outline" size="sm" onClick={handleCancelarLocal}>
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Estado */}
      <Card className={estadoConf.bg}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <EstadoIcon className={`h-10 w-10 ${estadoConf.color}`} />
            <div>
              <p className={`text-xl font-bold ${estadoConf.color}`}>
                {factura.estado.replace(/_/g, " ")}
              </p>
              {factura.fechaAutorizacion && (
                <p className="text-sm">Autorizada: {new Date(factura.fechaAutorizacion).toLocaleString("es-EC")}</p>
              )}
              {factura.numeroAutorizacion && (
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs font-mono break-all">{factura.numeroAutorizacion}</p>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(factura.numeroAutorizacion!)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {factura.claveAcceso && (
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs font-mono break-all">{factura.claveAcceso}</p>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(factura.claveAcceso!)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Procesando indicator */}
      {["PENDIENTE_FIRMA", "FIRMADA", "ENVIADA"].includes(factura.estado) && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-800">Procesando...</p>
              <p className="text-xs text-blue-600">
                La factura está siendo procesada. Esta página se actualiza automáticamente.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["info", "detalle", "timeline", "errores"] as const).map((t) => (
          <button
            key={t}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab(t)}
          >
            {t === "info" && "Información"}
            {t === "detalle" && "Detalle"}
            {t === "timeline" && "Timeline"}
            {t === "errores" && "Errores"}
          </button>
        ))}
      </div>

      {/* Tab: Información */}
      {tab === "info" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Emisor</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">Patricia del Cisne Zapata Cueva</p>
              <p className="text-sm text-muted-foreground">RUC: (configurado)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{factura.razonSocial}</p>
              <p className="text-sm text-muted-foreground">{factura.tipoIdentificacion}: {factura.numeroIdentificacion}</p>
              {factura.direccionCliente && <p className="text-sm">{factura.direccionCliente}</p>}
              {factura.emailCliente && <p className="text-sm">{factura.emailCliente}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Comprobante</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Número: {factura.secuencial}</p>
              <p>Emisión: {new Date(factura.fechaEmision).toLocaleDateString("es-EC")}</p>
              <p>Forma de pago: {factura.formaPagoCodigo}</p>
              {factura.formaPagoPlazo && <p>Plazo: {factura.formaPagoPlazo}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Totales</CardTitle>
            </CardHeader>
            <CardContent>
              {factura.subtotal0 > 0 && <p className="text-sm">Subtotal 0%: ${factura.subtotal0.toFixed(2)}</p>}
              {factura.subtotal15 > 0 && <p className="text-sm">Subtotal 15%: ${factura.subtotal15.toFixed(2)}</p>}
              <p className="text-sm">IVA: ${factura.valorIva.toFixed(2)}</p>
              <p className="text-xl font-bold">Total: ${factura.importeTotal.toFixed(2)}</p>
            </CardContent>
          </Card>
          {factura.creditNote && (
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Nota de Crédito</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge>{factura.creditNote.secuencial}</Badge>
                <span className="ml-2 text-sm">Estado: {factura.creditNote.estado}</span>
                <p className="text-sm mt-1">Motivo: {factura.creditNote.motivo}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tab: Detalle */}
      {tab === "detalle" && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b text-sm text-muted-foreground">
                  <th className="p-3 text-left">Código</th>
                  <th className="p-3 text-left">Descripción</th>
                  <th className="p-3 text-right">Cant.</th>
                  <th className="p-3 text-right">P.Unit</th>
                  <th className="p-3 text-right">IVA</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {factura.items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="p-3 text-sm font-mono">{item.codigoPrincipal}</td>
                    <td className="p-3 text-sm">{item.descripcion}</td>
                    <td className="p-3 text-sm text-right">{item.cantidad}</td>
                    <td className="p-3 text-sm text-right">${item.precioUnitario.toFixed(2)}</td>
                    <td className="p-3 text-sm text-right">{item.tarifa}%</td>
                    <td className="p-3 text-sm text-right font-medium">
                      ${(item.precioTotalSinImpuesto + item.valorImpuesto).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Tab: Timeline */}
      {tab === "timeline" && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <TimelineStep label="Factura creada" date={factura.fechaEmision} active />
            {factura.estado !== "PENDIENTE_FIRMA" && (
              <TimelineStep label="XML firmado (XAdES-BES)" active />
            )}
            {["ENVIADA", "AUTORIZADA", "RECHAZADA"].includes(factura.estado) && (
              <TimelineStep label="Enviado a SRI" active />
            )}
            {factura.estado === "AUTORIZADA" && (
              <TimelineStep
                label="Autorizado por SRI"
                date={factura.fechaAutorizacion ?? undefined}
                active
                success
              />
            )}
            {factura.estado === "RECHAZADA" && (
              <TimelineStep label="Rechazado por SRI" active error />
            )}
            {factura.estado === "ANULADA" && (
              <TimelineStep label="Anulada" date={factura.fechaAnulacion ?? undefined} active error />
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Errores */}
      {tab === "errores" && (
        <Card>
          <CardContent className="p-6">
            {factura.ultimoErrorSri ? (
              <div className="space-y-3">
                {factura.codigoErrorSri && (
                  <Badge variant="destructive">Código: {factura.codigoErrorSri}</Badge>
                )}
                <p className="text-sm">{factura.ultimoErrorSri}</p>
                <p className="text-xs text-muted-foreground">Intentos: {factura.intentosSri}</p>
              </div>
            ) : (
              <p className="text-muted-foreground text-center">No hay errores registrados</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal Anular */}
      {showAnular && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Anular Factura {factura.secuencial}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Se generará una Nota de Crédito Electrónica que se enviará al SRI.
                La factura quedará marcada como ANULADA.
              </p>
              <div className="space-y-2">
                <Label>Motivo de anulación</Label>
                <Textarea
                  value={motivoAnulacion}
                  onChange={(e) => setMotivoAnulacion(e.target.value)}
                  placeholder="Describa el motivo de la anulación (mínimo 5 caracteres)"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAnular(false)}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleAnular} disabled={anulando}>
                  {anulando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
                  {anulando ? "Procesando..." : "Anular factura"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function TimelineStep({
  label,
  date,
  active,
  success,
  error,
}: {
  label: string;
  date?: string;
  active?: boolean;
  success?: boolean;
  error?: boolean;
}) {
  const color = error ? "bg-red-500" : success ? "bg-green-500" : active ? "bg-blue-500" : "bg-gray-300";
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-1 h-3 w-3 rounded-full ${color} flex-shrink-0`} />
      <div>
        <p className={`text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</p>
        {date && <p className="text-xs text-muted-foreground">{new Date(date).toLocaleString("es-EC")}</p>}
      </div>
    </div>
  );
}
