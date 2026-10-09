import Link from "next/link";
import { cn } from "@/lib/utils";

export function FinanceViewToggle({ basePath, advanced, month }: { basePath: string; advanced: boolean; month?: string }) {
  const query = (view?: string) => {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (view) params.set("view", view);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const item = (active: boolean) =>
    cn("rounded-md px-3 py-1.5 text-sm font-medium transition-colors", active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground");

  return (
    <div className="inline-flex rounded-lg bg-muted p-1">
      <Link href={query()} className={item(!advanced)}>Simple</Link>
      <Link href={query("advanced")} className={item(advanced)}>Avanzada</Link>
    </div>
  );
}
