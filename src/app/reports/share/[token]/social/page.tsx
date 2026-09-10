import { notFound } from "next/navigation";
import { getClientByShareToken } from "@/actions/client-actions";
import { markReportAsViewed } from "@/actions/client-feedback-actions";
import { buildSocialReportData } from "@/lib/reports/social-report-data";
import { SocialReportBody } from "@/components/features/reports/social-report/social-report-body";

interface SharedSocialReportPageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}

/**
 * Informe social público, accesible por enlace compartido.
 *
 * No llama a auth() a propósito: el token ES la credencial. Y el agregador que
 * usa no incluye ningún dato financiero de la agencia —tarifa mensual, gastos,
 * facturas—, solo métricas de las redes del propio cliente.
 */
export default async function SharedSocialReportPage({
  params,
  searchParams,
}: SharedSocialReportPageProps) {
  const { token } = await params;
  const { month, year } = await searchParams;

  const clientResult = await getClientByShareToken(token);
  if (!clientResult.success || !clientResult.data) notFound();

  const client = clientResult.data;
  await markReportAsViewed(client.id);

  const now = new Date();
  const monthNum = month ? parseInt(month, 10) : now.getMonth() + 1;
  const yearNum = year ? parseInt(year, 10) : now.getFullYear();

  if (
    !Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12 ||
    !Number.isInteger(yearNum) || yearNum < 2000 || yearNum > 2100
  ) {
    notFound();
  }

  const data = await buildSocialReportData(client.id, monthNum, yearNum);
  if (!data) notFound();

  return (
    <main className="totem-social-report min-h-screen bg-background">
      <SocialReportBody data={data} />
    </main>
  );
}
