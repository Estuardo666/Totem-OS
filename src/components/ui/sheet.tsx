"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 backdrop-blur-[10px]",
      "data-[state=open]:animate-overlayShow",
      "data-[state=closed]:animate-overlayHide data-[state=closed]:pointer-events-none",
      className
    )}
    style={{
      background: "rgba(0,0,0,0.08)",
      WebkitBackdropFilter: "blur(10px) saturate(180%)"
    }}
    {...props}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-popover text-popover-foreground p-6 rounded-3xl shadow-[0_24px_64px_-16px_rgba(16,16,20,0.3)]",
  {
    variants: {
      side: {
        top: "inset-x-2 top-2 data-[state=open]:animate-slideInFromTop data-[state=closed]:animate-slideOutToTop data-[state=closed]:pointer-events-none",
        bottom: "inset-x-2 bottom-2 data-[state=open]:animate-slideInFromBottom data-[state=closed]:animate-slideOutToBottom data-[state=closed]:pointer-events-none",
        left: "inset-y-2 left-2 w-3/4 sm:max-w-sm data-[state=open]:animate-slideInFromLeft data-[state=closed]:animate-slideOutToLeft data-[state=closed]:pointer-events-none",
        right: "inset-y-2 right-2 w-3/4 sm:max-w-sm data-[state=open]:animate-slideInFromRight data-[state=closed]:animate-slideOutToRight data-[state=closed]:pointer-events-none",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
);

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      {children}
      <SheetPrimitive.Close data-pressable="" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-primary/[0.08] text-muted-foreground hover:bg-primary/[0.14] hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Cerrar</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-xl font-semibold leading-tight text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};







