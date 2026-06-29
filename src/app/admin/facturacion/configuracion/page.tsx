"use client";

// Página de configuración de facturación electrónica
// /admin/facturacion/configuracion

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Upload, Trash2, Save, Cloud, HardDrive, Shield, Mail, TestTube, Server } from "lucide-react";
import {
  getConfiguracionAction,
  actualizarEmisorAction,
  cambiarAmbienteAction,
  cambiarModoFirmaAction,
  subirP12Action,
  eliminarP12Action,
  actualizarEmailAction,
} from "@/actions/admin/facturacion/configuracion";

interface ConfigData {
  config: {
    id: string;
    ruc: string;
    razonSocial: string;
    nombreComercial: string | null;
    direccionMatriz: string;
    establecimiento: string;
    puntoEmision: string;
    obligadoContabilidad: boolean;
    agenteRetencion: boolean;
    contribuyenteRimpe: boolean;
    sriAmbiente: string;
    modoFirma: string;
    p12Huella: string | null;
    p12Vence: string | null;
    p12Titular: string | null;
    p12LocalNombre: string | null;
    p12LocalSubidoAt: string | null;
    emailFrom: string | null;
    emailReplyTo: string | null;
    emailBccAdmin: boolean;
    emailAsuntoTemplate: string | null;
    emailCuerpoTemplate: string | null;
    emailLogoUrl: string | null;
    siguienteFactura: number;
    siguienteNotaCredito: number;
    siguienteRetencion: number;
  };
  worker: {
    activo: boolean;
    modo: string | null;
    hostname: string | null;
    version: string | null;
    ultimoLatido: string | null;
    sriAlcanzable: boolean;
  };
}

export default function ConfiguracionFacturacionPage() {
  const [data, setData] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [p12File, setP12File] = useState<File | null>(null);
  const [p12Password, setP12Password] = useState("");

  const loadConfig = useCallback(async () => {
    try {
      const result = await getConfiguracionAction();
      setData(result as unknown as ConfigData);
    } catch (error) {
      toast.error("Error al cargar configuración");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleGuardarEmisor = async (formData: FormData) => {
    setSaving(true);
    try {
      await actualizarEmisorAction({
        ruc: formData.get("ruc") as string,
        razonSocial: formData.get("razonSocial") as string,
        nombreComercial: formData.get("nombreComercial") as string,
        direccionMatriz: formData.get("direccionMatriz") as string,
        establecimiento: formData.get("establecimiento") as string,
        puntoEmision: formData.get("puntoEmision") as string,
        obligadoContabilidad: formData.get("obligadoContabilidad") === "on",
        agenteRetencion: formData.get("agenteRetencion") === "on",
        contribuyenteRimpe: formData.get("contribuyenteRimpe") === "on",
      });
      toast.success("Datos del emisor actualizados correctamente");
      loadConfig();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleCambiarAmbiente = async (ambiente: string) => {
    try {
      await cambiarAmbienteAction(ambiente);
      toast.success(
        ambiente === "1"
          ? "Cambiado a ambiente de PRUEBAS"
          : "Cambiado a ambiente de PRODUCCIÓN"
      );
      loadConfig();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    }
  };

  const handleCambiarModo = async (modo: string) => {
    try {
      await cambiarModoFirmaAction(modo);
      toast.success(`Modo de firma cambiado a ${modo}`);
      loadConfig();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    }
  };

  const handleSubirP12 = async () => {
    if (!p12File) {
      toast.error("Seleccione un archivo .p12");
      return;
    }
    if (!p12Password) {
      toast.error("Ingrese la contraseña del certificado");
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("p12", p12File);
      formData.append("password", p12Password);

      const result = await subirP12Action(formData);
      toast.success("Certificado .p12 cargado correctamente");
      setP12File(null);
      setP12Password("");
      loadConfig();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al cargar .p12");
    } finally {
      setSaving(false);
    }
  };

  const handleEliminarP12 = async () => {
    if (!confirm("¿Está seguro de eliminar el certificado .p12 local?")) return;

    try {
      await eliminarP12Action();
      toast.success("Certificado .p12 eliminado");
      loadConfig();
    } catch (error) {
      toast.error("Error al eliminar certificado");
    }
  };

  if (loading || !data) {
    return <div className="flex items-center justify-center p-12">Cargando...</div>;
  }

  const { config, worker } = data;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Datos del Emisor */}
      <Card>
        <CardHeader>
          <CardTitle>Datos del Emisor</CardTitle>
          <CardDescription>
            Información fiscal que aparece en todos los comprobantes electrónicos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleGuardarEmisor} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ruc">RUC</Label>
                <Input id="ruc" name="ruc" defaultValue={config.ruc} maxLength={13} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="razonSocial">Razón Social</Label>
                <Input id="razonSocial" name="razonSocial" defaultValue={config.razonSocial} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nombreComercial">Nombre Comercial</Label>
                <Input id="nombreComercial" name="nombreComercial" defaultValue={config.nombreComercial ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="direccionMatriz">Dirección Matriz</Label>
                <Input id="direccionMatriz" name="direccionMatriz" defaultValue={config.direccionMatriz} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="establecimiento">Establecimiento</Label>
                <Input id="establecimiento" name="establecimiento" defaultValue={config.establecimiento} maxLength={3} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="puntoEmision">Punto de Emisión</Label>
                <Input id="puntoEmision" name="puntoEmision" defaultValue={config.puntoEmision} maxLength={3} required />
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch name="obligadoContabilidad" defaultChecked={config.obligadoContabilidad} />
                <Label>Obligado a contabilidad</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch name="agenteRetencion" defaultChecked={config.agenteRetencion} />
                <Label>Agente de retención</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch name="contribuyenteRimpe" defaultChecked={config.contribuyenteRimpe} />
                <Label>Contribuyente RIMPE</Label>
              </div>
            </div>

            <Button type="submit" disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Guardando..." : "Guardar datos del emisor"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Ambiente SRI */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Ambiente SRI
            <Badge variant={config.sriAmbiente === "1" ? "secondary" : "default"}>
              {config.sriAmbiente === "1" ? "PRUEBAS" : "PRODUCCIÓN"}
            </Badge>
          </CardTitle>
          <CardDescription>
            En pruebas los comprobantes no tienen valor fiscal. Cambie a producción solo cuando esté listo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              variant={config.sriAmbiente === "1" ? "default" : "outline"}
              onClick={() => handleCambiarAmbiente("1")}
            >
              <TestTube className="mr-2 h-4 w-4" />
              Pruebas (1)
            </Button>
            <Button
              variant={config.sriAmbiente === "2" ? "default" : "outline"}
              onClick={() => handleCambiarAmbiente("2")}
            >
              <Server className="mr-2 h-4 w-4" />
              Producción (2)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modo de Firma */}
      <Card>
        <CardHeader>
          <CardTitle>Modo de Firma Digital</CardTitle>
          <CardDescription>
            Dónde se ejecuta la firma XML con el certificado .p12
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button
              variant={config.modoFirma === "NUBE" ? "default" : "outline"}
              onClick={() => handleCambiarModo("NUBE")}
            >
              <Cloud className="mr-2 h-4 w-4" />
              Nube (Fly.io)
            </Button>
            <Button
              variant={config.modoFirma === "LOCAL" ? "default" : "outline"}
              onClick={() => handleCambiarModo("LOCAL")}
            >
              <HardDrive className="mr-2 h-4 w-4" />
              Local (PC/Servidor)
            </Button>
          </div>

          {/* Worker Status */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Badge variant={worker.activo ? "default" : "destructive"}>
              {worker.activo ? "Worker activo" : "Worker inactivo"}
            </Badge>
            {worker.hostname && <span className="text-sm">{worker.hostname}</span>}
            {worker.sriAlcanzable !== undefined && (
              <Badge variant={worker.sriAlcanzable ? "default" : "destructive"}>
                SRI {worker.sriAlcanzable ? "alcanzable" : "no alcanzable"}
              </Badge>
            )}
          </div>

          {/* .p12 Local Upload */}
          {config.modoFirma === "LOCAL" && (
            <div className="space-y-4 p-4 border rounded-lg">
              <h4 className="font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Certificado .p12 Local
              </h4>

              {config.p12Huella ? (
                <div className="space-y-2">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-800">Certificado cargado</p>
                    <p className="text-xs text-green-700">Titular: {config.p12Titular}</p>
                    <p className="text-xs text-green-700">Huella: {config.p12Huella}</p>
                    {config.p12Vence && (
                      <p className="text-xs text-green-700">
                        Vence: {new Date(config.p12Vence).toLocaleDateString("es-EC")}
                      </p>
                    )}
                    <p className="text-xs text-green-700">
                      Archivo: {config.p12LocalNombre}
                    </p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={handleEliminarP12}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar certificado
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="p12File">Archivo .p12</Label>
                    <Input
                      id="p12File"
                      type="file"
                      accept=".p12,.pfx"
                      onChange={(e) => setP12File(e.target.files?.[0] ?? null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p12Password">Contraseña del certificado</Label>
                    <Input
                      id="p12Password"
                      type="password"
                      value={p12Password}
                      onChange={(e) => setP12Password(e.target.value)}
                      placeholder="Ingrese la contraseña del .p12"
                    />
                  </div>
                  <Button onClick={handleSubirP12} disabled={saving}>
                    <Upload className="mr-2 h-4 w-4" />
                    {saving ? "Cargando..." : "Cargar certificado"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Envío de Comprobantes por Email
          </CardTitle>
          <CardDescription>
            Configure cómo se envían los comprobantes a los clientes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData: FormData) => {
              setSaving(true);
              try {
                await actualizarEmailAction({
                  emailFrom: formData.get("emailFrom") as string,
                  emailReplyTo: formData.get("emailReplyTo") as string,
                  emailBccAdmin: formData.get("emailBccAdmin") === "on",
                  emailAsuntoTemplate: formData.get("emailAsuntoTemplate") as string,
                  emailLogoUrl: formData.get("emailLogoUrl") as string,
                });
                toast.success("Configuración de email actualizada");
                loadConfig();
              } catch {
                toast.error("Error al guardar email");
              } finally {
                setSaving(false);
              }
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="emailFrom">Desde (From)</Label>
                <Input
                  id="emailFrom"
                  name="emailFrom"
                  defaultValue={config.emailFrom ?? ""}
                  placeholder="Facturacion <facturas@tudominio.com>"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emailReplyTo">Responder a (Reply-To)</Label>
                <Input
                  id="emailReplyTo"
                  name="emailReplyTo"
                  defaultValue={config.emailReplyTo ?? ""}
                  placeholder="patricia@tudominio.com"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch name="emailBccAdmin" defaultChecked={config.emailBccAdmin} />
              <Label>Enviar copia oculta (BCC) al administrador</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="emailAsuntoTemplate">Asunto del email</Label>
              <Input
                id="emailAsuntoTemplate"
                name="emailAsuntoTemplate"
                defaultValue={config.emailAsuntoTemplate ?? "Factura Electrónica {numero} - {cliente}"}
                placeholder="Factura Electrónica {numero} - {cliente}"
              />
              <p className="text-xs text-muted-foreground">
                Variables: {"{numero}"}, {"{cliente}"}, {"{total}"}, {"{fecha}"}, {"{claveAcceso}"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="emailLogoUrl">URL del logo para el email</Label>
              <Input
                id="emailLogoUrl"
                name="emailLogoUrl"
                defaultValue={config.emailLogoUrl ?? ""}
                placeholder="https://..."
              />
            </div>

            <Button type="submit" disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Guardando..." : "Guardar configuración de email"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Secuenciales */}
      <Card>
        <CardHeader>
          <CardTitle>Secuenciales</CardTitle>
          <CardDescription>
            Próximo número de secuencial por tipo de comprobante
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Facturas (01)</p>
              <p className="text-2xl font-bold">
                {config.establecimiento}-{config.puntoEmision}-{String(config.siguienteFactura).padStart(9, "0")}
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Notas de Crédito (04)</p>
              <p className="text-2xl font-bold">
                {config.establecimiento}-{config.puntoEmision}-{String(config.siguienteNotaCredito).padStart(9, "0")}
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Retenciones (07)</p>
              <p className="text-2xl font-bold">
                {config.establecimiento}-{config.puntoEmision}-{String(config.siguienteRetencion).padStart(9, "0")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
