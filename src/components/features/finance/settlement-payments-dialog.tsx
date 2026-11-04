"use client";

import { Info, Wallet } from "lucide-react";
import type { SettlementPayment } from "@/actions/finance-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/currency-format";

interface SettlementPaymentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  month: number;
  year: number;
  payments: SettlementPayment[];
}

// Las fechas se muestran en hora de Ecuador: es el mismo criterio con el que
// la liquidación decide a qué mes pertenece cada pago.
const dayFormatter = new Intl.DateTimeFormat("es-EC", {
  day: "numeric",
  month: "short",
  timeZone: "America/Guayaquil",
});

const KIND_LABELS: Record<SettlementPayment["kind"], string> = {
  HONORARIOS: "Honorarios",
  SALARY: "Sueldo",
};

/** Detalle de "Pagado hasta ahora": cada pago que suma la tarjeta. */
export function SettlementPaymentsDialog({
  open,
  onOpenChange,
  userName,
  month,
  year,
  payments,
}: SettlementPaymentsDialogProps) {
  const firstName = userName.trim().split(/\s+/)[0] || userName;
  const monthLabel = new Intl.DateTimeFormat("es-EC", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 15))
  );
  const total = payments.reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto custom-scroll">
        <DialogHeader>
          <DialogTitle>
            Pagos a {firstName} en {monthLabel}
          </DialogTitle>
          <DialogDescription>
            Estos son los pagos que suma &quot;Pagado hasta ahora&quot;: honorarios y sueldos registrados como
            pagados en el mes, según la hora de Ecuador. Los repartos de utilidades no se cuentan aquí.
          </DialogDescription>
        </DialogHeader>

        {payments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Wallet className="h-10 w-10 text-muted-foreground" aria-hidden />
            <p className="font-medium">Sin pagos este mes</p>
            <p className="text-sm text-muted-foreground">Todavía no hay pagos registrados a {firstName}.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-end justify-between gap-4 rounded-xl bg-green-50 p-4 dark:bg-green-950/20">
              <div>
                <p className="text-sm text-muted-foreground">Pagado en {monthLabel.split(" ")[0]}</p>
                <p className="text-3xl font-bold tabular-nums text-green-600">{formatCurrency(total)}</p>
              </div>
              <p className="text-right text-sm text-muted-foreground">
                {payments.length} {payments.length === 1 ? "pago" : "pagos"}
              </p>
            </div>

            <ul className="space-y-2" aria-label={`Pagos a ${firstName}`}>
              {payments.map((payment) => (
                <li key={payment.id} className="flex items-start gap-3 rounded-lg bg-muted/40 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium">{payment.description || KIND_LABELS[payment.kind]}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {dayFormatter.format(new Date(payment.paidAt))} · {KIND_LABELS[payment.kind]}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums">{formatCurrency(payment.amount)}</p>
                </li>
              ))}
            </ul>

            <p className="flex gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                ¿Falta o sobra un pago? Corrígelo en <strong>Finanzas → Transacciones</strong> y vuelve a abrir esta
                página.
              </span>
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
