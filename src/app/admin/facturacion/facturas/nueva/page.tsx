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
import { ArrowLeft, ArrowRight, Plus, Trash2, Check, Loader2, ListChecks } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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

interface CampoAdicional {
  id: string;
  nombre: string;
  valor: string;
}

interface TareaCliente {
  id: string;
  title: string;
  type: string;
  status: string;
  publishedAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
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
  const preselectedDescription = searchParams.get("description");

  const [step, setStep] = useState(1);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [items, setItems] = useState<ItemFactura[]>([
    {
      id: "1",
      codigo: "SERV-001",
      descripcion: preselectedDescription ?? "Servicio de marketing digital",
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
  const [camposAdicionales, setCamposAdicionales] = useState<CampoAdicional[]>([]);
  const [tareas, setTareas] = useState<TareaCliente[]>([]);
  const [tareasSeleccionadas, setTareasSeleccionadas] = useState<string[]>([]);
  const [cargandoTareas, setCargandoTareas] = useState(false);

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

  // Cargar las tareas del cliente seleccionado para poder adjuntarlas a la factura
  useEffect(() => {
    const clienteId = clienteSeleccionado?.id;
    if (!clienteId) {
      setTareas([]);
      setTareasSeleccionadas([]);
      return;
    }

    let cancelado = false;
    async function loadTareas() {
      setCargandoTareas(true);
      try {
        const res = await fetch(`/api/facturacion/tareas?clientId=${clienteId}`);
        if (!res.ok) throw new Error("Error");
        const data = await res.json();
        if (!cancelado) {
          setTareas(data);
          setTareasSeleccionadas([]);
        }
      } catch {
        if (!cancelado) {
          setTareas([]);
          toast.error("No se pudieron cargar las tareas del cliente");
        }
      } finally {
        if (!cancelado) setCargandoTareas(false);
      }
    }
    loadTareas();
    return () => {
      cancelado = true;
    };
  }, [clienteSeleccionado?.id]);

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

  const toggleTarea = (id: string) => {
    setTareasSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const formatearFechaTarea = (tarea: TareaCliente) => {
    const fecha = tarea.publishedAt ?? tarea.scheduledAt ?? tarea.createdAt;
    return new Date(fecha).toLocaleDateString("es-EC", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const addCampoAdicional = () => {
    setCamposAdicionales((prev) => [
      ...prev,
      { id: String(Date.now()), nombre: "", valor: "" },
    ]);
  };

  const updateCampoAdicional = (id: string, field: "nombre" | "valor", value: string) => {
    setCamposAdicionales((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const removeCampoAdicional = (id: string) => {
    setCamposAdicionales((prev) => prev.filter((c) => c.id !== id));
  };

  // Campos que se envían al SRI: tareas seleccionadas + campos manuales (máx. 15)
  const infoAdicional = [
    ...tareas
      .filter((t) => tareasSeleccionadas.includes(t.id))
      .map((t, i) => ({
        nombre: `Tarea ${i + 1}`,
        valor: `${t.title} (${t.type} - ${formatearFechaTarea(t)})`,
      })),
    ...camposAdicionales
      .filter((c) => c.nombre.trim() && c.valor.trim())
      .map((c) => ({ nombre: c.nombre.trim(), valor: c.valor.trim() })),
  ].slice(0, 15);

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
        infoAdicional: infoAdicional.length > 0 ? infoAdicional : undefined,
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

            {/* Información adicional */}
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Información adicional</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Seleccione las tareas facturadas para que el cliente vea el detalle en su factura.
              </p>

              {cargandoTareas ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando tareas del cliente...
                </p>
              ) : tareas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Este cliente no tiene tareas registradas.
                </p>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {tareas.map((tarea) => (
                    <label
                      key={tarea.id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border p-2 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={tareasSeleccionadas.includes(tarea.id)}
                        onCheckedChange={() => toggleTarea(tarea.id)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{tarea.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {tarea.type} · {tarea.status} · {formatearFechaTarea(tarea)}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {camposAdicionales.map((campo) => (
                <div key={campo.id} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Nombre</Label>
                    <Input
                      value={campo.nombre}
                      placeholder="Ej: Periodo"
                      onChange={(e) => updateCampoAdicional(campo.id, "nombre", e.target.value)}
                    />
                  </div>
                  <div className="flex-[2] space-y-1">
                    <Label className="text-xs">Valor</Label>
                    <Input
                      value={campo.valor}
                      placeholder="Ej: Marzo 2026"
                      onChange={(e) => updateCampoAdicional(campo.id, "valor", e.target.value)}
                    />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeCampoAdicional(campo.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}

              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={addCampoAdicional}>
                  <Plus className="mr-2 h-4 w-4" /> Agregar campo libre
                </Button>
                <span className="text-xs text-muted-foreground">
                  {infoAdicional.length}/15 campos
                </span>
              </div>
            </div>

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

            {/* Información adicional */}
            {infoAdicional.length > 0 && (
              <div>
                <p className="mb-2 text-sm text-muted-foreground">
                  Información adicional ({infoAdicional.length})
                </p>
                {infoAdicional.map((campo) => (
                  <div
                    key={`${campo.nombre}-${campo.valor}`}
                    className="flex justify-between gap-4 border-b py-1 text-sm"
                  >
                    <span className="text-muted-foreground">{campo.nombre}</span>
                    <span className="text-right">{campo.valor}</span>
                  </div>
                ))}
              </div>
            )}

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
