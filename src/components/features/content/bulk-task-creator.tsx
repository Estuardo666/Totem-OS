"use client";

import { useMemo, useState, useTransition } from "react";
import type { Client } from "@prisma/client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { createTasksBatch } from "@/actions/content-actions";
import type { ContentTaskType } from "@/types";
import { CheckCircle } from "lucide-react";

interface BulkTaskCreatorProps {
  clients: Client[];
  variant?: "card" | "dialog";
  showHeader?: boolean;
  onSuccess?: () => void;
}

interface ParsedTaskRow {
  clientName: string;
  clientId?: string;
  typeLabel?: string;
  type?: ContentTaskType;
  title?: string;
  scheduledAt?: Date;
  dueDate?: Date;
  error?: string;
  rawLine: string;
}

const DIACRITIC_REGEX = /[\u0300-\u036f]/g;

const TYPE_LABELS: Record<string, ContentTaskType> = {
  REEL: "REEL",
  FLYER: "FLYER",
  FLYERS: "FLYER",
  STORY: "STORY",
  STORIES: "STORY",
};

const capitalizeFirst = (value?: string | null) => {
  if (!value) return value ?? "";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const formatTypeLabel = (value?: string | null) => {
  if (!value) return "-";
  const lower = value.toString().toLowerCase();
  return capitalizeFirst(lower);
};

const MONTH_LABELS: Record<string, number> = {
  ene: 1,
  enero: 1,
  feb: 2,
  febrero: 2,
  mar: 3,
  marzo: 3,
  abr: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  jul: 7,
  julio: 7,
  ago: 8,
  agosto: 8,
  sep: 9,
  sept: 9,
  set: 9,
  setiembre: 9,
  septiembre: 9,
  oct: 10,
  octubre: 10,
  nov: 11,
  noviembre: 11,
  dic: 12,
  diciembre: 12,
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(DIACRITIC_REGEX, "")
    .toLowerCase()
    .trim();
}

function parseDate(input: string | undefined): { scheduled: Date | undefined; due: Date | undefined; error?: string } {
  if (!input) {
    return { scheduled: undefined, due: undefined, error: "Fecha faltante" };
  }

  const normalized = input
    .normalize("NFD")
    .replace(DIACRITIC_REGEX, "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return { scheduled: undefined, due: undefined, error: "Formato de fecha inválido" };
  }

  const currentYear = new Date().getFullYear();
  const resolveYear = (yearStr?: string) => {
    if (!yearStr) return currentYear;
    const numericYear = Number(yearStr);
    if (Number.isNaN(numericYear)) return undefined;
    if (yearStr.length === 2) {
      return Number(`20${yearStr.padStart(2, "0")}`);
    }
    return numericYear;
  };

  const buildResult = (day: number, month: number, yearStr?: string) => {
    const year = resolveYear(yearStr);
    if (!year) {
      return { scheduled: undefined, due: undefined, error: "Año inválido" };
    }
    if (day < 1 || day > 31 || month < 1 || month > 12) {
      return { scheduled: undefined, due: undefined, error: "Fecha fuera de rango" };
    }

    const scheduled = new Date(year, month - 1, day, 20, 0, 0, 0);
    if (
      Number.isNaN(scheduled.getTime()) ||
      scheduled.getDate() !== day ||
      scheduled.getMonth() !== month - 1 ||
      scheduled.getFullYear() !== year
    ) {
      return { scheduled: undefined, due: undefined, error: "Fecha inválida" };
    }

    const due = new Date(scheduled.getTime() - 24 * 60 * 60 * 1000);
    return { scheduled, due };
  };

  const numericMatch = normalized.match(/^(\d{1,2})[\/\-\s](\d{1,2})(?:[\/\-\s](\d{2,4}))?$/);
  if (numericMatch) {
    const [, dayStr, monthStr, yearStr] = numericMatch;
    return buildResult(Number(dayStr), Number(monthStr), yearStr);
  }

  const dayMonthWordMatch = normalized.match(/^(\d{1,2})\s*(?:de\s+)?([a-z]+)(?:\s*(?:de)?\s*(\d{2,4}))?$/);
  if (dayMonthWordMatch) {
    const [, dayStr, monthLabel, yearStr] = dayMonthWordMatch;
    const month = MONTH_LABELS[monthLabel];
    if (!month) {
      return { scheduled: undefined, due: undefined, error: "Mes inválido" };
    }
    return buildResult(Number(dayStr), month, yearStr);
  }

  const monthDayWordMatch = normalized.match(/^([a-z]+)\s*(\d{1,2})(?:\s*(?:de)?\s*(\d{2,4}))?$/);
  if (monthDayWordMatch) {
    const [, monthLabel, dayStr, yearStr] = monthDayWordMatch;
    const month = MONTH_LABELS[monthLabel];
    if (!month) {
      return { scheduled: undefined, due: undefined, error: "Mes inválido" };
    }
    return buildResult(Number(dayStr), month, yearStr);
  }

  return { scheduled: undefined, due: undefined, error: "Formato de fecha inválido" };
}

export function BulkTaskCreator({ clients, variant = "card", showHeader = true, onSuccess }: BulkTaskCreatorProps) {
  const [rawInput, setRawInput] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedTaskRow[]>([]);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const isDialog = variant === "dialog";
  const shouldShowHeader = !isDialog && showHeader;

  const clientByName = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach((client) => {
      map.set(normalize(client.name), client);
    });
    return map;
  }, [clients]);

  const clientById = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach((client) => {
      map.set(client.id, client);
    });
    return map;
  }, [clients]);

  const validRows = useMemo(() => parsedRows.filter((row) => !row.error && row.clientId && row.type && row.title && row.scheduledAt), [parsedRows]);

  const currentClient = useMemo(() => {
    const firstWithClient = parsedRows.find((row) => row.clientId);
    if (!firstWithClient?.clientId) return null;
    const client = clientById.get(firstWithClient.clientId);
    return {
      name: client?.name ?? firstWithClient.clientName,
      logo: client?.logo,
      color: client?.color,
      initial: (client?.name ?? firstWithClient.clientName ?? "?").charAt(0).toUpperCase(),
    };
  }, [clientById, parsedRows]);

  const hasRows = parsedRows.length > 0;

  const handleParse = () => {
    if (!rawInput.trim()) {
      toast({
        variant: "destructive",
        title: "Sin texto",
        description: "Pega el listado de tareas para continuar",
      });
      return;
    }

    const lines = rawInput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    let currentClientName: string | null = null;
    const rows: ParsedTaskRow[] = [];

    for (const line of lines) {
      const commaCount = line.split(",").length - 1;
      const looksLikeTask = commaCount >= 2;

      if (!looksLikeTask) {
        currentClientName = line.replace(/:$/, "");
        continue;
      }

      const [typePart, titlePart, datePart] = line.split(",");
      const clientName = currentClientName ?? "(Sin cliente)";
      const normalizedClient = normalize(clientName);
      const client = clientByName.get(normalizedClient);

      const normalizedType = typePart?.replace(/[^a-zA-Z]/g, "").toUpperCase();
      const type = normalizedType ? TYPE_LABELS[normalizedType] : undefined;

      const title = titlePart?.trim();
      const { scheduled, due, error: dateError } = parseDate(datePart?.trim());

      const errors: string[] = [];
      if (!client) errors.push("Cliente no encontrado");
      if (!type) errors.push("Tipo inválido");
      if (!title) errors.push("Título faltante");
      if (dateError || !scheduled) errors.push(dateError ?? "Fecha inválida");

      rows.push({
        clientName,
        clientId: client?.id,
        typeLabel: typePart?.trim(),
        type,
        title,
        scheduledAt: scheduled,
        dueDate: due,
        rawLine: line,
        error: errors.length ? errors.join(" | ") : undefined,
      });
    }

    setParsedRows(rows);

    if (!rows.length) {
      toast({
        variant: "destructive",
        title: "Formato no reconocido",
        description: "Asegúrate de seguir el formato Cliente + líneas Tipo,Título,Fecha",
      });
    }
  };

  const handleCreate = () => {
    if (!validRows.length) {
      toast({
        variant: "destructive",
        title: "Sin filas válidas",
        description: "Corrige los errores antes de crear",
      });
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          tasks: validRows.map((row) => ({
            title: capitalizeFirst(row.title!),
            type: row.type!,
            clientId: row.clientId!,
            scheduledAt: row.scheduledAt?.toISOString(),
            dueDate: row.dueDate?.toISOString(),
            priority: "MEDIUM",
            status: "IDEA",
          })),
        };

        const result = await createTasksBatch(payload);
        if (result.success) {
          toast({
            title: `${result.data?.created.length ?? 0} tareas creadas`,
            description: (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>
                  {result.data?.errors.length
                    ? `Algunas filas fallaron: ${result.data.errors.join("; ")}`
                    : "Se crearon todas las tareas exitosamente"}
                </span>
              </div>
            ),
          });
          setParsedRows([]);
          setRawInput("");
          onSuccess?.();
        } else {
          toast({
            variant: "destructive",
            title: "Error al crear tareas",
            description: result.error ?? "Intenta nuevamente",
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error inesperado",
          description: error instanceof Error ? error.message : "Intenta nuevamente",
        });
      }
    });
  };

  const body = (
    <div className="space-y-4">
      <div className="space-y-3.5">
        <Textarea
          value={rawInput}
          onChange={(event) => setRawInput(event.target.value)}
          placeholder={`Ejemplo:\nGermania\nReel,Nombre de la tarea, 03/02\nFlyer,Otra tarea, 15-02\nStory,Nueva campaña, 12 de febrero`}
          className="min-h-[160px] border-2 border-border rounded-2xl focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0 bg-background/50 text-foreground placeholder:text-muted-foreground/60 resize-none"
        />
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleParse}
              disabled={isPending}
              className="w-full border-2 border-border rounded-full h-11 font-medium hover:bg-muted/50 hover:border-border/60"
            >
              Analizar texto
            </Button>
            <Button 
              type="button" 
              onClick={handleCreate} 
              disabled={!hasRows || isPending} 
              className="w-full rounded-full h-11 font-medium bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md hover:shadow-lg transition-all"
            >
              {isPending ? "Creando..." : `Crear ${validRows.length}`}
            </Button>
          </div>
          {hasRows && (
            <div className="px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                ✓ {validRows.length} válidas / {parsedRows.length} totales
              </p>
            </div>
          )}
        </div>
      </div>

      {hasRows && (
        <div className="rounded-2xl border border-border bg-gradient-to-br from-background to-background/50 overflow-hidden">
          <div className="max-h-[300px] overflow-y-auto custom-scroll">
            {currentClient && (
              <div className="flex flex-col items-center gap-2 px-6 py-4 text-center border-b border-border/50">
                {currentClient.logo ? (
                  <img src={currentClient.logo} alt={currentClient.name} className="h-10 w-10 rounded-lg object-cover ring-2 ring-border/30" />
                ) : (
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold uppercase text-white shadow-md"
                    style={{ backgroundColor: currentClient.color || "var(--primary)" }}
                  >
                    {currentClient.initial}
                  </div>
                )}
                <div className="text-base font-semibold">{currentClient.name}</div>
              </div>
            )}
            <div className="divide-y divide-border/50">
              {parsedRows.map((row, index) => (
                <div
                  key={`${row.rawLine}-${index}`}
                  className={`px-6 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors ${
                    row.error ? "bg-destructive/5 hover:bg-destructive/10" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase text-primary px-2 py-1 bg-primary/10 rounded-lg">
                        {formatTypeLabel(row.type ?? row.typeLabel)}
                      </span>
                      {!row.error && (
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Listo</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-foreground truncate">{capitalizeFirst(row.title) ?? "-"}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.scheduledAt
                        ? row.scheduledAt.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" })
                        : "-"}
                    </p>
                  </div>
                  {row.error && (
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs font-medium text-destructive max-w-[100px]">{row.error}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isDialog) {
    return body;
  }

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-background to-background/50 p-6 space-y-4">
      {shouldShowHeader && (
        <div className="space-y-1.5">
          <h3 className="text-2xl font-bold">Crear tareas en lote</h3>
          <p className="text-sm text-muted-foreground">Pega un listado de tareas para crear múltiples tareas a la vez</p>
        </div>
      )}
      {body}
    </div>
  );
}
