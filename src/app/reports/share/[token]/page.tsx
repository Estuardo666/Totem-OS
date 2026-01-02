import { notFound } from "next/navigation";
import { getClientByShareToken, getClientReportData } from "@/actions/client-actions";
import { markReportAsViewed } from "@/actions/client-feedback-actions";
import { getClientFeedbacks } from "@/actions/client-feedback-actions";
import { SharedReportHeader } from "@/components/features/clients/shared-report-header";
import { ProductionSummary } from "@/components/features/clients/production-summary";
import { AccountStatusCard } from "@/components/features/clients/account-status-card";
import { LinkedExpensesSection } from "@/components/features/clients/linked-expenses-section";
import { PublishedContentList } from "@/components/features/clients/published-content-list";
import { DeliverablesProgressChart } from "@/components/features/clients/deliverables-progress-chart";
import { ReportApprovalSection } from "@/components/features/clients/report-approval-section";
import { format } from "date-fns";

interface SharedReportPageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function SharedReportPage({
  params,
  searchParams,
}: SharedReportPageProps) {
  const { token } = await params;
  const { month, year } = await searchParams;

  const monthNum = month ? parseInt(month) : undefined;
  const yearNum = year ? parseInt(year) : undefined;

  // Obtener cliente por token
  const clientResult = await getClientByShareToken(token);

  if (!clientResult.success || !clientResult.data) {
    notFound();
  }

  const client = clientResult.data;

  // Marcar reporte como visto (solo la primera vez o si no se ha visto recientemente)
  await markReportAsViewed(client.id);

  // Obtener datos del reporte
  const reportResult = await getClientReportData(client.id, monthNum, yearNum);

  if (!reportResult.success || !reportResult.data) {
    notFound();
  }

  const reportData = reportResult.data;

  // Obtener feedback existente para este mes/año
  const feedbacksResult = await getClientFeedbacks(client.id);
  const currentFeedback = feedbacksResult.success && feedbacksResult.data
    ? feedbacksResult.data.find(
        (f) => Number(f.month) === Number(reportData.month) && Number(f.year) === Number(reportData.year)
      )
    : null;

  // Obtener nombre del mes en español
  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const monthName = monthNames[Number(reportData.month) - 1] || format(new Date(Number(reportData.year), Number(reportData.month) - 1), "MMMM");

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto p-8 max-w-5xl">
        {/* Encabezado Premium */}
        <SharedReportHeader
          clientName={reportData.client.name}
          month={reportData.month}
          year={reportData.year}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {/* Resumen de Producción */}
          <ProductionSummary
            deliverables={reportData.deliverables}
            month={reportData.month}
            year={reportData.year}
          />

          {/* Estado de Cuenta */}
          <AccountStatusCard
            financial={reportData.financial}
            monthlyRate={reportData.client.monthlyRate}
            month={reportData.month}
            year={reportData.year}
          />
        </div>

        {/* Gráfico de Progreso */}
        <div className="mt-6">
          <DeliverablesProgressChart
            deliverables={reportData.deliverables}
            month={reportData.month}
            year={reportData.year}
          />
        </div>

        {/* Gastos Vinculados al Proyecto */}
        <div className="mt-6">
          <LinkedExpensesSection
            expenses={reportData.financial.linkedExpenses}
            month={reportData.month}
            year={reportData.year}
          />
        </div>

        {/* Lista de Contenido Publicado */}
        {reportData.deliverables.completedTasks.length > 0 && (
          <div className="mt-6">
            <PublishedContentList
              tasks={reportData.deliverables.completedTasks}
              month={reportData.month}
              year={reportData.year}
            />
          </div>
        )}

        {/* Sección de Aprobación y Comentarios */}
        <ReportApprovalSection
          clientId={client.id}
          month={Number(reportData.month)}
          year={reportData.year}
          monthName={monthName}
          isApproved={currentFeedback?.approved || false}
          existingComment={currentFeedback?.comment || null}
        />

        {/* Pie de página */}
        <div className="mt-12 pt-8 border-t text-center">
          <p className="text-sm text-muted-foreground">
            Reporte generado automáticamente por Totem Mass Media
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {reportData.month} {reportData.year}
          </p>
        </div>
      </div>
    </div>
  );
}

