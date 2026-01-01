"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { updateUserRate } from "@/actions/user.actions";
import type { User } from "@prisma/client";
import { useSession } from "next-auth/react";
import { DollarSign, Loader2 } from "lucide-react";

interface SalaryConfigCardProps {
  user: User;
}

export function SalaryConfigCard({ user }: SalaryConfigCardProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [hourlyRate, setHourlyRate] = useState<string>((user.hourlyRate || 0).toString());

  // Si el usuario no es ADMIN, no renderizar nada
  if (session?.user?.role !== "ADMIN") {
    return null;
  }

  const handleSave = () => {
    const rate = parseFloat(hourlyRate);
    
    if (isNaN(rate) || rate < 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "La tarifa debe ser un número válido mayor o igual a 0",
      });
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateUserRate(user.id, rate);
        if (result.success) {
          toast({
            title: "Tarifa actualizada",
            description: `Tarifa de ${user.name} actualizada a $${rate.toFixed(2)}/hr`,
          });
          router.refresh();
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: result.error || "Error al actualizar la tarifa",
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "Error inesperado",
        });
      }
    });
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <DollarSign className="h-5 w-5" />
          Tarifa por Hora
        </CardTitle>
        <CardDescription>
          Configura la tarifa por hora para calcular los honorarios de {user.name}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`hourlyRate-${user.id}`}>Tarifa por Hora (USD)</Label>
          <div className="flex gap-2">
            <Input
              id={`hourlyRate-${user.id}`}
              type="number"
              step="0.01"
              min="0"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="0.00"
              disabled={isPending}
              className="flex-1"
            />
            <Button
              onClick={handleSave}
              disabled={isPending || parseFloat(hourlyRate) === (user.hourlyRate || 0)}
              size="default"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Esta tarifa se usará para calcular los honorarios en las sesiones de trabajo
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
