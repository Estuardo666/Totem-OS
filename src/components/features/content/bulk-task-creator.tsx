"use client";

import { useMemo, useState, useTransition } from "react";
import type { Client } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { createTasksBatch } from "@/actions/content-actions";
import type { ContentTaskType } from "@/types";

interface BulkTaskCreatorProps {
  clients: Client[];
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

export function BulkTaskCreator({ clients }: BulkTaskCreatorProps) {
  const [rawInput, setRawInput] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedTaskRow[]>([]);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const clientByName = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach((client) => {
      map.set(normalize(client.name), client);
    });
    return map;
  }, [clients]);

  const validRows = useMemo(() => parsedRows.filter((row) => !row.error && row.clientId && row.type && row.title && row.scheduledAt), [parsedRows]);

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
            title: row.title!,
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
            description: result.data?.errors.length
              ? `Algunas filas fallaron: ${result.data.errors.join("; ")}`
              : "Se crearon todas las tareas exitosamente",
          });
          setParsedRows([]);
          setRawInput("");
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crear tareas en lote</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={rawInput}
            onChange={(event) => setRawInput(event.target.value)}
            placeholder={`Ejemplo:\nGermania\nReel,Nombre de la tarea, 03/02\nFlyer,Otra tarea, 15-02\nStory,Nueva campaña, 12 de febrero`}
            className="min-h-[160px]"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleParse} disabled={isPending}>
              Analizar texto
            </Button>
            <Button type="button" onClick={handleCreate} disabled={!validRows.length || isPending}>
              {isPending ? "Creando..." : `Crear ${validRows.length} tareas`}
            </Button>
            {hasRows && (
              <Badge variant="secondary">{validRows.length} válidas / {parsedRows.length} totales</Badge>
            )}
          </div>
        </div>

        {hasRows && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Fecha programada</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedRows.map((row, index) => (
                  <TableRow key={`${row.rawLine}-${index}`} className={row.error ? "bg-destructive/5" : ""}>
                    <TableCell>{row.clientName}</TableCell>
                    <TableCell>{row.type ?? row.typeLabel ?? "-"}</TableCell>
                    <TableCell>{row.title ?? "-"}</TableCell>
                    <TableCell>
                      {row.scheduledAt
                        ? row.scheduledAt.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" }) + " 20:00"
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {row.error ? (
                        <Badge variant="destructive">{row.error}</Badge>
                      ) : (
                        <Badge variant="secondary">Listo</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
