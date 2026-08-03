"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Users, Clapperboard, Wallet, LogOut, LayoutDashboard, Layout, Video, ChevronRight, Settings, Plug, Clock, Home, FileText, Moon, Sun, Receipt } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getBrandSettings } from "@/actions/admin-actions";
import { updateUserSettings } from "@/actions/user.actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "./notification-bell";
import { cn } from "@/lib/utils";
import { toggleThemeVariantClient } from "@/lib/theme";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavItemWithChildren extends NavItem {
  children?: NavItem[];
}

const navItems: (NavItem | NavItemWithChildren)[] = [
  {
    href: "/",
    label: "Inicio",
    icon: Home,
  },
  {
    href: "/clients",
    label: "Clientes",
    icon: Users,
  },
  {
    href: "/content/dashboard",
    label: "Content Factory",
    icon: Clapperboard,
    children: [
      {
        href: "/content/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
      },
      {
        href: "/content",
        label: "Tareas",
        icon: Layout,
      },
      {
        href: "/content/shoots",
        label: "Rodajes",
        icon: Video,
      },
    ],
  },
  {
    href: "/finance",
    label: "Finanzas",
    icon: Wallet,
    children: [
      {
        href: "/finance",
        label: "Dashboard",
        icon: Wallet,
      },
      {
        href: "/finance/monthly-summary",
        label: "Resumen del Mes",
        icon: Wallet,
      },
      {
        href: "/finance/personal",
        label: "Dashboard personal",
        icon: Wallet,
      },
      {
        href: "/finance/transactions",
        label: "Transacciones",
        icon: Wallet,
      },
      {
        href: "/finance/alerts",
        label: "Alertas",
        icon: Wallet,
      },
      {
        href: "/finance/settlement",
        label: "Liquidación Interna",
        icon: Wallet,
      },
      {
        href: "/admin/facturacion",
        label: "Facturación Electrónica",
        icon: Receipt,
      },
    ],
  },
  {
    href: "/chronos",
    label: "Chronos",
    icon: Clock,
  },
];

// Items adicionales solo para ADMIN
const adminNavItems: NavItem[] = [
  {
    href: "/admin/users",
    label: "Gestión de Usuarios",
    icon: Users,
  },
  {
    href: "/admin/files",
    label: "Gestión de Archivos",
    icon: FileText,
  },
];

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate, ...props }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [brandSettings, setBrandSettings] = useState<{
    logoLight: string | null;
    logoDark: string | null;
  } | null>(null); // Inicializar siempre como null para evitar mismatch SSR
  const [mounted, setMounted] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    // Inicializar con menús expandidos si alguna de sus rutas está activa
    const contentFactoryPaths = ["/content/dashboard", "/content", "/content/shoots"];
    const isContentFactoryActive = contentFactoryPaths.some(
      (path) => pathname === path || pathname?.startsWith(`${path}/`)
    );
    
    const financePaths = [
      "/finance",
      "/finance/monthly-summary",
      "/finance/personal",
      "/finance/transactions",
      "/finance/alerts",
      "/finance/settlement",
      "/admin/facturacion",
    ];
    const isFinanceActive = financePaths.some(
      (path) => pathname === path || pathname?.startsWith(`${path}/`)
    );
    
    const expanded: string[] = [];
    if (isContentFactoryActive) expanded.push("/content/dashboard");
    if (isFinanceActive) expanded.push("/finance");
    
    return expanded;
  });

  const user = session?.user;
  const userRole = user?.role;
  const isAdmin = userRole === "ADMIN";
  const userInitials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  // Cargar configuración de marca (solo en cliente después de hidratación)
  useEffect(() => {
    setMounted(true); // Marcar que el cliente está listo

    let isMounted = true;

    const loadBrandSettings = async () => {
      try {
        // Primero intentar cargar desde localStorage
        try {
          const cached = localStorage.getItem("totem_brand_cache");
          if (cached && isMounted) {
            setBrandSettings(JSON.parse(cached));
          }
        } catch (e) {
          // Ignorar errores de localStorage
        }

        // Luego cargar desde API para actualizar
        const result = await getBrandSettings();
        if (!isMounted) return;

        if (result.success && result.data) {
          setBrandSettings(result.data);
          // Guardar en localStorage para siguiente carga
          try {
            localStorage.setItem("totem_brand_cache", JSON.stringify(result.data));
          } catch {
            // Ignorar errores de localStorage
          }
        }
      } catch (error) {
        console.error("Error al cargar configuración de marca:", error);
      }
    };

    loadBrandSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  // Sincronizar estado de dark mode
  useEffect(() => {
    // Leer el estado actual del DOM
    const htmlElement = document.documentElement;
    setIsDarkMode(htmlElement.classList.contains("dark"));

    // Observar cambios en la clase dark
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
    
    // Guardar en la base de datos
    try {
      await updateUserSettings({ darkMode: next.variant === "dark" });
    } catch (error) {
      console.error("Error al actualizar tema:", error);
    }
  };

  const toggleExpanded = (itemKey: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemKey)
        ? prev.filter((key) => key !== itemKey)
        : [...prev, itemKey]
    );
  };

  const isItemActive = (item: NavItem | NavItemWithChildren): boolean => {
    if ("children" in item && item.children) {
      // Si tiene hijos, está activo si alguno de sus hijos está activo
      return item.children.some(
        (child) =>
          pathname === child.href || pathname?.startsWith(`${child.href}/`)
      );
    }
    return pathname === item.href || pathname?.startsWith(`${item.href}/`);
  };

  const isChildActive = (child: NavItem): boolean => {
    return pathname === child.href || pathname?.startsWith(`${child.href}/`);
  };

  return (
    <div 
      className={cn(
        "flex h-[calc(100vh-2rem)] w-56 flex-col bg-transparent backdrop-blur-[100px] backdrop-saturate-150 border border-border/45 shadow-2xl rounded-3xl m-4 transition-all duration-500 ease-standard",
        className
      )}
      {...props}
    >
      {/* Logo */}
      <div className="mb-3 flex h-20 items-center border-b px-[1.125rem] py-[0.675rem]">
        <Link href="/" className="flex h-full w-full items-center" onClick={() => onNavigate?.()}>
          {mounted && (brandSettings?.logoLight || brandSettings?.logoDark) ? (
            <>
              {/* Logo Modo Claro */}
              {brandSettings.logoLight && (
                <Image
                  src={brandSettings.logoLight}
                  alt="Totem OS"
                  width={180}
                  height={56}
                  className="block max-h-[3.3rem] w-auto max-w-full object-contain dark:hidden"
                />
              )}
              {/* Logo Modo Oscuro */}
              {brandSettings.logoDark && (
                <Image
                  src={brandSettings.logoDark}
                  alt="Totem OS"
                  width={180}
                  height={56}
                  className="hidden max-h-[3.3rem] w-auto max-w-full object-contain dark:block"
                />
              )}
            </>
          ) : (
            <span className="text-base font-bold">Totem OS</span>
          )}
        </Link>
      </div>

      {/* Navegación */}
      <nav className="flex-1 space-y-0.5 px-2 py-2 overflow-y-auto">
        {navItems
          // Chronos deshabilitado temporalmente (oculto, sin eliminar la definición)
          .filter((item) => item.href !== "/chronos")
          .map((item) => {
          const Icon = item.icon;
          const hasChildren = "children" in item && item.children;
          const isExpanded = hasChildren && expandedItems.includes(item.href);
          const isActive = isItemActive(item);

          if (hasChildren && item.children) {
            return (
              <div key={item.href} className="space-y-1">
                {/* Botón principal del menú desplegable */}
                <div className="flex h-10 items-stretch border-b border-border/60">
                  <Link
                    href={item.href}
                    className={cn(
                      "flex h-full flex-1 items-center gap-2 px-2 text-sm font-medium transition-colors duration-200",
                      isActive
                        ? "text-primary"
                        : "text-foreground/85 hover:text-primary dark:text-foreground/80 dark:hover:text-white"
                    )}
                    onClick={() => onNavigate?.()}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      toggleExpanded(item.href);
                    }}
                    className={cn(
                      "flex h-full aspect-square shrink-0 items-center justify-center transition-colors duration-200",
                      isActive
                        ? "text-primary"
                        : "text-foreground/85 hover:text-primary dark:text-foreground/80 dark:hover:text-white"
                    )}
                  >
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 transition-transform duration-300 ease-standard",
                        isExpanded && "rotate-90"
                      )}
                    />
                  </button>
                </div>

                {/* Sub-ítems con animación de acordeón */}
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-500 ease-standard",
                    isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <div className="ml-2 space-y-0.5 pl-2 pt-0.5">
                    {(item.href === "/finance"
                      ? item.children.filter((child) =>
                          child.href === "/finance" ? isAdmin :
                          child.href === "/finance/monthly-summary" ? isAdmin :
                          child.href === "/finance/alerts" ? isAdmin :
                          child.href === "/finance/settlement" ? isAdmin :
                          child.href === "/admin/facturacion" ? isAdmin :
                          true
                        )
                      : item.children
                    ).map((child) => {
                      const childIsActive = isChildActive(child);

                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            "flex items-center rounded-lg px-3 py-1 text-[0.7875rem] font-normal transition-all duration-300 ease-standard",
                            childIsActive ? "text-primary" : "text-foreground/75 hover:text-primary dark:text-foreground/65 dark:hover:text-white"
                          )}
                          onClick={() => onNavigate?.()}
                        >
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          }

          // Item sin hijos (normal)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-10 items-center gap-2 border-b border-border/60 px-2 text-sm font-medium transition-colors duration-200",
                isActive
                  ? "text-primary"
                  : "text-foreground/85 hover:text-primary dark:text-foreground/80 dark:hover:text-white"
              )}
              onClick={() => onNavigate?.()}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        
        {/* Items adicionales solo para ADMIN */}
        {isAdmin && (
          <>
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname?.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex h-10 items-center gap-2 border-b border-border/60 px-2 text-sm font-medium transition-colors duration-200",
                    isActive
                      ? "text-primary"
                      : "text-foreground/85 hover:text-primary dark:text-foreground/80 dark:hover:text-white"
                  )}
                  onClick={() => onNavigate?.()}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {user && (
        <div className="mt-auto border-t border-border/45 px-3 py-3">
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-10 w-10"><AvatarImage src={user.image || undefined} alt={user.name || ""} /><AvatarFallback>{userInitials}</AvatarFallback></Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-56">
                <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel><DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link href="/admin/settings" className="cursor-pointer" onClick={() => onNavigate?.()}><Settings className="mr-2 h-4 w-4" /><span>Configuración</span></Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/admin/settings/integrations" className="cursor-pointer" onClick={() => onNavigate?.()}><Plug className="mr-2 h-4 w-4" /><span>Integraciones</span></Link></DropdownMenuItem>
                <DropdownMenuSeparator /><DropdownMenuItem onClick={() => signOut({ callbackUrl: "/sign-in" })} className="cursor-pointer"><LogOut className="mr-2 h-4 w-4" /><span>Cerrar Sesión</span></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{user.name || "Usuario"}</span><span className="block truncate text-xs text-muted-foreground">{userRole === "ADMIN" ? "Administrador" : userRole === "USER" ? "Usuario" : "EDITOR"}</span></div>
            <div className="hidden shrink-0 items-center md:flex">
              <button onClick={toggleTheme} className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-primary" title={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}>{isDarkMode ? <Sun className="h-4 w-4 text-[hsl(var(--theme-warning))]" /> : <Moon className="h-4 w-4" />}</button>
              <NotificationBell side="right" align="end" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

