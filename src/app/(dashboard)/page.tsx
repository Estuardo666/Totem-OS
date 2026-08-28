import { auth } from "@/auth";
import { getTasks } from "@/actions/content-actions";
import { getClients } from "@/actions/client-actions";
import { getPendingFeedbacks } from "@/actions/client-feedback-actions";
import { getUserWorkloads } from "@/actions/workload-actions";
import { getFinancialStats } from "@/actions/finance-actions";
import { getReceivables } from "@/actions/finance-actions";
import { HomeCommandCenter } from "@/components/features/dashboard/home-command-center";
import { resolveRoleCode } from "@/lib/roles";

export default async function Home() {
  const session = await auth();
  // roleCode es la fuente canónica; resolveRoleCode conserva sesiones antiguas.
  const userRole = resolveRoleCode(session?.user) ?? "USER";
  const isAdmin = userRole === "ADMIN";

  // Finance is intentionally not requested for non-admins. The restriction is
  // enforced at the server data boundary, not only by hiding the card.
  const [tasksResult, clientsResult, feedbacksResult, workloadsResult, financeResult, receivablesResult] = await Promise.all([
    getTasks(),
    getClients(),
    getPendingFeedbacks(),
    getUserWorkloads(),
    isAdmin ? getFinancialStats() : Promise.resolve({ success: true as const, data: null }),
    isAdmin ? getReceivables() : Promise.resolve({ success: true as const, data: null }),
  ]);

  const firstName = session?.user?.name?.split(" ")[0] || "Usuario";
  const tasks = tasksResult.success ? tasksResult.data ?? [] : [];
  const clients = clientsResult.success ? clientsResult.data ?? [] : [];
  const feedbacks = feedbacksResult.success ? feedbacksResult.data ?? [] : [];
  const workloads = workloadsResult.success ? workloadsResult.data ?? [] : [];
  const finance = financeResult.success ? financeResult.data ?? null : null;
  const receivables = receivablesResult.success ? receivablesResult.data ?? null : null;

  return (
    <HomeCommandCenter
      firstName={firstName}
      userRole={userRole}
      specialty={session?.user?.specialty}
      tasks={tasks}
      clients={clients}
      workloads={workloads}
      feedbacks={feedbacks}
      finance={finance}
      receivables={receivables}
    />
  );
}
