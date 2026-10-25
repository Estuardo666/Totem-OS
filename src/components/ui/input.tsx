import * as React from "react";

import { cn, withoutShape } from "@/lib/utils";

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
          "flex h-10 w-full min-w-0 rounded-full border border-transparent bg-foreground/[0.045] px-4 py-2 text-sm text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:bg-primary/[0.1] focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-260 ease-soft",
          withoutShape(className)
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

















