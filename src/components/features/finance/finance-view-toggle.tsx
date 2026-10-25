import Link from "next/link";
import { segmentedTrack, segmentedItemClass } from "@/components/ui/segmented";

export function FinanceViewToggle({ basePath, advanced, month }: { basePath: string; advanced: boolean; month?: string }) {
  const query = (view?: string) => {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (view) params.set("view", view);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const item = (active: boolean) => segmentedItemClass(active);

  return (
    <div className={segmentedTrack}>
      <Link href={query()} className={item(!advanced)}>Simple</Link>
      <Link href={query("advanced")} className={item(advanced)}>Avanzada</Link>
    </div>
  );
}
