"use client";

import { useState } from "react";
import { MessageSquare, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssistantChat } from "./assistant-chat";
import { VoicePanel } from "./voice-panel";

type Mode = "chat" | "voice";

export function AssistantWorkspace() {
  const [mode, setMode] = useState<Mode>("chat");

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <div className="flex justify-center border-b py-2">
        <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
          {(
            [
              { id: "chat", label: "Chat", icon: MessageSquare },
              { id: "voice", label: "Voz", icon: Mic },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 transition",
                mode === id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1">{mode === "chat" ? <AssistantChat /> : <VoicePanel />}</div>
    </div>
  );
}
