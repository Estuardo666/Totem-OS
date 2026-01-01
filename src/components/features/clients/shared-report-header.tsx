"use client";

interface SharedReportHeaderProps {
  clientName: string;
  month: string;
  year: number;
}

export function SharedReportHeader({
  clientName,
  month,
  year,
}: SharedReportHeaderProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-8 border-l-4 border-blue-600">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Totem Mass Media
          </h1>
          <p className="text-lg text-gray-600">
            Reporte Mensual de Rendición de Cuentas
          </p>
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-semibold text-gray-900 mb-1">
            {clientName}
          </h2>
          <p className="text-xl text-blue-600 font-medium">
            {month} {year}
          </p>
        </div>
      </div>
    </div>
  );
}

