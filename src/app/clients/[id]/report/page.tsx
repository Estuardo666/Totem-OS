import { notFound } from "next/navigation";
import { getClientReportData } from "@/actions/client-actions";
import { ClientReportHeader } from "@/components/features/clients/client-report-header";
import { DeliverablesSummary } from "@/components/features/clients/deliverables-summary";
import { FinancialSummary } from "@/components/features/clients/financial-summary";
import { WeeklyEffortChart } from "@/components/features/clients/weekly-effort-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ClientReportPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function ClientReportPage({
  params,
  searchParams,
}: ClientReportPageProps) {
  const { id } = await params;
  const { month, year } = await searchParams;

  const monthNum = month ? parseInt(month) : undefined;
  const yearNum = year ? parseInt(year) : undefined;

  const result = await getClientReportData(id, monthNum, yearNum);

  if (!result.success || !result.data) {
    notFound();
  }

  const reportData = result.data;

  return (
    <div className="min-h-screen bg-white print:bg-white">
      <div className="container mx-auto p-4 print:p-6 max-w-4xl">
        {/* Encabezado del Reporte */}
        <ClientReportHeader
          clientName={reportData.client.name}
          month={reportData.month}
          year={reportData.year}
        />

        {/* Resumen de Entregables */}
        <div className="mt-8">
          <DeliverablesSummary
            deliverables={reportData.deliverables}
            month={reportData.month}
            year={reportData.year}
          />
        </div>

        {/* Resumen Financiero */}
        <div className="mt-8">
          <FinancialSummary
            financial={reportData.financial}
            monthlyRate={reportData.client.monthlyRate}
            month={reportData.month}
            year={reportData.year}
          />
        </div>

        {/* Gráfico de Esfuerzo Semanal */}
        <div className="mt-8">
          <WeeklyEffortChart
            weeklyEffort={reportData.weeklyEffort}
            month={reportData.month}
            year={reportData.year}
          />
        </div>

        {/* Pie de página */}
        <div className="mt-12 pt-8 border-t print:mt-8 print:pt-4">
          <p className="text-sm text-muted-foreground text-center">
            Reporte generado automáticamente por Totem OS - {reportData.month} {reportData.year}
          </p>
        </div>
      </div>
    </div>
  );
}

