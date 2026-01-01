"use client";

import { toast } from "@/components/ui/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface NotifyUserOptions {
  title: string;
  description?: string;
  image?: string | null;
  name?: string;
  duration?: number;
}

/**
 * Helper function to show a toast notification with user avatar
 * @example
 * notifyUser({ 
 *   title: "Nuevo mensaje", 
 *   description: "Hola Stuart", 
 *   image: "url_avatar",
 *   name: "Stuart"
 * })
 */
export function notifyUser({
  title,
  description,
  image,
  name,
  duration = 5000,
}: NotifyUserOptions) {
  const userInitials = name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  toast({
    title: (
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={image || undefined} alt={name || ""} />
          <AvatarFallback>{userInitials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-sm font-medium">{title}</span>
          {description && (
            <span className="text-xs opacity-90">{description}</span>
          )}
        </div>
      </div>
    ),
    duration,
  });
}

