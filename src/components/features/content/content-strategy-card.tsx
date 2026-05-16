"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Target } from "lucide-react";
import { upsertContentMonthlyStrategy } from "@/actions/content-strategy-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  formatAccountDate,
  getContentStrategyNote,
  type ContentMonthlyStrategyDraft,
  type ContentMonthlyStrategyRecord,
} from "./content-accounts-utils";

interface ContentStrategyCardProps {
  clientId: string;
  selectedMonth: string;
  strategyRecord: ContentMonthlyStrategyRecord | null;
  onSaved: (strategy: ContentMonthlyStrategyRecord) => void;
}

function formatDateInput(date: Date | null) {
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string) {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function StrategyChoice({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/60 px-3 py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={value
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700"
              : "text-emerald-700 hover:text-emerald-700"
            }
            disabled={disabled}
            onClick={() => onChange(true)}
          >
            Sí
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={!value
              ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50 hover:text-rose-700"
              : "text-rose-700 hover:text-rose-700"
            }
            disabled={disabled}
            onClick={() => onChange(false)}
          >
            No
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ContentStrategyCard({
  clientId,
  selectedMonth,
  strategyRecord,
  onSaved,
}: ContentStrategyCardProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const savedDraft = useMemo<ContentMonthlyStrategyDraft>(
    () => ({
      prepared: strategyRecord?.prepared ?? false,
      sentAt: strategyRecord?.sentAt ?? null,
      approved: strategyRecord?.prepared ? strategyRecord.approved : false,
    }),
    [strategyRecord]
  );
  const [draft, setDraft] = useState<ContentMonthlyStrategyDraft>(savedDraft);

  useEffect(() => {
    setDraft(savedDraft);
  }, [savedDraft]);

  const note = useMemo(() => getContentStrategyNote(draft), [draft]);
  const hasChanges =
    draft.prepared !== savedDraft.prepared ||
    draft.approved !== savedDraft.approved ||
    formatDateInput(draft.sentAt) !== formatDateInput(savedDraft.sentAt);

  const handlePreparedChange = (prepared: boolean) => {
    setDraft((current) => ({
      prepared,
      sentAt: prepared ? current.sentAt : null,
      approved: prepared ? current.approved : false,
    }));
  };

  const handleApprovalChange = (approved: boolean) => {
    setDraft((current) => {
      if (!current.prepared) {
        return current;
      }

      return {
        ...current,
        approved,
      };
    });
  };

  const handleSave = () => {
    const [year, month] = selectedMonth.split("-").map(Number);

    startTransition(async () => {
      const result = await upsertContentMonthlyStrategy({
        clientId,
        month,
        year,
        prepared: draft.prepared,
        sentAt: draft.prepared ? draft.sentAt : null,
        approved: draft.prepared ? draft.approved : false,
      });

      if (!result.success || !result.data) {
        toast({
          variant: "destructive",
          title: "No se pudo guardar la estrategia",
          description: result.error || "Intenta nuevamente.",
        });
        return;
      }

      onSaved(result.data);
      toast({
        title: "Estrategia actualizada",
        description: "La cuenta ya tiene tracking mensual guardado.",
      });
    });
  };

  return (
    <Card className="rounded-3xl border-border/70">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4" />
          Estado de estrategia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <StrategyChoice
          label="Estrategia elaborada este mes"
          value={draft.prepared}
          disabled={isPending}
          onChange={handlePreparedChange}
        />

        <div className="rounded-2xl border border-border/60 px-3 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <span className="text-sm font-medium">Fecha de envío al cliente</span>
            <div className="flex flex-col gap-2 md:w-auto md:flex-row">
              <Input
                type="date"
                value={formatDateInput(draft.sentAt)}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    sentAt: current.prepared ? parseDateInput(event.target.value) : null,
                  }))
                }
                disabled={!draft.prepared || isPending}
                className="h-9 rounded-full md:w-[190px]"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={!draft.prepared || !draft.sentAt || isPending}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    sentAt: null,
                    approved: false,
                  }))
                }
              >
                Limpiar
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {draft.sentAt
              ? `Registrada para ${formatAccountDate(draft.sentAt)}`
              : draft.prepared
                ? "Pendiente de registrar envío al cliente."
                : "Marca primero si la estrategia sí fue elaborada este mes."
            }
          </p>
        </div>

        <StrategyChoice
          label="Cliente aprobó la estrategia"
          value={draft.prepared ? draft.approved : false}
          disabled={!draft.prepared || isPending}
          onChange={handleApprovalChange}
        />

        <div className="rounded-2xl border border-border/60 px-3 py-3">
          <p className="text-sm font-medium">{note}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {strategyRecord
              ? `Última actualización ${formatAccountDate(strategyRecord.updatedAt)}`
              : "Todavía no hay un registro guardado para este cliente en este mes."
            }
          </p>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            className="rounded-full"
            disabled={!hasChanges || isPending}
            onClick={handleSave}
          >
            {isPending ? "Guardando..." : "Guardar estrategia"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}