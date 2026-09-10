"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Abre el diálogo de impresión del navegador, que también permite "Guardar
 * como PDF".
 *
 * Es la vía elegida frente a generar el PDF en el servidor: el resultado es
 * por construcción idéntico a lo que el cliente ve en pantalla, y no obliga a
 * redibujar cada gráfico en un segundo motor de render.
 */
export function PrintReportButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => window.print()}
      className="shrink-0 print:hidden"
    >
      <Printer className="mr-2 h-4 w-4" aria-hidden />
      Guardar PDF
    </Button>
  );
}
