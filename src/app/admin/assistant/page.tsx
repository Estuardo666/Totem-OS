import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AssistantChat } from "@/components/features/assistant/assistant-chat";

export const metadata = { title: "Asistente IA" };

export default async function AssistantPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  return <AssistantChat />;
}
