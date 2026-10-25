"use client";

interface ProductionRadarProps {
  radar: {
    IDEA: number;
    SCRIPT: number;
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
  SCRIPT: "Guión",
  RECORDED: "Grabado",
  EDITING: "Editando",
  REVIEW_CLIENT: "Revisión Cliente",
  CLIENT_APPROVED: "Aprobado Cliente",
  PUBLISHED: "Publicado",
};

const statusColors: Record<keyof Omit<ProductionRadarProps["radar"], "shootsThisMonth">, { bg: string; dot: string }> = {
  IDEA: { bg: "bg-blue-50 dark:bg-blue-950/30", dot: "bg-blue-500" },
  SCRIPT: { bg: "bg-sky-50 dark:bg-sky-950/30", dot: "bg-sky-500" },
  RECORDED: { bg: "bg-purple-50 dark:bg-purple-950/30", dot: "bg-purple-500" },
  EDITING: { bg: "bg-yellow-50 dark:bg-yellow-950/30", dot: "bg-yellow-500" },
  REVIEW_CLIENT: { bg: "bg-pink-50 dark:bg-pink-950/30", dot: "bg-pink-500" },
  CLIENT_APPROVED: { bg: "bg-green-50 dark:bg-green-950/30", dot: "bg-green-500" },
  PUBLISHED: { bg: "bg-teal-50 dark:bg-teal-950/30", dot: "bg-teal-500" },
};

export function ProductionRadar({ radar }: ProductionRadarProps) {
  const statuses: Array<keyof Omit<ProductionRadarProps["radar"], "shootsThisMonth">> = [
    "IDEA",
    "SCRIPT",
    "RECORDED",
    "EDITING",
    "REVIEW_CLIENT",
    "CLIENT_APPROVED",
    "PUBLISHED",
  ];

  return (
    <div className="rounded-2xl bg-card p-6 space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Radar de Producción</h2>
        <p className="text-sm text-muted-foreground">Estado de tus proyectos en producción</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {statuses.map((status) => (
          <div
            key={status}
            className={`flex flex-col items-center justify-center p-4 rounded-lg ${statusColors[status].bg}`}
          >
            <div className={`w-2.5 h-2.5 rounded-full mb-2 ${statusColors[status].dot}`} />
            <div className="text-2xl font-semibold tabular-nums mb-1">{radar[status]}</div>
            <div className="text-xs text-muted-foreground text-center leading-tight">
              {statusLabels[status]}
            </div>
          </div>
        ))}
        {/* Tarjeta destacada para Rodajes del Mes */}
        <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-primary/[0.12]">
          <div className="w-2.5 h-2.5 rounded-full mb-2 bg-primary" />
          <div className="text-2xl font-semibold tabular-nums mb-1">{radar.shootsThisMonth}</div>
          <div className="text-xs text-primary text-center leading-tight font-medium">
            Rodajes Mes
          </div>
        </div>
      </div>
    </div>
  );
}

