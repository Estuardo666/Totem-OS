"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ProductionRadarProps {
  radar: {
    IDEA: number;
    RECORDED: number;
    EDITING: number;
    REVIEW_CLIENT: number;
    CLIENT_APPROVED: number;
    PUBLISHED: number;
    shootsThisMonth: number;
  };
}

const statusLabels: Record<keyof Omit<ProductionRadarProps["radar"], "shootsThisMonth">, string> = {
  IDEA: "Idea",
  RECORDED: "Grabado",
  EDITING: "Editando",
  REVIEW_CLIENT: "Revisión Cliente",
  CLIENT_APPROVED: "Aprobado Cliente",
  PUBLISHED: "Publicado",
};

const statusColors: Record<keyof Omit<ProductionRadarProps["radar"], "shootsThisMonth">, string> = {
  IDEA: "bg-blue-500",
  RECORDED: "bg-purple-500",
  EDITING: "bg-yellow-500",
  REVIEW_CLIENT: "bg-pink-500",
  CLIENT_APPROVED: "bg-green-500",
  PUBLISHED: "bg-teal-500",
};

export function ProductionRadar({ radar }: ProductionRadarProps) {
  const statuses: Array<keyof Omit<ProductionRadarProps["radar"], "shootsThisMonth">> = [
    "IDEA",
    "RECORDED",
    "EDITING",
    "REVIEW_CLIENT",
    "CLIENT_APPROVED",
    "PUBLISHED",
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Radar de Producción</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {statuses.map((status) => (
            <div
              key={status}
              className="flex flex-col items-center justify-center p-4 rounded-lg border bg-card"
            >
              <div className={`w-3 h-3 rounded-full mb-2 ${statusColors[status]}`} />
              <div className="text-3xl font-bold mb-1">{radar[status]}</div>
              <div className="text-xs text-muted-foreground text-center">
                {statusLabels[status]}
              </div>
            </div>
          ))}
          {/* Tarjeta destacada para Rodajes del Mes */}
          <div className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-primary bg-primary/5">
            <div className="w-3 h-3 rounded-full mb-2 bg-primary" />
            <div className="text-3xl font-bold mb-1">{radar.shootsThisMonth}</div>
            <div className="text-xs text-muted-foreground text-center">
              Rodajes del Mes
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

