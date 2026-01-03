"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn, checkPasswordStrength } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  showStrengthMeter?: boolean;
  onStrengthChange?: (score: number) => void;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, value, showStrengthMeter = false, onStrengthChange, ...props }, ref) => {
    const [isVisible, setIsVisible] = React.useState(false);
    const [strength, setStrength] = React.useState(checkPasswordStrength(""));

    // Asegurar que el valor sea siempre un string (evita el error de controlled/uncontrolled)
    const stringValue = value ? String(value) : "";

    // Actualizar fortaleza cuando cambia el valor
    React.useEffect(() => {
      const result = checkPasswordStrength(stringValue);
      setStrength(result);
      if (onStrengthChange) {
        onStrengthChange(result.score);
      }
    }, [stringValue, onStrengthChange]);

    const toggleVisibility = () => setIsVisible((prev) => !prev);

    return (
      <div className="space-y-2">
        <div className="relative">
          <Input
            type={isVisible ? "text" : "password"}
            className={cn("pr-10", className)}
            ref={ref}
            value={stringValue} // Siempre string
            {...props}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
            onClick={toggleVisibility}
            disabled={props.disabled}
          >
            {isVisible ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>

        {showStrengthMeter && stringValue.length > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Fortaleza: {strength.label}</span>
              <span>{Math.round((strength.score / 4) * 100)}%</span>
            </div>
            <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className={cn("h-full transition-all duration-300 ease-in-out", strength.color)}
                style={{ width: strength.width }}
              />
            </div>
            <div className="flex gap-1 mt-1">
              <div className={cn("h-1 w-1/4 rounded-full", strength.score >= 1 ? "bg-green-500" : "bg-gray-300")} />
              <div className={cn("h-1 w-1/4 rounded-full", strength.score >= 2 ? "bg-green-500" : "bg-gray-300")} />
              <div className={cn("h-1 w-1/4 rounded-full", strength.score >= 3 ? "bg-green-500" : "bg-gray-300")} />
              <div className={cn("h-1 w-1/4 rounded-full", strength.score >= 4 ? "bg-green-500" : "bg-gray-300")} />
            </div>
          </div>
        )}
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";
