"use client";

import { format } from "date-fns";

interface ClientReportHeaderProps {
  clientName: string;
  month: string;
  year: number;
}

export function ClientReportHeader({
  clientName,
  month,
  year,
}: ClientReportHeaderProps) {
  return (
    <div className="border-b-2 border-gray-300 pb-6 print:pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 print:text-2xl">
            Totem Mass Media
          </h1>
          <p className="text-sm text-muted-foreground mt-1 print:text-xs">
            Reporte Mensual de Rendición de Cuentas
          </p>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-semibold text-gray-900 print:text-xl">
            {clientName}
          </h2>
          <p className="text-lg text-muted-foreground mt-1 print:text-base">
            {month} {year}
          </p>
        </div>
      </div>
    </div>
  );
}

