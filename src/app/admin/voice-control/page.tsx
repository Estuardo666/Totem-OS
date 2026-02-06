import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { VoiceControlPanel } from "@/components/features/admin/voice-control/voice-control-panel";
import { ConversationalVoicePanel } from "@/components/features/admin/voice-control/conversational-voice-panel";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Mic } from "lucide-react";

export default async function VoiceControlPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  if (session.user.roleLegacy !== "ADMIN") {
    redirect("/");
  }

  const clients = await db.client.findMany({
    select: {
      id: true,
      name: true,
      logo: true,
      color: true,
    },
    orderBy: { name: "asc" },
  });

  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      createdAt: true,
      updatedAt: true,
      firstName: true,
      lastName: true,
      emailVerified: true,
      roleLegacy: true,
      primaryColor: true,
      darkMode: true,
      soundNotifications: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6 p-2 md:p-3">
      <PageHeader
        title="Control por voz"
        description="Crea tareas y rodajes usando tu voz. Elige entre el modo clásico o el conversacional estilo Alexa."
      />
      
      <Tabs defaultValue="conversational" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="conversational" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Conversacional
          </TabsTrigger>
          <TabsTrigger value="classic" className="gap-2">
            <Mic className="h-4 w-4" />
            Clásico
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="conversational" className="mt-6">
          <ConversationalVoicePanel clients={clients} users={users as any} />
        </TabsContent>
        
        <TabsContent value="classic" className="mt-6">
          <VoiceControlPanel clients={clients} users={users as any} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
