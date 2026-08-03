import { auth } from "@/auth";
import { getTasks } from "@/actions/content-actions";
import { getClients } from "@/actions/client-actions";
import { getPendingFeedbacks } from "@/actions/client-feedback-actions";
import { getUserWorkloads } from "@/actions/workload-actions";
import { getFinancialStats } from "@/actions/finance-actions";
import { HomeCommandCenter } from "@/components/features/dashboard/home-command-center";

export default async function Home() {
  const session = await auth();
  // `roleLegacy` is the persisted role and is the source of truth for Home permissions.
  // Falling back to `role` keeps compatibility with older sessions.
  const userRole = session?.user?.roleLegacy ?? session?.user?.role;
  const isAdmin = userRole === "ADMIN";

  // Finance is intentionally not requested for non-admins. The restriction is
  // enforced at the server data boundary, not only by hiding the card.
  const [tasksResult, clientsResult, feedbacksResult, workloadsResult, financeResult] = await Promise.all([
    getTasks(),
    getClients(),
    getPendingFeedbacks(),
    getUserWorkloads(),
    isAdmin ? getFinancialStats() : Promise.resolve({ success: true as const, data: null }),
  ]);

  const firstName = session?.user?.name?.split(" ")[0] || "Usuario";
  const tasks = tasksResult.success ? tasksResult.data ?? [] : [];
  const clients = clientsResult.success ? clientsResult.data ?? [] : [];
  const feedbacks = feedbacksResult.success ? feedbacksResult.data ?? [] : [];
  const workloads = workloadsResult.success ? workloadsResult.data ?? [] : [];
  const finance = financeResult.success ? financeResult.data : null;

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
    />
  );
}
