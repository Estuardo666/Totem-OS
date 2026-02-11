"use client";

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
  IDEA: "Guión",
  RECORDED: "Grabado",
  EDITING: "Editando",
  REVIEW_CLIENT: "Revisión Cliente",
  CLIENT_APPROVED: "Aprobado Cliente",
  PUBLISHED: "Publicado",
};

const statusColors: Record<keyof Omit<ProductionRadarProps["radar"], "shootsThisMonth">, { bg: string; dot: string }> = {
  IDEA: { bg: "bg-blue-50 dark:bg-blue-950/30", dot: "bg-blue-500" },
  RECORDED: { bg: "bg-purple-50 dark:bg-purple-950/30", dot: "bg-purple-500" },
  EDITING: { bg: "bg-yellow-50 dark:bg-yellow-950/30", dot: "bg-yellow-500" },
  REVIEW_CLIENT: { bg: "bg-pink-50 dark:bg-pink-950/30", dot: "bg-pink-500" },
  CLIENT_APPROVED: { bg: "bg-green-50 dark:bg-green-950/30", dot: "bg-green-500" },
  PUBLISHED: { bg: "bg-teal-50 dark:bg-teal-950/30", dot: "bg-teal-500" },
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
    <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow p-6 space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-bold">Radar de Producción</h2>
        <p className="text-sm text-muted-foreground">Estado de tus proyectos en producción</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {statuses.map((status) => (
          <div
            key={status}
            className={`flex flex-col items-center justify-center p-4 rounded-2xl border border-border/50 ${statusColors[status].bg} hover:border-border transition-colors`}
          >
            <div className={`w-2.5 h-2.5 rounded-full mb-2 ${statusColors[status].dot}`} />
            <div className="text-2xl font-bold mb-1">{radar[status]}</div>
            <div className="text-xs text-muted-foreground text-center leading-tight">
              {statusLabels[status]}
            </div>
          </div>
        ))}
        {/* Tarjeta destacada para Rodajes del Mes */}
        <div className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-blue-400 dark:border-blue-600 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30 hover:border-blue-500 transition-all shadow-md">
          <div className="w-2.5 h-2.5 rounded-full mb-2 bg-blue-500" />
          <div className="text-2xl font-bold mb-1">{radar.shootsThisMonth}</div>
          <div className="text-xs text-blue-700 dark:text-blue-300 text-center leading-tight font-medium">
            Rodajes Mes
          </div>
        </div>
      </div>
    </div>
  );
}

