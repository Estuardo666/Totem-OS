"use client";

import { useState } from "react";
import { Loader2, ArrowUpRight } from "lucide-react";
import { recordEmergencyContribution } from "@/actions/finance-funds-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

interface EmergencyContributionFormProps {
  currentBalance: number;
  onSuccess: () => void;
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/**
 * Registra cuánto dinero quedó en caja después de un reparto.
 *
 * El monto se anota al final, cuando ya se pagaron reembolsos y honorarios y
 * se ve lo que sobró. Por eso se escribe a mano y no se calcula solo.
 */
export function EmergencyContributionForm({
  currentBalance,
  onSuccess,
}: EmergencyContributionFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  const parsedAmount = parseFloat(amount);
  const nuevoSaldo =
    Number.isFinite(parsedAmount) && parsedAmount > 0
      ? currentBalance + parsedAmount
      : currentBalance;

  const handleSubmit = async () => {
    if (!parsedAmount || parsedAmount <= 0) {
      toast({ variant: "destructive", title: "Error", description: "Ingresa un monto válido" });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await recordEmergencyContribution({
        amount: parsedAmount,
        month: Number(month),
        year: Number(year),
        reason: reason.trim() || undefined,
      });

      if (result.success) {
        toast({
          title: "Aporte registrado",
          description: `Saldo en caja: $${(result.data?.newBalance ?? nuevoSaldo).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        });
        setAmount("");
        setReason("");
        onSuccess();
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 bg-muted/50">
        <p className="text-sm text-muted-foreground">Saldo actual en caja</p>
        <p className="text-2xl font-bold text-emerald-600">
          ${currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contribution-amount">¿Cuánto quedó en caja? ($)</Label>
        <Input
          id="contribution-amount"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Lo que sobró después de pagar reembolsos y honorarios.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="contribution-month">Mes</Label>
          <select
            id="contribution-month"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {MESES.map((nombre, i) => (
              <option key={nombre} value={String(i + 1)}>
                {nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="contribution-year">Año</Label>
          <Input
            id="contribution-year"
            type="number"
            min="2020"
            max="2100"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contribution-reason">Nota (opcional)</Label>
        <Input
          id="contribution-reason"
          placeholder="Ej: Sobrante del reparto de la segunda quincena"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      {parsedAmount > 0 && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
          Saldo después de este aporte:{" "}
          <span className="font-semibold text-emerald-600">
            ${nuevoSaldo.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ArrowUpRight className="mr-2 h-4 w-4" />
          )}
          Registrar aporte
        </Button>
      </div>
    </div>
  );
}
