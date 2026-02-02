import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[1.25rem] text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 dark:text-[#ffffff]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:text-[#ffffff]",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-[#ffffff]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 dark:bg-gray-700 dark:text-[#ffffff] dark:hover:bg-gray-600",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-gray-700 dark:text-[#ffffff]",
        link: "text-primary underline-offset-4 hover:underline dark:text-blue-400",
        cancel: "border-2 border-gray-300 bg-background hover:!border-red-500 hover:bg-red-50 hover:text-red-600 dark:border-gray-600 dark:bg-gray-800 dark:hover:!border-red-500 dark:hover:bg-red-950 dark:text-[#ffffff] dark:hover:text-red-400 transition-all duration-200",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-[1.25rem] px-3",
        lg: "h-11 rounded-[1.25rem] px-8",
        icon: "h-10 w-10 rounded-[1.25rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const hasCancelText = React.Children.toArray(children).some(
      (child) =>
        typeof child === "string" && child.toLowerCase().includes("cancelar")
    );
    const cancelHoverClasses =
      variant === "outline" && hasCancelText
        ? "hover:!border-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
        : undefined;

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          cancelHoverClasses
        )}
        ref={ref}
        data-variant={variant}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

















