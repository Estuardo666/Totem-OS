"use client";

// Wizard de nueva factura electrónica (3 pasos)
// /admin/facturacion/facturas/nueva

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Plus, Trash2, Check, Loader2 } from "lucide-react";
import { emitirFacturaAction } from "@/actions/admin/facturacion/facturas";
import { FORMAS_PAGO_LABELS } from "@/lib/sri/types";

interface ItemFactura {
  id: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  tipoIva: string;
}

interface Cliente {
  id: string;
  name: string;
  email: string | null;
  numeroIdentificacion: string | null;
  razonSocial: string | null;
}

const TIPOS_IVA = [
  { value: "0", label: "0% (Exento)" },
  { value: "2", label: "2% (Régimen simplificado)" },
  { value: "4", label: "15% (IVA vigente)" },
  { value: "6", label: "No objeto de impuesto" },
  { value: "7", label: "Exento de IVA" },
];

export default function NuevaFacturaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get("clientId");
  const preselectedClientName = searchParams.get("clientName");
  const preselectedAmount = searchParams.get("amount");

  const [step, setStep] = useState(1);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [items, setItems] = useState<ItemFactura[]>([
    {
      id: "1",
      codigo: "SERV-001",
      descripcion: "Servicio de marketing digital",
      cantidad: 1,
      precioUnitario: preselectedAmount ? parseFloat(preselectedAmount) : 0,
      descuento: 0,
      tipoIva: "4",
    },
  ]);
  const [formaPagoCodigo, setFormaPagoCodigo] = useState("20");
  const [formaPagoPlazo, setFormaPagoPlazo] = useState("");
  const [enviarEmail, setEnviarEmail] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Cargar clientes y auto-seleccionar si hay clientId o clientName
  useEffect(() => {
    async function loadClientes() {
      try {
        const res = await fetch("/api/facturacion/clientes");
        if (res.ok) {
          const data = await res.json();
          setClientes(data);
          // Auto-seleccionar cliente si viene por URL
          if (preselectedClientId) {
            const found = data.find((c: Cliente) => c.id === preselectedClientId);
            if (found) {
              setClienteSeleccionado(found);
              setStep(2);
            }
          } else if (preselectedClientName) {
            const found = data.find((c: Cliente) =>
              c.name.toLowerCase().includes(preselectedClientName.toLowerCase()) ||
              c.razonSocial?.toLowerCase().includes(preselectedClientName.toLowerCase())
            );
            if (found) {
              setClienteSeleccionado(found);
              setStep(2);
            }
          }
        }
      } catch {
        toast.error("Error al cargar clientes");
      }
    }
    loadClientes();
  }, [preselectedClientId, preselectedClientName]);

  // Calcular totales
  const calcularItem = (item: ItemFactura) => {
    const subtotal = item.cantidad * item.precioUnitario - item.descuento;
    const porcentaje = { "0": 0, "2": 2, "4": 15, "6": 0, "7": 0 }[item.tipoIva] ?? 15;
    const iva = subtotal * porcentaje / 100;
    return { subtotal, iva, total: subtotal + iva };
  };

  const totales = items.reduce(
    (acc, item) => {
      const calc = calcularItem(item);
      return {
        subtotal: acc.subtotal + calc.subtotal,
        iva: acc.iva + calc.iva,
        total: acc.total + calc.total,
      };
    },
    { subtotal: 0, iva: 0, total: 0 }
  );

  const addItem = () => {
    setItems([
      ...items,
      {
        id: String(Date.now()),
        codigo: `SERV-${String(items.length + 1).padStart(3, "0")}`,
        descripcion: "",
        cantidad: 1,
        precioUnitario: 0,
        descuento: 0,
        tipoIva: "4",
      },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(items.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, field: keyof ItemFactura, value: string | number) => {
    setItems(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const handleSubmit = async () => {
    if (!clienteSeleccionado) {
      toast.error("Seleccione un cliente");
      return;
    }
    if (items.some((i) => !i.descripcion || i.precioUnitario <= 0)) {
      toast.error("Complete la descripción y precio de todos los items");
      return;
    }

    setSubmitting(true);
    try {
      const result = await emitirFacturaAction({
        clientId: clienteSeleccionado.id,
        items: items.map((i) => ({
          codigo: i.codigo,
          descripcion: i.descripcion,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
          descuento: i.descuento,
          tipoIva: i.tipoIva,
        })),
        formaPagoCodigo,
        formaPagoPlazo: formaPagoPlazo || undefined,
        enviarEmail,
      });

      toast.success(`Factura ${result.secuencial} creada y encolada para envío al SRI`);
      router.push(`/admin/facturacion/facturas/${result.facturaId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al emitir factura");
    } finally {
      setSubmitting(false);
    }
  };

  const clientesFiltrados = busquedaCliente
    ? clientes.filter(
        (c) =>
          c.name.toLowerCase().includes(busquedaCliente.toLowerCase()) ||
          c.numeroIdentificacion?.includes(busquedaCliente) ||
          c.razonSocial?.toLowerCase().includes(busquedaCliente.toLowerCase())
      )
    : clientes;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold">Nueva Factura Electrónica</h2>
          <p className="text-sm text-muted-foreground">Paso {step} de 3</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex gap-2">
        {["Cliente", "Detalle", "Confirmar"].map((label, i) => (
          <div
            key={label}
            className={`flex-1 p-2 text-center text-sm font-medium rounded-lg ${
              step === i + 1
                ? "bg-primary text-primary-foreground"
                : step > i + 1
                ? "bg-green-100 text-green-800"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {step > i + 1 && <Check className="inline h-4 w-4 mr-1" />}
            {label}
          </div>
        ))}
      </div>

      {/* Paso 1: Cliente */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Seleccionar Cliente</CardTitle>
            <CardDescription>El cliente debe tener RUC/Cédula y Razón Social configurados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Input
                placeholder="Buscar por nombre, RUC o cédula..."
                value={busquedaCliente}
                onChange={(e) => setBusquedaCliente(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-80 overflow-y-auto">
              {clientesFiltrados.map((c) => {
                const isSelected = clienteSeleccionado?.id === c.id;
                const iniciales = c.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);
                return (
                  <div
                    key={c.id}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-muted hover:border-muted-foreground/30 hover:bg-muted/50"
                    }`}
                    onClick={() => setClienteSeleccionado(c)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                        {iniciales}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{c.razonSocial ?? c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.numeroIdentificacion ?? "Sin identificación"}
                        </p>
                        {c.email && (
                          <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                        )}
                        {!c.numeroIdentificacion && (
                          <Badge variant="destructive" className="mt-1 text-xs">
                            Sin datos fiscales
                          </Badge>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="h-5 w-5 text-primary shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
              {clientesFiltrados.length === 0 && (
                <p className="text-center text-muted-foreground p-4 col-span-full">
                  No se encontraron clientes
                </p>
              )}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!clienteSeleccionado}>
                Siguiente <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paso 2: Detalle */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Detalle de la Factura</CardTitle>
            <CardDescription>Agregue los productos o servicios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, idx) => (
              <div key={item.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Item {idx + 1}</span>
                  {items.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Código</Label>
                    <Input
                      value={item.codigo}
                      onChange={(e) => updateItem(item.id, "codigo", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Descripción</Label>
                    <Input
                      value={item.descripcion}
                      onChange={(e) => updateItem(item.id, "descripcion", e.target.value)}
                      placeholder="Servicio o producto"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">IVA</Label>
                    <Select value={item.tipoIva} onValueChange={(v) => updateItem(item.id, "tipoIva", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_IVA.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Cantidad</Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.cantidad}
                      onChange={(e) => updateItem(item.id, "cantidad", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Precio Unitario ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.precioUnitario}
                      onChange={(e) => updateItem(item.id, "precioUnitario", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Descuento ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.descuento}
                      onChange={(e) => updateItem(item.id, "descuento", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Total</Label>
                    <Input value={`$${calcularItem(item).total.toFixed(2)}`} readOnly className="bg-muted" />
                  </div>
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={addItem}>
              <Plus className="mr-2 h-4 w-4" /> Agregar item
            </Button>

            {/* Totales */}
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>${totales.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>IVA:</span>
                <span>${totales.iva.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>TOTAL:</span>
                <span>${totales.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
              </Button>
              <Button onClick={() => setStep(3)}>
                Siguiente <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paso 3: Confirmar */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Confirmar Factura</CardTitle>
            <CardDescription>Revise los datos antes de emitir</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Resumen cliente */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium">{clienteSeleccionado?.razonSocial ?? clienteSeleccionado?.name}</p>
                <p className="text-sm">{clienteSeleccionado?.numeroIdentificacion}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Forma de Pago</p>
                <Select value={formaPagoCodigo} onValueChange={setFormaPagoCodigo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FORMAS_PAGO_LABELS).map(([codigo, label]) => (
                      <SelectItem key={codigo} value={codigo}>
                        {codigo} - {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formaPagoCodigo !== "01" && (
                  <div className="mt-2">
                    <Label className="text-xs">Plazo (opcional)</Label>
                    <Input
                      placeholder="30 días"
                      value={formaPagoPlazo}
                      onChange={(e) => setFormaPagoPlazo(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Resumen items */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">Items ({items.length})</p>
              {items.map((item) => {
                const calc = calcularItem(item);
                return (
                  <div key={item.id} className="flex justify-between py-1 text-sm border-b">
                    <span>
                      {item.descripcion} × {item.cantidad}
                    </span>
                    <span>${calc.total.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex justify-between text-2xl font-bold">
                <span>TOTAL:</span>
                <span>${totales.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center gap-2">
              <Switch checked={enviarEmail} onCheckedChange={setEnviarEmail} />
              <Label>Enviar factura al cliente por email</Label>
            </div>

            {/* Submit */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
              </Button>
              <Button onClick={handleSubmit} disabled={submitting} size="lg">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Emitir Factura Electrónica
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
