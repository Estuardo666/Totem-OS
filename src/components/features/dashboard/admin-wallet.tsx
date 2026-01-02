import { getPendingPartnerFee } from "@/actions/settlement-actions";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// Función para formatear dinero como USD
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export async function AdminWallet() {
  // Obtener sesión del usuario
  const session = await auth();
  const userId = session?.user?.id;
  const userRole = session?.user?.role;

  // Solo mostrar para ADMIN
  if (userRole !== "ADMIN" || !userId) {
    return null;
  }

  // Obtener honorarios pendientes
  const pendingFeeResult = await getPendingPartnerFee(userId);
  const pendingPartnerFee = pendingFeeResult.success ? pendingFeeResult.data ?? 0 : 0;

  // Si no hay honorarios pendientes, no mostrar nada
  if (pendingPartnerFee <= 0) {
    return null;
  }

  return (
    <Card className="mb-6 border-purple-300 bg-purple-50/50 dark:bg-purple-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-purple-600" />
          Mi Billetera
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-purple-600">
              {formatCurrency(pendingPartnerFee)}
            </span>
            <span className="text-sm text-muted-foreground">
              por cobrar este mes
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Honorarios calculados según la utilidad real de la agencia
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/finance/settlement">
              Ver Liquidación Completa
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
