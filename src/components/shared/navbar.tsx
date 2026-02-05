"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationBell } from "./notification-bell";
import { Sidebar } from "./sidebar";
import { getPublicBrandSettings } from "@/actions/admin-actions";

export function Navbar() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [brandSettings, setBrandSettings] = useState<{
    logoLight: string | null;
    logoDark: string | null;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadBrand = async () => {
      try {
        const result = await getPublicBrandSettings();
        if (!isMounted) return;

        if (result.success && result.data) {
          setBrandSettings(result.data);
        }
      } catch (error) {
        console.error("Error al cargar configuración de marca pública:", error);
      }
    };

    loadBrand();

    return () => {
      isMounted = false;
    };
  }, []);

  const userInitials = useMemo(() => {
    const name = session?.user?.name;
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [session?.user?.name]);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between border-b bg-background/90 backdrop-blur md:hidden px-4">
      <div className="flex items-center">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menú</span>
            </Button>
          </SheetTrigger>
          <SheetContent 
            side="left" 
            className="w-[85vw] max-w-[400px] p-0 bg-white/95 dark:bg-background/95 backdrop-blur-xl border-r-0 rounded-r-3xl"
          >
            <SheetTitle className="sr-only">Menú de Navegación</SheetTitle>
            <Sidebar 
              className="w-full h-full m-0 border-none shadow-none bg-transparent rounded-none"
              onNavigate={() => setOpen(false)}
            />
          </SheetContent>
        </Sheet>
        <Link href="/" className="ml-4 flex items-center">
          {brandSettings?.logoLight || brandSettings?.logoDark ? (
            <>
              {brandSettings.logoLight && (
                <Image
                  src={brandSettings.logoLight}
                  alt="Totem OS"
                  width={120}
                  height={40}
                  className="h-8 w-auto block dark:hidden"
                  priority
                />
              )}
              {brandSettings.logoDark && (
                <Image
                  src={brandSettings.logoDark}
                  alt="Totem OS"
                  width={120}
                  height={40}
                  className="h-8 w-auto hidden dark:block"
                  priority
                />
              )}
            </>
          ) : (
            <span className="text-lg font-bold">Totem OS</span>
          )}
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <NotificationBell side="bottom" align="end" />
        <Avatar className="h-9 w-9">
          <AvatarImage src={session?.user?.image ?? undefined} alt={session?.user?.name ?? "Usuario"} />
          <AvatarFallback>{userInitials}</AvatarFallback>
        </Avatar>
      </div>
    </div>
  );
}

