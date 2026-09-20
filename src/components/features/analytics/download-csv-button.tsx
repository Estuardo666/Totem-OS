"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DownloadCsvButtonProps {
  /** Función que produce el CSV en el momento del clic, no antes. */
  build: () => string;
  filename: string;
  label?: string;
}

/**
 * Descarga un CSV generado en el navegador.
 *
 * Mismo mecanismo que la exportación de finanzas: Blob + enlace temporal, sin
 * pasar por el servidor. El CSV se arma en el clic para que siempre refleje el
 * período que está viendo el usuario.
 */
export function DownloadCsvButton({ build, filename, label = "Exportar CSV" }: DownloadCsvButtonProps) {
  const handleDownload = () => {
    // BOM para que Excel en Windows abra los acentos correctamente.
    const blob = new Blob([`﻿${build()}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
      <Download className="mr-2 h-4 w-4" aria-hidden />
      {label}
    </Button>
  );
}
