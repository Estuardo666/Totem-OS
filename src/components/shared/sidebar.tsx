"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Users, Clapperboard, Wallet, LogOut, LayoutDashboard, Layout, Video, ChevronRight, Settings, Plug, Clock, Home, Mic } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getBrandSettings } from "@/actions/admin-actions";
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
    href: "/admin/voice-control",
    label: "Control por voz (beta)",
    icon: Mic,
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
  } | null>(() => {
    // Cargar desde localStorage al inicializar
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("totem_brand_cache");
        return cached ? JSON.parse(cached) : null;
      } catch {
        return null;
      }
    }
    return null;
  });
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    // Inicializar con menús expandidos si alguna de sus rutas está activa
    const contentFactoryPaths = ["/content/dashboard", "/content", "/content/shoots"];
    const isContentFactoryActive = contentFactoryPaths.some(
      (path) => pathname === path || pathname?.startsWith(`${path}/`)
    );
    
    const financePaths = [
      "/finance",
      "/finance/personal",
      "/finance/transactions",
      "/finance/alerts",
      "/finance/settlement",
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

  // Cargar configuración de marca
  useEffect(() => {
    let isMounted = true;

    const loadBrandSettings = async () => {
      try {
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
        "flex h-[calc(100vh-2rem)] w-64 flex-col bg-white dark:bg-background/95 dark:backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-2xl rounded-3xl m-4",
        className
      )}
      {...props}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6 mb-6">
        <Link href="/" className="flex items-center gap-2" onClick={() => onNavigate?.()}>
          {brandSettings?.logoLight || brandSettings?.logoDark ? (
            <>
              {/* Logo Modo Claro */}
              {brandSettings.logoLight && (
                <Image
                  src={brandSettings.logoLight}
                  alt="Totem OS"
                  width={180}
                  height={56}
                  className="h-14 w-auto block dark:hidden"
                  priority
                />
              )}
              {/* Logo Modo Oscuro */}
              {brandSettings.logoDark && (
                <Image
                  src={brandSettings.logoDark}
                  alt="Totem OS"
                  width={180}
                  height={56}
                  className="h-14 w-auto hidden dark:block"
                  priority
                />
              )}
            </>
          ) : (
            <span className="text-xl font-bold">Totem OS</span>
          )}
        </Link>
      </div>

      {/* Sección de Usuario */}
      {user && (
        <div className="px-4 mb-6">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="cursor-pointer">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={user.image || undefined} alt={user.name || ""} />
                    <AvatarFallback>{userInitials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/admin/settings" className="cursor-pointer" onClick={() => onNavigate?.()}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Configuración</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/settings/integrations" className="cursor-pointer" onClick={() => onNavigate?.()}>
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

            {/* Información del usuario */}
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[1.1875rem] font-medium leading-snug break-words">
                {user.name || "Usuario"}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {userRole === "ADMIN" ? "Administrador" : userRole === "USER" ? "Usuario" : "EDITOR"}
              </span>
            </div>

            {/* Notificaciones */}
            <div className="flex-shrink-0 hidden md:block">
              <NotificationBell side="right" align="start" />
            </div>
          </div>
        </div>
      )}

      {/* Navegación */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
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
                <div className="flex items-stretch h-10">
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-l-lg px-3 py-2 text-sm font-medium transition-colors flex-1 h-full",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    onClick={() => onNavigate?.()}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      toggleExpanded(item.href);
                    }}
                    className={cn(
                      "flex items-center justify-center h-full aspect-square rounded-r-lg transition-colors shrink-0",
                      isActive
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        isExpanded && "rotate-90"
                      )}
                    />
                  </button>
                </div>

                {/* Sub-ítems con animación de acordeón */}
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out",
                    isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <div className="ml-4 space-y-1 border-l-2 border-muted pl-2 pt-1">
                    {(item.href === "/finance"
                      ? item.children.filter((child) =>
                          child.href === "/finance" ? isAdmin :
                          child.href === "/finance/alerts" ? isAdmin :
                          child.href === "/finance/settlement" ? isAdmin :
                          true
                        )
                      : item.children
                    ).map((child) => {
                      const ChildIcon = child.icon;
                      const childIsActive = isChildActive(child);

                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            childIsActive
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          )}
                          onClick={() => onNavigate?.()}
                        >
                          <ChildIcon className="h-4 w-4" />
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
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              onClick={() => onNavigate?.()}
            >
              <Icon className="h-5 w-5" />
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
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                  onClick={() => onNavigate?.()}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </>
        )}
      </nav>
    </div>
  );
}

