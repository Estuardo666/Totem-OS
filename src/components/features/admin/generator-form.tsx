"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { generateMonthlyPlan } from "@/actions/generator-actions";
import type { Client } from "@prisma/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlanType } from "@/actions/generator-actions";

interface GeneratorFormProps {
  clients: Client[];
}

export function GeneratorForm({ clients }: GeneratorFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [monthDate, setMonthDate] = useState<string>(
    format(new Date(), "yyyy-MM")
  );
  const [planType, setPlanType] = useState<PlanType>("STANDARD");
  const [isPending, startTransition] = useTransition();

  // Toggle selección de un cliente
  const toggleClient = (clientId: string) => {
    setSelectedClients((prev) =>
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId]
    );
  };

  // Seleccionar/deseleccionar todos
  const toggleAll = () => {
    if (selectedClients.length === clients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(clients.map((c) => c.id));
    }
  };

  const handleGenerate = () => {
    if (selectedClients.length === 0) {
      toast({
        variant: "destructive",
        title: "Sin selección",
        description: "Debes seleccionar al menos un cliente",
      });
      return;
    }

    if (!monthDate) {
      toast({
        variant: "destructive",
        title: "Fecha requerida",
        description: "Debes seleccionar un mes",
      });
      return;
    }

    startTransition(async () => {
      try {
        // Convertir el string "yyyy-MM" a Date (primer día del mes seleccionado)
        const [year, month] = monthDate.split("-").map(Number);
        const targetDate = new Date(year, month - 1, 1);

        const result = await generateMonthlyPlan(selectedClients, targetDate, planType);

        if (result.success && result.data) {
          toast({
            title: "¡Éxito!",
            description: `Se crearon ${result.data.tasksCreated} tareas para ${result.data.clientsProcessed} cliente${result.data.clientsProcessed !== 1 ? "s" : ""}.`,
          });
          // Limpiar selección
          setSelectedClients([]);
          // Refrescar la página
          router.refresh();
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: result.error || "No se pudo generar el plan",
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Ocurrió un error inesperado",
        });
      }
    });
  };

  const allSelected = selectedClients.length === clients.length && clients.length > 0;
  const someSelected = selectedClients.length > 0 && selectedClients.length < clients.length;

  // Calcular estadísticas del plan seleccionado
  const planStats = planType === "STANDARD" 
    ? { videos: 3, images: 1, total: 4 }
    : { videos: 6, images: 1, total: 7 };

  return (
    <div className="space-y-6">
      {/* Selector de Plan */}
      <div className="border rounded-lg p-4 bg-muted/30">
        <Label className="text-sm font-semibold mb-3 block">Tipo de Plan:</Label>
        <Tabs value={planType} onValueChange={(value) => setPlanType(value as PlanType)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="STANDARD">
              Plan Estándar (3 Reels + 1 Flyer)
            </TabsTrigger>
            <TabsTrigger value="PLAN_2">
              Plan 2 (6 Reels + 1 Flyer)
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Controles superiores */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={allSelected}
              onCheckedChange={toggleAll}
              disabled={isPending || clients.length === 0}
            />
            <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
              Seleccionar Todos ({selectedClients.length}/{clients.length})
            </Label>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="month-select" className="text-sm font-medium">
              Mes objetivo:
            </Label>
            <Input
              id="month-select"
              type="month"
              value={monthDate}
              onChange={(e) => setMonthDate(e.target.value)}
              disabled={isPending}
              className="w-48"
              min={format(new Date(), "yyyy-MM")}
            />
            {monthDate && (
              <p className="text-xs text-muted-foreground">
                {(() => {
                  const [year, month] = monthDate.split("-").map(Number);
                  return format(new Date(year, month - 1, 1), "MMMM yyyy", { locale: es });
                })()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tabla de clientes */}
      {clients.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No hay clientes activos disponibles</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    disabled={isPending}
                  />
                </TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => {
                const isSelected = selectedClients.includes(client.id);
                return (
                  <TableRow
                    key={client.id}
                    className={isSelected ? "bg-accent/50" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleClient(client.id)}
                        disabled={isPending}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className="h-4 w-4 rounded-full shrink-0"
                          style={{ backgroundColor: client.color }}
                        />
                        <span className="font-medium">{client.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        Listo para generar
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Botón de acción */}
      <div className="flex justify-end">
        <Button
          onClick={handleGenerate}
          disabled={isPending || selectedClients.length === 0}
          size="lg"
          className="min-w-[200px]"
        >
          {isPending ? (
            <>
              <Wand2 className="mr-2 h-4 w-4 animate-spin" />
              Generando...
            </>
          ) : (
            <>
              <Wand2 className="mr-2 h-4 w-4" />
              Generar Plan para {selectedClients.length} Cliente
              {selectedClients.length !== 1 ? "s" : ""}
            </>
          )}
        </Button>
      </div>

      {/* Información del plan - Dinámico según selección */}
      <Card className="bg-muted/50">
        <div className="p-4">
          <h3 className="text-sm font-semibold mb-2">
            {planType === "STANDARD" ? "Plan Estándar Incluye:" : "Plan 2 Incluye:"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground mb-1">
                Reels ({planStats.videos}):
              </p>
              <ul className="list-disc list-inside space-y-0.5">
                {Array.from({ length: planStats.videos }, (_, i) => (
                  <li key={i}>Reel {i + 1}: (Tema por definir)</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">
                Flyers ({planStats.images}):
              </p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Flyer: (Tema por definir)</li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Total: {planStats.total} tareas por cliente ({planStats.videos} Videos, {planStats.images} Imagen) • Estado inicial: IDEA • Distribuidas equitativamente a lo largo del mes seleccionado
          </p>
        </div>
      </Card>
    </div>
  );
}

