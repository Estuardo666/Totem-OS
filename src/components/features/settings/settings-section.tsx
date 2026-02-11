"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}

export function SettingsSection({
  title,
  description,
  icon: Icon,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 px-1">
        {Icon && (
          <Icon className="h-4 w-4 text-muted-foreground" />
        )}
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </h3>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground/70 px-1">
          {description}
        </p>
      )}
      <div className="rounded-xl border bg-card overflow-hidden divide-y">
        {children}
      </div>
    </div>
  );
}

interface SettingsRowProps {
  label: string;
  description?: string;
  icon?: LucideIcon;
  iconColor?: string;
  children: ReactNode;
  className?: string;
  isLast?: boolean;
}

export function SettingsRow({
  label,
  description,
  icon: Icon,
  iconColor = "text-muted-foreground",
  children,
  className,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-3 bg-card hover:bg-muted/30 transition-colors",
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {Icon && (
          <div className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
            iconColor.includes("bg-") ? iconColor : "bg-muted"
          )}>
            <Icon className={cn(
              "h-4 w-4",
              iconColor.includes("bg-") ? "text-white" : iconColor
            )} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight truncate">{label}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

interface SettingsGroupProps {
  children: ReactNode;
  className?: string;
}

export function SettingsGroup({ children, className }: SettingsGroupProps) {
  return (
    <div className={cn("rounded-xl border bg-card overflow-hidden divide-y", className)}>
      {children}
    </div>
  );
}

interface SettingsCardProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  footer?: ReactNode;
}

export function SettingsCard({
  title,
  description,
  icon: Icon,
  children,
  className,
  headerClassName,
  contentClassName,
  footer,
}: SettingsCardProps) {
  return (
    <div className={cn("rounded-xl border bg-card overflow-hidden", className)}>
      {(title || description) && (
        <div className={cn("px-4 py-3 border-b bg-muted/30", headerClassName)}>
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
            {title && <h4 className="text-sm font-medium">{title}</h4>}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      )}
      <div className={cn("p-4", contentClassName)}>{children}</div>
      {footer && (
        <div className="px-4 py-3 border-t bg-muted/30">{footer}</div>
      )}
    </div>
  );
}
