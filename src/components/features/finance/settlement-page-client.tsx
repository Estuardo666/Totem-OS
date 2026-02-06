"use client";

import { MonthYearSelector } from "./month-year-selector";
import { SettlementCard } from "./settlement-card";
import { UserSettlementReport } from "@/actions/finance-actions";
import { Card, CardContent } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import type { User } from "@prisma/client";
import { PageHeader } from "@/components/shared";

interface SettlementPageClientProps {
  initialMonth: number;
  initialYear: number;
  initialReports: UserSettlementReport[];
  initialUsers: User[];
  currentUserId?: string;
  isAdmin: boolean;
}

export function SettlementPageClient({
  initialMonth,
  initialYear,
  initialReports,
  initialUsers,
  currentUserId,
  isAdmin,
}: SettlementPageClientProps) {
  const router = useRouter();

  const handleMonthChange = (newMonth: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("month", newMonth.toString());
    params.set("year", initialYear.toString());
    router.push(`/finance/settlement?${params.toString()}`);
  };

  const handleYearChange = (newYear: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("month", initialMonth.toString());
    params.set("year", newYear.toString());
    router.push(`/finance/settlement?${params.toString()}`);
  };

  // Filtrar reports según rol
  const displayReports = isAdmin 
    ? initialReports 
    : initialReports.filter((r) => r.userId === currentUserId);

  // Obtener usuarios como mapa para acceso rápido
  const usersMap = new Map(initialUsers.map((u) => [u.id, u]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Liquidación Mensual"
        description="Gestión de salarios y honorarios del equipo"
        actions={
          <MonthYearSelector
            month={initialMonth}
            year={initialYear}
            onMonthChange={handleMonthChange}
            onYearChange={handleYearChange}
          />
        }
      />

      {/* Tarjetas de Liquidación */}
      {displayReports.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              No hay liquidaciones para este mes
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayReports.map((report) => {
            const user = usersMap.get(report.userId);
            if (!user) return null;
            return (
              <SettlementCard
                key={report.userId}
                userReport={report}
                user={user}
                month={initialMonth}
                year={initialYear}
                isAdmin={isAdmin}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

