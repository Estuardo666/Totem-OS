"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Users, Clapperboard, Wallet, LogOut, LayoutDashboard, Layout, Video, ChevronRight, Settings, Plug, Clock, Home, FileText, Moon, Sun, Receipt, BarChart3, MessageCircle, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useBrandSettings } from "@/components/providers/brand-settings-provider";
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
import { signOutWithTotemIOSCleanup } from "@/lib/totem-ios-client";
import { resolveRoleCode } from "@/lib/roles";

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
        href: "/finance/utilidades",
        label: "Utilidades acumuladas",
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
    href: "/analytics",
    label: "Analítica de Agencia",
    icon: BarChart3,
  },
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
  {
    href: "/admin/whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
  },
];

const FINANCE_ADMIN_ONLY = new Set([
  "/finance",
  "/finance/monthly-summary",
  "/finance/alerts",
  "/finance/settlement",
  "/finance/utilidades",
  "/admin/facturacion",
]);

const COLLAPSED_STORAGE_KEY = "totem:sidebar-collapsed";

// El layout lee --sidebar-w para reservar el ancho del sidebar anclado.
function applySidebarWidth(collapsed: boolean) {
  document.documentElement.style.setProperty("--sidebar-w", collapsed ? "4.5rem" : "15rem");
}

interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  onNavigate?: () => void;
  /** Permite el modo icono (solo desktop). */
  collapsible?: boolean;
}

export function Sidebar({ className, onNavigate, collapsible = false, ...props }: SidebarProps) {
  const [collapsedPref, setCollapsedPref] = useState(false);
  const collapsed = collapsible && collapsedPref;

  useEffect(() => {
    if (!collapsible) return;
    let stored = false;
    try {
      stored = localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1";
    } catch {}
    setCollapsedPref(stored);
    applySidebarWidth(stored);
  }, [collapsible]);

  const toggleCollapsed = () => {
    setCollapsedPref((prev) => {
      const next = !prev;
      applySidebarWidth(next);
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  // Atajo Ctrl/⌘ + B para colapsar/expandir
  useEffect(() => {
    if (!collapsible) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b" && !e.shiftKey && !e.altKey) {
        const t = e.target as HTMLElement | null;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapsible]);

  const pathname = usePathname();
  const { data: session } = useSession();
  const brandSettings = useBrandSettings();
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
  const userRole = resolveRoleCode(user);
  const isAdmin = userRole === "ADMIN";
  const userInitials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  useEffect(() => {
    setMounted(true);
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

  const visibleChildren = (item: NavItemWithChildren): NavItem[] =>
    item.href === "/finance"
      ? (item.children ?? []).filter((child) => (FINANCE_ADMIN_ONLY.has(child.href) ? isAdmin : true))
      : item.children ?? [];

  const rowClass = (active: boolean) =>
    cn(
      "group/row relative flex h-9 w-full items-center gap-2.5 overflow-hidden rounded-full px-[0.59rem] text-sm font-medium outline-none",
      "focus-visible:ring-2 focus-visible:ring-ring",
      active
        ? "bg-primary/[0.12] text-foreground"
        : "text-foreground/90 hover:bg-primary/[0.1] hover:text-foreground"
    );

  // Misma curva y duración que el ancho del panel (cajón de iOS, 380ms).
  const reduceMotion = useReducedMotion();
  const layoutTransition = reduceMotion
    ? { duration: 0 }
    : { type: "tween" as const, duration: 0.38, ease: [0.32, 0.72, 0, 1] as const };

  // Texto de las filas: se desvanece rápido al colapsar y aparece con un leve
  // retraso al expandir, cuando ya hay espacio (no se ve cortarse a mitad).
  const labelClass = cn(
    "truncate whitespace-nowrap transition-opacity",
    collapsed ? "opacity-0 duration-100" : "opacity-100 delay-150 duration-200"
  );

  const withTooltip = (label: string, node: React.ReactElement) =>
    collapsed ? (
      <Tooltip key={label}>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={14} className="rounded-full">{label}</TooltipContent>
      </Tooltip>
    ) : (
      node
    );

  const renderLeaf = (item: NavItem) => {
    const Icon = item.icon;
    const active = isChildActive(item);
    return (
      <div key={item.href}>
        {withTooltip(
          item.label,
          <Link
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? item.label : undefined}
            className={rowClass(active)}
            onClick={() => onNavigate?.()}
          >
            <Icon className="h-[1.05rem] w-[1.05rem] shrink-0" />
            <span className={labelClass}>{item.label}</span>
          </Link>
        )}
      </div>
    );
  };

  const renderGroup = (item: NavItemWithChildren) => {
    const Icon = item.icon;
    const active = isItemActive(item);
    const children = visibleChildren(item);
    const isExpanded = expandedItems.includes(item.href);
    // La lista de hijos solo se ve expandida; al colapsar el panel se pliega con
    // la misma curva que el ancho, así los iconos de abajo suben animados.
    const showChildren = isExpanded && !collapsed;

    const trigger = collapsed ? (
      // En modo icono el grupo abre un flyout de vidrio a la derecha.
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label={item.label} className={rowClass(active)}>
                <Icon className="h-[1.05rem] w-[1.05rem] shrink-0" />
                <span className={labelClass} aria-hidden>{item.label}</span>
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={14} className="rounded-full">{item.label}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent side="right" align="start" sideOffset={18} className="totem-glass w-56 shadow-none">
          <DropdownMenuLabel className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">{item.label}</DropdownMenuLabel>
          {children.map((child) => (
            <DropdownMenuItem key={child.href} asChild>
              <Link
                href={child.href}
                className={cn("cursor-pointer rounded-full px-3", isChildActive(child) && "bg-primary/[0.12] font-medium")}
                onClick={() => onNavigate?.()}
              >
                {child.label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : (
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => toggleExpanded(item.href)}
        className={cn(rowClass(false), active && "text-foreground")}
      >
        <Icon className="h-[1.05rem] w-[1.05rem] shrink-0" />
        <span className={cn(labelClass, "flex-1 text-left")}>{item.label}</span>
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 opacity-60 transition-transform duration-200 ease-out",
            isExpanded && "rotate-90"
          )}
        />
      </button>
    );

    return (
      <div key={item.href}>
        {trigger}
        {/* grid-rows 0fr→1fr anima la altura real sin max-height arbitrario */}
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-380 ease-smooth motion-reduce:transition-none",
            showChildren ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
          aria-hidden={!showChildren}
        >
          <div className="overflow-hidden">
            <div className="ml-[1.15rem] mt-0.5 space-y-0.5 pb-1 pl-2.5">
              {children.map((child) => {
                const childActive = isChildActive(child);
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    tabIndex={showChildren ? undefined : -1}
                    aria-current={childActive ? "page" : undefined}
                    className={cn(
                      "flex h-8 items-center whitespace-nowrap rounded-full px-3 text-sm",
                      childActive
                        ? "bg-primary/[0.12] font-medium text-foreground"
                        : "text-foreground/80 hover:bg-primary/[0.1] hover:text-foreground"
                    )}
                    onClick={() => onNavigate?.()}
                  >
                    <span className="truncate">{child.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const mainItems = navItems
    // Chronos deshabilitado temporalmente (oculto, sin eliminar la definición)
    .filter((item) => item.href !== "/chronos");

  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={400}>
      <aside
        data-collapsed={collapsed || undefined}
        className={cn(
          "totem-sidebar-surface flex h-full flex-col overflow-hidden transition-[width] duration-380 ease-smooth motion-reduce:transition-none",
          // Flotante en desktop (wrapper p-2): el ancho + 16px = --sidebar-w.
          collapsible ? "rounded-2xl" : "",
          collapsed ? "w-14" : collapsible ? "w-56" : "w-60",
          className
        )}
        {...props}
      >
        {/* Logo */}
        <div className="relative flex h-20 shrink-0 items-center px-2.5">
          <Link
            href="/"
            aria-label="Totem OS — Inicio"
            className="relative flex h-full w-full min-w-0 items-center"
            onClick={() => onNavigate?.()}
          >
            <span
              aria-hidden
              className={cn(
                "absolute left-0 flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background transition-[opacity,transform] duration-300 ease-smooth",
                collapsed ? "scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0"
              )}
            >
              T
            </span>
            <span
              className={cn(
                "flex min-w-0 items-center pl-2.5 transition-opacity",
                collapsed ? "pointer-events-none opacity-0 duration-100" : "opacity-100 delay-150 duration-300"
              )}
            >
            {mounted && (brandSettings?.logoLight || brandSettings?.logoDark) ? (
              <>
                {brandSettings.logoLight && (
                  <Image
                    src={brandSettings.logoLight}
                    alt="Totem OS"
                    width={180}
                    height={56}
                    className="block max-h-10 w-auto max-w-full object-contain dark:hidden"
                  />
                )}
                {brandSettings.logoDark && (
                  <Image
                    src={brandSettings.logoDark}
                    alt="Totem OS"
                    width={180}
                    height={56}
                    className="hidden max-h-10 w-auto max-w-full object-contain dark:block"
                  />
                )}
              </>
            ) : (
              <span className="whitespace-nowrap text-base font-bold">Totem OS</span>
            )}
            </span>
          </Link>
        </div>

        {/* Navegación */}
        <nav
          aria-label="Principal"
          className={cn("flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-3", collapsed && "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden")}
        >
          <div className="space-y-0.5">
            {mainItems.map((item) =>
              "children" in item && item.children ? renderGroup(item) : renderLeaf(item)
            )}
          </div>

          {isAdmin && (
            <div className="mt-5">
              {/* Se mantiene en el DOM para que la altura no salte al colapsar */}
              <p className={cn("mb-1.5 whitespace-nowrap px-3 text-xs font-medium text-foreground/60", labelClass)} aria-hidden={collapsed}>
                Administración
              </p>
              <div className="space-y-0.5">
                {adminNavItems.map(renderLeaf)}
              </div>
            </div>
          )}
        </nav>

        {/* Toggle colapsar (solo desktop) */}
        {collapsible && (
          // El bloque de usuario cambia de alto al colapsar; la fila se desplaza
          // animada (layout) en vez de saltar.
          <motion.div layout="position" transition={layoutTransition} className="shrink-0 px-2.5 pb-2">
            {withTooltip(
              "Expandir menú",
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
                className={cn(rowClass(false), "text-muted-foreground")}
              >
                {/* Los dos iconos conviven y se cruzan (fundido + giro corto) */}
                <span className="relative h-[1.05rem] w-[1.05rem] shrink-0" aria-hidden>
                  <PanelLeftOpen
                    className={cn(
                      "absolute inset-0 h-full w-full transition-[opacity,transform] duration-380 ease-smooth motion-reduce:transition-none",
                      collapsed ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-75 opacity-0"
                    )}
                  />
                  <PanelLeftClose
                    className={cn(
                      "absolute inset-0 h-full w-full transition-[opacity,transform] duration-380 ease-smooth motion-reduce:transition-none",
                      collapsed ? "rotate-90 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100"
                    )}
                  />
                </span>
                <span className={cn(labelClass, "flex-1 text-left")}>Colapsar</span>
                <kbd className={cn(labelClass, "rounded bg-primary/[0.08] px-1.5 font-sans text-xs text-muted-foreground")}>Ctrl B</kbd>
              </button>
            )}
          </motion.div>
        )}

        {user && (
          <div className="shrink-0 px-2.5 py-3">
            {/* Al colapsar, la fila pasa a columna: cada pieza anima su posición
                (layout) con la misma curva que el ancho del panel. */}
            <div className={cn("flex items-center gap-2", collapsed && "flex-col-reverse gap-1")}>
              <motion.div layout="position" transition={layoutTransition} className="shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label="Mi cuenta"
                    className="shrink-0 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Avatar className="h-9 w-9"><AvatarImage src={user.image || undefined} alt={user.name || ""} /><AvatarFallback>{userInitials}</AvatarFallback></Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={collapsed ? "end" : "start"} side={collapsed ? "right" : "top"} className="w-56">
                  <DropdownMenuLabel>{collapsed ? user.name || "Mi Cuenta" : "Mi Cuenta"}</DropdownMenuLabel><DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link href="/admin/settings" className="cursor-pointer" onClick={() => onNavigate?.()}><Settings className="mr-2 h-4 w-4" /><span>Configuración</span></Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/admin/settings/integrations" className="cursor-pointer" onClick={() => onNavigate?.()}><Plug className="mr-2 h-4 w-4" /><span>Integraciones</span></Link></DropdownMenuItem>
                  <DropdownMenuSeparator /><DropdownMenuItem onClick={() => void signOutWithTotemIOSCleanup()} className="cursor-pointer"><LogOut className="mr-2 h-4 w-4" /><span>Cerrar Sesión</span></DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </motion.div>
              {!collapsed && (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.2, delay: 0.15 } }}
                  className="min-w-0 flex-1"
                >
                  <span className="block truncate whitespace-nowrap text-sm font-medium">{user.name || "Usuario"}</span>
                  <span className="block truncate whitespace-nowrap text-xs text-muted-foreground">{userRole === "ADMIN" ? "Administrador" : userRole === "USER" ? "Usuario" : "Editor"}</span>
                </motion.div>
              )}
              <div className={cn("hidden shrink-0 items-center md:flex", collapsed && "flex-col")}>
                <motion.div layout="position" transition={layoutTransition}>
                  <button onClick={toggleTheme} aria-label={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/[0.12] hover:text-foreground">{isDarkMode ? <Sun className="h-4 w-4 text-[hsl(var(--theme-warning))]" /> : <Moon className="h-4 w-4" />}</button>
                </motion.div>
                <motion.div layout="position" transition={layoutTransition}>
                  <NotificationBell side="right" align="end" />
                </motion.div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
