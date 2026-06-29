"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Loader2, Receipt } from "lucide-react";
import { actualizarDatosFiscalesCliente } from "@/actions/admin/facturacion/configuracion";

interface ClientBillingFormProps {
  client: {
    id: string;
    name: string;
    tipoIdentificacion?: string | null;
    numeroIdentificacion?: string | null;
    razonSocial?: string | null;
    direccionFiscal?: string | null;
    emailFacturacion?: string | null;
    aplicaRetencion?: boolean | null;
    porcentajeRetIva?: number | null;
    porcentajeRetRenta?: number | null;
  };
  onSaved?: () => void;
}

const TIPOS_IDENTIFICACION = [
  { value: "RUC", label: "RUC (13 dígitos)" },
  { value: "CEDULA", label: "Cédula (10 dígitos)" },
  { value: "PASAPORTE", label: "Pasaporte" },
  { value: "CONSUMIDOR_FINAL", label: "Consumidor Final" },
];

export function ClientBillingForm({ client, onSaved }: ClientBillingFormProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tipoIdentificacion: client.tipoIdentificacion ?? "",
    numeroIdentificacion: client.numeroIdentificacion ?? "",
    razonSocial: client.razonSocial ?? "",
    direccionFiscal: client.direccionFiscal ?? "",
    emailFacturacion: client.emailFacturacion ?? "",
    aplicaRetencion: client.aplicaRetencion ?? false,
    porcentajeRetIva: client.porcentajeRetIva ?? 0,
    porcentajeRetRenta: client.porcentajeRetRenta ?? 0,
  });

  const handleSave = async () => {
    // Validaciones básicas
    if (form.tipoIdentificacion && form.tipoIdentificacion !== "CONSUMIDOR_FINAL" && !form.numeroIdentificacion) {
      toast.error("Ingrese el número de identificación");
      return;
    }
    if (form.tipoIdentificacion === "RUC" && form.numeroIdentificacion.length !== 13) {
      toast.error("El RUC debe tener 13 dígitos");
      return;
    }
    if (form.tipoIdentificacion === "CEDULA" && form.numeroIdentificacion.length !== 10) {
      toast.error("La cédula debe tener 10 dígitos");
      return;
    }
    if (form.emailFacturacion && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emailFacturacion)) {
      toast.error("Ingrese un email válido");
      return;
    }

    setSaving(true);
    try {
      await actualizarDatosFiscalesCliente(client.id, {
        tipoIdentificacion: form.tipoIdentificacion || null,
        numeroIdentificacion: form.numeroIdentificacion || null,
        razonSocial: form.razonSocial || null,
        direccionFiscal: form.direccionFiscal || null,
        emailFacturacion: form.emailFacturacion || null,
        aplicaRetencion: form.aplicaRetencion,
        porcentajeRetIva: form.aplicaRetencion ? form.porcentajeRetIva : null,
        porcentajeRetRenta: form.aplicaRetencion ? form.porcentajeRetRenta : null,
      });
      toast.success("Datos fiscales actualizados correctamente");
      onSaved?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const tieneDatosCompletos =
    form.tipoIdentificacion &&
    (form.tipoIdentificacion === "CONSUMIDOR_FINAL" || form.numeroIdentificacion) &&
    form.razonSocial;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Datos Fiscales
        </CardTitle>
        <CardDescription>
          Información de {client.name} para facturación electrónica ante el SRI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Tipo y número de identificación */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo de Identificación</Label>
            <Select
              value={form.tipoIdentificacion}
              onValueChange={(v) => setForm({ ...form, tipoIdentificacion: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_IDENTIFICACION.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Número de Identificación</Label>
            <Input
              value={form.numeroIdentificacion}
              onChange={(e) => setForm({ ...form, numeroIdentificacion: e.target.value })}
              placeholder={
                form.tipoIdentificacion === "RUC"
                  ? "1791234567001"
                  : form.tipoIdentificacion === "CEDULA"
                  ? "1791234567"
                  : "Número de identificación"
              }
              maxLength={13}
              disabled={form.tipoIdentificacion === "CONSUMIDOR_FINAL"}
            />
          </div>
        </div>

        {/* Razón Social */}
        <div className="space-y-2">
          <Label>Razón Social / Nombre Legal</Label>
          <Input
            value={form.razonSocial}
            onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
            placeholder="Nombre completo o razón social del cliente"
          />
        </div>

        {/* Dirección fiscal */}
        <div className="space-y-2">
          <Label>Dirección Fiscal</Label>
          <Input
            value={form.direccionFiscal}
            onChange={(e) => setForm({ ...form, direccionFiscal: e.target.value })}
            placeholder="Av. Principal 123, Ciudad"
          />
        </div>

        {/* Email de facturación */}
        <div className="space-y-2">
          <Label>Email de Facturación</Label>
          <Input
            type="email"
            value={form.emailFacturacion}
            onChange={(e) => setForm({ ...form, emailFacturacion: e.target.value })}
            placeholder="facturas@cliente.com"
          />
          <p className="text-xs text-muted-foreground">
            Email donde se enviarán los comprobantes electrónicos
          </p>
        </div>

        {/* Retenciones */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-2">
            <Switch
              checked={form.aplicaRetencion}
              onCheckedChange={(checked) => setForm({ ...form, aplicaRetencion: checked })}
            />
            <Label>Aplica retenciones</Label>
          </div>

          {form.aplicaRetencion && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>% Retención IVA</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={form.porcentajeRetIva}
                  onChange={(e) =>
                    setForm({ ...form, porcentajeRetIva: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>% Retención Renta</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={form.porcentajeRetRenta}
                  onChange={(e) =>
                    setForm({ ...form, porcentajeRetRenta: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="0"
                />
              </div>
            </div>
          )}
        </div>

        {/* Estado de completitud */}
        <div className="flex items-center gap-2 text-sm">
          {tieneDatosCompletos ? (
            <span className="text-green-600 font-medium">
              ✓ Datos fiscales completos
            </span>
          ) : (
            <span className="text-amber-600 font-medium">
              ⚠ Faltan datos para facturación electrónica
            </span>
          )}
        </div>

        {/* Botón guardar */}
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saving ? "Guardando..." : "Guardar datos fiscales"}
        </Button>
      </CardContent>
    </Card>
  );
}
