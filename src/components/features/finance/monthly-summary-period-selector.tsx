"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface MonthlySummaryPeriodSelectorProps {
  monthValue: string;
  isCurrentMonth: boolean;
  className?: string;
}

function formatMonthValue(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function shiftMonth(monthValue: string, offset: number) {
  const [year, month] = monthValue.split("-").map(Number);
  return formatMonthValue(new Date(year, month - 1 + offset, 1));
}

function isValidMonthValue(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function MonthlySummaryPeriodSelector({
  monthValue,
  isCurrentMonth,
  className,
}: MonthlySummaryPeriodSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(monthValue);
  const currentMonthValue = formatMonthValue(new Date());

  useEffect(() => {
    setValue(monthValue);
  }, [monthValue]);

  const navigateToMonth = (nextMonthValue: string) => {
    const safeMonthValue = nextMonthValue > currentMonthValue ? currentMonthValue : nextMonthValue;
    const params = new URLSearchParams(searchParams.toString());

    if (safeMonthValue === currentMonthValue) {
      params.delete("month");
    } else {
      params.set("month", safeMonthValue);
    }

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  };

  return (
    <div className={cn("inline-flex w-fit shrink-0 items-center gap-1 rounded-lg border bg-card p-1", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        aria-label="Mes anterior"
        disabled={isPending}
        onClick={() => navigateToMonth(shiftMonth(monthValue, -1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Input
        type="month"
        value={value}
        max={currentMonthValue}
        aria-label="Mes consultado"
        className="h-8 w-[150px] border-0 bg-transparent px-1 text-center text-sm shadow-none focus-visible:ring-0"
        disabled={isPending}
        onChange={(event) => {
          const nextValue = event.target.value;
          setValue(nextValue);

          if (isValidMonthValue(nextValue)) {
            navigateToMonth(nextValue);
          }
        }}
        onBlur={() => {
          if (!isValidMonthValue(value)) {
            setValue(monthValue);
          }
        }}
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        aria-label="Mes siguiente"
        disabled={isPending || isCurrentMonth}
        onClick={() => navigateToMonth(shiftMonth(monthValue, 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {!isCurrentMonth && (
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" disabled={isPending} onClick={() => navigateToMonth(currentMonthValue)}>
          <RotateCcw className="h-3.5 w-3.5" />
          Hoy
        </Button>
      )}
    </div>
  );
}
