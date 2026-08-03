"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { Menu, Settings, Plug, LogOut, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "./notification-bell";
import { TaskBell } from "./task-bell";
import { Sidebar } from "./sidebar";
import { getPublicBrandSettings } from "@/actions/admin-actions";
import { updateUserSettings } from "@/actions/user.actions";
import { toggleThemeVariantClient } from "@/lib/theme";

export function Navbar() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
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

  // Sincronizar estado de dark mode
  useEffect(() => {
    const htmlElement = document.documentElement;
    setIsDarkMode(htmlElement.classList.contains("dark"));

    const observer = new MutationObserver(() => {
      setIsDarkMode(htmlElement.classList.contains("dark"));
    });

    observer.observe(htmlElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const toggleTheme = async () => {
    const next = toggleThemeVariantClient();
    setIsDarkMode(next.variant === "dark");
    
    try {
      await updateUserSettings({ darkMode: next.variant === "dark" });
    } catch (error) {
      console.error("Error al actualizar tema:", error);
    }
  };

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
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b bg-background/90 backdrop-blur md:hidden px-4 h-[calc(4rem+var(--sat,0px))] pt-[var(--sat,0px)]">
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
            className="w-[75vw] max-w-[400px] p-0 bg-white/95 dark:bg-background/30 backdrop-blur-xl border-r-0 rounded-r-3xl"
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
        <button
          onClick={toggleTheme}
          className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-accent/25 transition-colors"
          title={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        >
          {isDarkMode ? (
            <Sun className="h-4 w-4 text-yellow-500" />
          ) : (
            <Moon className="h-4 w-4 text-slate-700" />
          )}
        </button>
        <TaskBell />
        <NotificationBell side="bottom" align="end" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="cursor-pointer">
              <Avatar className="h-9 w-9">
                <AvatarImage src={session?.user?.image ?? undefined} alt={session?.user?.name ?? "Usuario"} />
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin/settings" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Configuración</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/settings/integrations" className="cursor-pointer">
                <Plug className="mr-2 h-4 w-4" />
                <span>Integraciones</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/sign-in" })}
              className="cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Cerrar Sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

