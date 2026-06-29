"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { createProfitDistribution } from "@/actions/finance-funds-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

interface CreateProfitDistributionFormProps {
  preview: {
    netProfit: number;
    fundContribution: number;
    distributableAmount: number;
    eligibleUsers: Array<{
      userId: string;
      userName: string;
      profitSharePercent: number;
    }>;
  };
  currentYear: number;
  currentMonth: number;
  onSuccess: () => void;
}

export function CreateProfitDistributionForm({
  preview,
  currentYear,
  currentMonth,
  onSuccess,
}: CreateProfitDistributionFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState("");

  const handleCreate = async () => {
    setIsSubmitting(true);
    try {
      const items = preview.eligibleUsers.map((u) => ({
        userId: u.userId,
        percent: u.profitSharePercent,
        amount: Math.round(preview.distributableAmount * (u.profitSharePercent / 100) * 100) / 100,
      }));

      const result = await createProfitDistribution({
        year: currentYear,
        month: currentMonth,
        totalProfit: preview.netProfit,
        fundContribution: preview.fundContribution,
        distributableAmount: preview.distributableAmount,
        notes: notes || undefined,
        items,
      });

      if (result.success) {
        toast({ title: "Distribución creada en borrador" });
        onSuccess();
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Utilidad neta</p>
          <p className="text-lg font-bold">${preview.netProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Al fondo</p>
          <p className="text-lg font-bold text-amber-600">${preview.fundContribution.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">A distribuir</p>
          <p className="text-lg font-bold text-emerald-600">${preview.distributableAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Eligible users */}
      <div className="space-y-2">
        <Label>Reparto por socio</Label>
        <div className="rounded-lg border divide-y">
          {preview.eligibleUsers.map((user) => {
            const amount = Math.round(preview.distributableAmount * (user.profitSharePercent / 100) * 100) / 100;
            return (
              <div key={user.userId} className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium">{user.userName}</p>
                  <p className="text-xs text-muted-foreground">{user.profitSharePercent}%</p>
                </div>
                <p className="text-sm font-semibold text-emerald-600">
                  ${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Input
          id="notes"
          placeholder="Observaciones sobre esta distribución..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button onClick={handleCreate} disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Crear como borrador
        </Button>
      </div>
    </div>
  );
}
