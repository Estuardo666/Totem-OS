"use client";

import { useEffect, useState } from "react";
import { Calendar, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface FinanceHeaderActionsProps {
  clientPlans?: Array<{
    id: string;
    name: string;
    monthlyRate: number;
    monthlyReels: number;
    monthlyShoots: number;
    status: string;
  }>;
}

export function FinanceHeaderActions({ clientPlans = [] }: FinanceHeaderActionsProps) {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [timeAgo, setTimeAgo] = useState<string>("ahora");

  // Función para calcular el tiempo transcurrido
  const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return "ahora";
    if (seconds < 3600) return `hace ${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)}h`;
    return `hace ${Math.floor(seconds / 86400)}d`;
  };

  // Actualizar el tiempo cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeAgo(getTimeAgo(lastUpdate));
    }, 60000);

    return () => clearInterval(interval);
  }, [lastUpdate]);

  // Actualizar tiempo cuando cambian los datos
  useEffect(() => {
    setLastUpdate(new Date());
    setTimeAgo("ahora");
    
    const timer = setTimeout(() => {
      setTimeAgo(getTimeAgo(new Date()));
    }, 60000);

    return () => clearTimeout(timer);
  }, [clientPlans]);

  const handleExportReport = () => {
    const csvContent = [
      ['Cliente', 'Tarifa Mensual', 'Reels', 'Rodajes', 'Estado'],
      ...clientPlans.map(plan => [
        plan.name,
        plan.monthlyRate.toString(),
        plan.monthlyReels.toString(),
        plan.monthlyShoots.toString(),
        plan.status
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `finance_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="border-emerald-200 text-emerald-700 rounded-full">
        Tiempo real
      </Badge>
      <Button variant="outline" size="sm" className="gap-2 rounded-full">
        <Calendar className="h-4 w-4" />
        Actualizado {timeAgo}
      </Button>
      <Button size="sm" className="gap-2 rounded-full shadow-sm" onClick={handleExportReport}>
        <Download className="h-4 w-4" />
        <span className="hidden md:inline">Exportar reporte</span>
      </Button>
    </div>
  );
}
