"use client";

import { useState } from "react";
import { Loader2, ArrowDownRight } from "lucide-react";
import { requestEmergencyWithdrawal } from "@/actions/finance-funds-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

interface EmergencyWithdrawalFormProps {
  currentBalance: number;
  onSuccess: () => void;
}

export function EmergencyWithdrawalForm({
  currentBalance,
  onSuccess,
}: EmergencyWithdrawalFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const now = new Date();

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast({ variant: "destructive", title: "Error", description: "Ingresa un monto válido" });
      return;
    }
    if (parsedAmount > currentBalance) {
      toast({ variant: "destructive", title: "Error", description: "Saldo insuficiente" });
      return;
    }
    if (!reason.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Indica el motivo del retiro" });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await requestEmergencyWithdrawal({
        amount: parsedAmount,
        reason: reason.trim(),
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      });

      if (result.success) {
        toast({
          title: "Retiro registrado",
          description: "Usa el botón 'Ejecutar' en la tabla para crear la transacción de egreso.",
        });
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
        <p className="text-sm text-muted-foreground">Saldo disponible</p>
        <p className="text-2xl font-bold text-emerald-600">
          ${currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Monto a retirar ($)</Label>
        <Input
          id="amount"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">Motivo del retiro</Label>
        <Input
          id="reason"
          placeholder="Ej: Pago de emergencia a proveedor..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ArrowDownRight className="mr-2 h-4 w-4" />
          )}
          Registrar retiro
        </Button>
      </div>
    </div>
  );
}
