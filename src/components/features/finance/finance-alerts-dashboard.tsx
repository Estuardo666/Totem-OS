"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RefreshCcw, ShieldAlert, ShieldCheck, ShieldX, HelpCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  evaluateFinanceAlerts,
  getFinanceAlerts,
  getFinanceAlertRules,
  updateFinanceAlertRule,
  updateFinanceAlertStatus,
} from "@/actions/finance-alerts-actions";

export type FinanceAlertView = {
  id: string;
  type: string;
  severity: string;
  status: string;
  title: string;
  message: string;
  createdAt: Date;
};

export type FinanceAlertRuleView = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  severity: string;
  config: string;
};

interface FinanceAlertsDashboardProps {
  initialAlerts: FinanceAlertView[];
  initialRules: FinanceAlertRuleView[];
}

const severityConfig: Record<string, { label: string; className: string }> = {
  LOW: { label: "Baja", className: "bg-emerald-100 text-emerald-800" },
  MEDIUM: { label: "Media", className: "bg-amber-100 text-amber-800" },
  HIGH: { label: "Alta", className: "bg-orange-100 text-orange-800" },
  CRITICAL: { label: "Crítica", className: "bg-red-100 text-red-800" },
};

const statusConfig: Record<string, { label: string; className: string; icon: ReactNode }> = {
  ACTIVE: {
    label: "Activa",
    className: "bg-red-100 text-red-800",
    icon: <ShieldAlert className="h-4 w-4" />,
  },
  ACKNOWLEDGED: {
    label: "En seguimiento",
    className: "bg-amber-100 text-amber-800",
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  RESOLVED: {
    label: "Resuelta",
    className: "bg-emerald-100 text-emerald-800",
    icon: <ShieldX className="h-4 w-4" />,
  },
};

export function FinanceAlertsDashboard({ initialAlerts, initialRules }: FinanceAlertsDashboardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<FinanceAlertView[]>(initialAlerts);
  const [rules, setRules] = useState<FinanceAlertRuleView[]>(initialRules);
  const [isPending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);

  const groupedAlerts = useMemo(() => {
    const active = alerts.filter((alert) => alert.status === "ACTIVE");
    const acknowledged = alerts.filter((alert) => alert.status === "ACKNOWLEDGED");
    const resolved = alerts.filter((alert) => alert.status === "RESOLVED");
    return { active, acknowledged, resolved };
  }, [alerts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const result = await evaluateFinanceAlerts();
    if (result.success) {
      const refreshed = await getFinanceAlerts();
      if (refreshed.success && refreshed.data) {
        setAlerts(refreshed.data as FinanceAlertView[]);
      }
      toast({
        title: "Alertas evaluadas",
        description: "Se actualizaron las alertas predictivas.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.error || "No se pudieron evaluar las alertas",
      });
    }
    setRefreshing(false);
  };

  const handleStatusChange = (alertId: string, status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED") => {
    startTransition(async () => {
      const result = await updateFinanceAlertStatus(alertId, status);
      if (result.success) {
        setAlerts((prev) => prev.map((alert) => (alert.id === alertId ? { ...alert, status } : alert)));
        toast({
          title: "Estado actualizado",
          description: "La alerta fue actualizada correctamente.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo actualizar la alerta",
        });
      }
    });
  };

  const handleRuleUpdate = (ruleId: string, updates: Partial<FinanceAlertRuleView>) => {
    startTransition(async () => {
      const result = await updateFinanceAlertRule(ruleId, updates);
      if (result.success) {
        setRules((prev) =>
          prev.map((rule) => (rule.id === ruleId ? { ...rule, ...(result.data as FinanceAlertRuleView) } : rule))
        );
        toast({
          title: "Regla actualizada",
          description: "La configuración fue guardada.",
        });
        const refreshed = await getFinanceAlertRules();
        if (refreshed.success && refreshed.data) {
          setRules(refreshed.data as FinanceAlertRuleView[]);
        }
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo actualizar la regla",
        });
      }
    });
  };

  const handleConfigSave = (rule: FinanceAlertRuleView) => {
    try {
      JSON.parse(rule.config);
      handleRuleUpdate(rule.id, { config: rule.config });
    } catch {
      toast({
        variant: "destructive",
        title: "JSON inválido",
        description: "La configuración debe ser un JSON válido.",
      });
    }
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Alertas predictivas
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Las alertas predictivas analizan tus datos financieros para detectar riesgos y oportunidades antes de que se conviertan en problemas críticos.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>
              Controla la salud financiera y anticipa riesgos de liquidez, rentabilidad y costos.
            </CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleRefresh} disabled={refreshing}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  {refreshing ? "Evaluando..." : "Evaluar alertas"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Ejecuta todas las reglas de alertas para detectar nuevos riesgos financieros basados en los datos actuales.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <SummaryCard title="Activas" value={groupedAlerts.active.length} tone="text-red-600" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Alertas que requieren atención inmediata. Representan riesgos financieros activos que podrían impactar negativamente el negocio.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <SummaryCard title="En seguimiento" value={groupedAlerts.acknowledged.length} tone="text-amber-600" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Alertas vistas pero aún no resueltas. Están siendo monitoreadas mientras se implementan soluciones.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <SummaryCard title="Resueltas" value={groupedAlerts.resolved.length} tone="text-emerald-600" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Alertas que han sido solucionadas exitosamente. Sirven como histórico de problemas financieros superados.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Alertas recientes
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Lista de todas las alertas financieras detectadas. Prioriza las alertas activas y críticas para mantener la salud financiera.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <CardDescription>Prioriza las alertas activas y asigna seguimiento.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1">
                          Estado
                          <HelpCircle className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Estado actual de la alerta: Activa (requiere acción), En seguimiento (vista pero no resuelta), Resuelta (solucionada).</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1">
                          Severidad
                          <HelpCircle className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Nivel de impacto: Crítica (afecta gravemente el negocio), Alta (impacto significativo), Media (atención requerida), Baja (monitoreo).</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead>Alerta</TableHead>
                  <TableHead>Mensaje</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No hay alertas registradas.
                    </TableCell>
                  </TableRow>
                )}
                {alerts.map((alert) => {
                  const severity = severityConfig[alert.severity] ?? severityConfig.MEDIUM;
                  const status = statusConfig[alert.status] ?? statusConfig.ACTIVE;
                  return (
                    <TableRow key={alert.id}>
                      <TableCell>
                        <Badge className={status.className}>
                          <span className="mr-2">{status.icon}</span>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={severity.className}>{severity.label}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{alert.title}</TableCell>
                      <TableCell className="max-w-sm text-sm text-muted-foreground">
                        {alert.message}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleStatusChange(alert.id, "ACKNOWLEDGED")}
                                  disabled={isPending || alert.status === "ACKNOWLEDGED"}
                                >
                                  En seguimiento
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Marca la alerta como reconocida. Indica que has visto el riesgo y estás trabajando en una solución.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  onClick={() => handleStatusChange(alert.id, "RESOLVED")}
                                  disabled={isPending || alert.status === "RESOLVED"}
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Resolver
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Marca la alerta como resuelta. Indica que el problema financiero ha sido solucionado completamente.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Motor de reglas
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Configura las reglas que detectan automáticamente riesgos financieros. Cada regla evalúa diferentes aspectos de tu salud financiera.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <CardDescription>Activa o ajusta las reglas de alertas predictivas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h4 className="font-semibold">{rule.name}</h4>
                  <p className="text-sm text-muted-foreground">{rule.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Badge className={severityConfig[rule.severity]?.className ?? "bg-amber-100 text-amber-800"}>
                            {severityConfig[rule.severity]?.label ?? rule.severity}
                          </Badge>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Nivel de severidad que asignará esta regla a las alertas que genere.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`rule-${rule.id}`} className="text-sm">
                            {rule.enabled ? "Activa" : "Inactiva"}
                          </Label>
                          <Switch
                            id={`rule-${rule.id}`}
                            checked={rule.enabled}
                            onCheckedChange={(checked) => handleRuleUpdate(rule.id, { enabled: checked })}
                            disabled={isPending}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{rule.enabled ? "Desactiva esta regla para que no genere más alertas." : "Activa esta regla para empezar a detectar este tipo de riesgos financieros."}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-[1fr,220px]">
                <div className="space-y-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Label className="text-sm flex items-center gap-1">
                          Configuración (JSON)
                          <HelpCircle className="h-3 w-3" />
                        </Label>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Parámetros de configuración de la regla en formato JSON. Define umbrales, límites y condiciones específicas.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Textarea
                    rows={4}
                    value={rule.config}
                    onChange={(event) =>
                      setRules((prev) =>
                        prev.map((item) =>
                          item.id === rule.id ? { ...item, config: event.target.value } : item
                        )
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Label className="text-sm flex items-center gap-1">
                          Severidad
                          <HelpCircle className="h-3 w-3" />
                        </Label>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Define el nivel de impacto de las alertas generadas por esta regla.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Input
                    value={rule.severity}
                    onChange={(event) =>
                      setRules((prev) =>
                        prev.map((item) =>
                          item.id === rule.id ? { ...item, severity: event.target.value } : item
                        )
                      )
                    }
                  />
                  <Button onClick={() => handleRuleUpdate(rule.id, { severity: rule.severity })} disabled={isPending}>
                    Actualizar severidad
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleConfigSave(rule)}
                    disabled={isPending}
                  >
                    Guardar configuración
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ title, value, tone }: { title: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className={`text-3xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
