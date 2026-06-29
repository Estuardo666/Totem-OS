"use client";

// CRUD Catálogo de Productos/Servicios para Facturación
// /admin/facturacion/productos

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Save, X, Package } from "lucide-react";

interface Producto {
  id: string;
  codigo: string;
  descripcion: string;
  precioUnitario: number;
  tipoIva: string;
  unidad: string;
  activo: boolean;
}

const TIPOS_IVA = [
  { value: "0", label: "0% (Exento)" },
  { value: "2", label: "2% (Rég. simplificado)" },
  { value: "4", label: "15% (IVA vigente)" },
  { value: "6", label: "No objeto" },
  { value: "7", label: "Exento de IVA" },
];

export default function ProductosFacturacionPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    codigo: "",
    descripcion: "",
    precioUnitario: 0,
    tipoIva: "4",
    unidad: "SERVICIO",
  });

  const loadProductos = useCallback(async () => {
    try {
      const res = await fetch("/api/facturacion/productos");
      if (res.ok) {
        const data = await res.json();
        setProductos(data);
      }
    } catch {
      toast.error("Error al cargar productos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProductos();
  }, [loadProductos]);

  const handleSave = async () => {
    if (!form.codigo || !form.descripcion) {
      toast.error("Código y descripción son requeridos");
      return;
    }

    try {
      const method = editing ? "PUT" : "POST";
      const body = editing ? { ...form, id: editing } : form;

      const res = await fetch("/api/facturacion/productos", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error al guardar");
      }

      toast.success(editing ? "Producto actualizado" : "Producto creado");
      setShowForm(false);
      setEditing(null);
      setForm({ codigo: "", descripcion: "", precioUnitario: 0, tipoIva: "4", unidad: "SERVICIO" });
      loadProductos();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    }
  };

  const handleEdit = (producto: Producto) => {
    setForm({
      codigo: producto.codigo,
      descripcion: producto.descripcion,
      precioUnitario: producto.precioUnitario,
      tipoIva: producto.tipoIva,
      unidad: producto.unidad,
    });
    setEditing(producto.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este producto?")) return;
    try {
      const res = await fetch(`/api/facturacion/productos?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      toast.success("Producto eliminado");
      loadProductos();
    } catch {
      toast.error("Error al eliminar producto");
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Catálogo de Productos/Servicios</h2>
          <p className="text-sm text-muted-foreground">
            Productos y servicios disponibles para facturación electrónica
          </p>
        </div>
        <Button
          onClick={() => {
            setShowForm(true);
            setEditing(null);
            setForm({ codigo: "", descripcion: "", precioUnitario: 0, tipoIva: "4", unidad: "SERVICIO" });
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Nuevo Producto
        </Button>
      </div>

      {/* Formulario */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Editar Producto" : "Nuevo Producto"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  placeholder="REEL-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Input
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Edición de Reel"
                />
              </div>
              <div className="space-y-2">
                <Label>Precio Unitario ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.precioUnitario}
                  onChange={(e) => setForm({ ...form, precioUnitario: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo IVA</Label>
                <Select value={form.tipoIva} onValueChange={(v) => setForm({ ...form, tipoIva: v })}>
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
              <div className="space-y-2">
                <Label>Unidad</Label>
                <Select value={form.unidad} onValueChange={(v) => setForm({ ...form, unidad: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SERVICIO">Servicio</SelectItem>
                    <SelectItem value="BIEN">Bien</SelectItem>
                    <SelectItem value="HORA">Hora</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" /> {editing ? "Actualizar" : "Crear"}
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>
                <X className="mr-2 h-4 w-4" /> Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista */}
      {loading ? (
        <p className="text-center text-muted-foreground p-8">Cargando...</p>
      ) : productos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center p-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay productos configurados</p>
            <p className="text-sm text-muted-foreground">Cree productos para agilizar la emisión de facturas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {productos.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{p.descripcion}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="font-mono">{p.codigo}</Badge>
                    <Badge variant="secondary">IVA {p.tipoIva === "4" ? "15%" : p.tipoIva === "2" ? "2%" : "0%"}</Badge>
                    <Badge variant="outline">{p.unidad}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-lg font-bold">${p.precioUnitario.toFixed(2)}</p>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
