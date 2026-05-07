import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

function normalizeDecimalSeparator(input: HTMLInputElement) {
  if (input.type !== "number" || !input.value.includes(",")) {
    return;
  }

  input.value = input.value.replace(/,/g, ".");
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, inputMode, onChange, onInput, ...props }, ref) => {
    return (
      <input
        type={type}
        inputMode={inputMode ?? (type === "number" ? "decimal" : undefined)}
        className={cn(
          "flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:hover:bg-gray-750 dark:text-white hover:bg-gray-50 transition-colors duration-150",
          className
        )}
        ref={ref}
        {...props}
        onInput={(event) => {
          normalizeDecimalSeparator(event.currentTarget);
          onInput?.(event);
        }}
        onChange={(event) => {
          normalizeDecimalSeparator(event.currentTarget);
          onChange?.(event);
        }}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };

















