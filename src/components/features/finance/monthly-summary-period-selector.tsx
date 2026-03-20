"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
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
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[1.75rem] border border-border/60 bg-card/90 p-3 shadow-sm sm:flex-row sm:items-center",
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays className="h-4 w-4" />
        <span>Mes consultado</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="rounded-full"
          disabled={isPending}
          onClick={() => navigateToMonth(shiftMonth(monthValue, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Input
          type="month"
          value={value}
          max={currentMonthValue}
          className="w-full min-w-[180px] rounded-full sm:w-[190px]"
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
          variant="outline"
          size="icon"
          className="rounded-full"
          disabled={isPending || isCurrentMonth}
          onClick={() => navigateToMonth(shiftMonth(monthValue, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {!isCurrentMonth && (
          <Button
            type="button"
            variant="ghost"
            className="rounded-full px-3"
            disabled={isPending}
            onClick={() => navigateToMonth(currentMonthValue)}
          >
            <RotateCcw className="h-4 w-4" />
            Mes actual
          </Button>
        )}
      </div>
    </div>
  );
}