import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Sin bordes: la jerarquía es de relleno, siempre derivado del color del usuario.
        // El hover escala con la importancia: principal (brillo y halo) >
        // secundario (relleno 9% → 22%) > fantasma (0 → 14%). Sin cambiar el color
        // del texto: con acentos claros (amarillo, lima) perdería contraste.
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_8px_22px_-8px_hsl(var(--primary)/0.7)]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/85 hover:shadow-[0_8px_22px_-8px_hsl(var(--destructive)/0.7)] dark:text-[#ffffff]",
        outline:
          "bg-primary/[0.09] text-foreground hover:bg-primary/[0.22]",
        secondary:
          "bg-primary/[0.09] text-foreground hover:bg-primary/[0.22]",
        ghost: "text-foreground hover:bg-primary/[0.14]",
        link: "text-primary underline-offset-4 hover:underline",
        cancel: "bg-primary/[0.08] text-foreground hover:bg-destructive/10 hover:text-destructive",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-full px-4",
        lg: "h-11 rounded-full px-6",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

// ¿El botón muestra texto visible? Si lo hace, el CSS global oculta sus iconos
// decorativos (fuera del dashboard). Un <span> con "hidden" o "sr-only" no cuenta.
function hasVisibleLabel(children: React.ReactNode, depth = 0): boolean {
  return React.Children.toArray(children).some((child) => {
    if (typeof child === "string") return child.trim().length > 0;
    if (typeof child === "number") return true;
    if (!React.isValidElement(child)) return false;
    const props = child.props as { className?: string; children?: React.ReactNode };
    if (child.type === "span" || child.type === "p") {
      const tokens = (props.className ?? "").split(/\s+/);
      if (tokens.includes("hidden") || tokens.includes("sr-only")) return false;
      return hasVisibleLabel(props.children, depth + 1);
    }
    // asChild: el texto vive dentro del <Link>/<a> que recibe las props.
    return depth === 0 ? hasVisibleLabel(props.children, depth + 1) : false;
  });
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const hasLabel = hasVisibleLabel(children);
    // Todos los botones son píldora y sin borde; los hovers tenues que llegan por
    // className se descartan para que mande el hover de la variante.
    const shapeClassName = className
      ?.split(/\s+/)
      .filter((token) => !/^(?:[\w-]+:)*!?border(?:-|$)/.test(token))
      .filter((token) => !/^(?:[\w-]+:)*rounded(?:-|$)/.test(token))
      .filter((token) => !/^(?:dark:)?hover:bg-(?:primary(?:\/|$)|muted|accent|secondary|blue-|gray-|slate-)/.test(token))
      .join(" ");
    const hasCancelText = React.Children.toArray(children).some(
      (child) =>
        typeof child === "string" && child.toLowerCase().includes("cancelar")
    );
    const cancelHoverClasses =
      variant === "outline" && hasCancelText
        ? "hover:bg-destructive/10 hover:text-destructive"
        : undefined;

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className: shapeClassName }),
          cancelHoverClasses
        )}
        ref={ref}
        data-variant={variant}
        data-pressable=""
        data-has-label={hasLabel || undefined}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

















