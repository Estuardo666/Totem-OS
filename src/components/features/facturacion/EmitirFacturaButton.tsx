"use client";

// Botón para emitir Factura Electrónica desde un Invoice existente
// Se usa en /finance/receivables/[id]

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Receipt, Loader2, CheckCircle, ExternalLink } from "lucide-react";
import { emitirDesdeInvoiceAction } from "@/actions/admin/facturacion/facturas";
import Link from "next/link";

interface EmitirFacturaButtonProps {
  invoiceId: string;
  clientId: string;
  clientName: string;
  amount: number;
  yaFacturado?: boolean;
  facturaId?: string | null;
}

export function EmitirFacturaButton({
  invoiceId,
  clientId,
  clientName,
  amount,
  yaFacturado,
  facturaId,
}: EmitirFacturaButtonProps) {
  const [loading, setLoading] = useState(false);
  const [enviarEmail, setEnviarEmail] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<{ facturaId: string; secuencial: string } | null>(null);

  const handleEmitir = async () => {
    setLoading(true);
    try {
      const res = await emitirDesdeInvoiceAction(invoiceId, enviarEmail);
      setResult(res);
      toast.success(`Factura ${res.secuencial} emitida y encolada para envío al SRI`);
      setShowConfirm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al emitir factura");
    } finally {
      setLoading(false);
    }
  };

  // Si ya fue facturado, mostrar link a la FE
  if (yaFacturado || result) {
    const id = result?.facturaId ?? facturaId;
    return (
      <div className="flex items-center gap-2">
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="mr-1 h-3 w-3" />
          Factura Electrónica emitida
        </Badge>
        {id && (
          <Link href={`/admin/facturacion/facturas/${id}`}>
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-2 h-3 w-3" /> Ver FE
            </Button>
          </Link>
        )}
      </div>
    );
  }

  // Confirmación inline
  if (showConfirm) {
    return (
      <div className="p-4 border rounded-lg bg-muted space-y-3">
        <p className="text-sm font-medium">Emitir Factura Electrónica</p>
        <p className="text-sm text-muted-foreground">
          Cliente: {clientName} · Total: ${amount.toFixed(2)}
        </p>
        <div className="flex items-center gap-2">
          <Switch checked={enviarEmail} onCheckedChange={setEnviarEmail} />
          <Label className="text-sm">Enviar por email al cliente</Label>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleEmitir} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <Receipt className="mr-2 h-3 w-3" />
            )}
            {loading ? "Emitiendo..." : "Confirmar emisión"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowConfirm(false)}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={() => setShowConfirm(true)}>
      <Receipt className="mr-2 h-4 w-4" />
      Emitir Factura Electrónica
    </Button>
  );
}

function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}
