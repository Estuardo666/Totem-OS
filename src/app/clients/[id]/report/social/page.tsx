import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { buildSocialReportData } from "@/lib/reports/social-report-data";
import { SocialReportBody } from "@/components/features/reports/social-report/social-report-body";

interface SocialReportPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}

/**
 * Informe social interno de un cliente.
 * El mismo cuerpo que ve el cliente en el enlace público, pero tras sesión.
 */
export default async function SocialReportPage({
  params,
  searchParams,
}: SocialReportPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const { month, year } = await searchParams;

  // Por defecto, el mes en curso.
  const now = new Date();
  const monthNum = month ? parseInt(month, 10) : now.getMonth() + 1;
  const yearNum = year ? parseInt(year, 10) : now.getFullYear();

  if (
    !Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12 ||
    !Number.isInteger(yearNum) || yearNum < 2000 || yearNum > 2100
  ) {
    notFound();
  }

  const data = await buildSocialReportData(id, monthNum, yearNum);
  if (!data) notFound();

  return (
    <main className="totem-social-report min-h-screen bg-background">
      <SocialReportBody data={data} />
    </main>
  );
}
