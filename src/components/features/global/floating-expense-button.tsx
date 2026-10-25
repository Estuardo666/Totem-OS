"use client";

import { usePathname } from "next/navigation";
import { Receipt } from "lucide-react";
import { TransactionDialog } from "@/components/features/finance/transaction-dialog";

export function FloatingExpenseButton() {
  const pathname = usePathname();
  
  // Ocultar en páginas donde no tiene sentido mostrar el botón
  const isHidden =
    pathname?.startsWith("/sign-in") ||
    pathname?.startsWith("/sign-up");

  if (isHidden) {
    return null;
  }

  return (
    <>
      {/* Botón flotante */}
      <TransactionDialog>
        <button
          data-totem-web-chrome
          onPointerDown={() => {
            const isPwa = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
            if (isPwa && "vibrate" in navigator) navigator.vibrate(12);
          }}
          className="fixed bottom-[calc(0.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-[3.25rem] w-[3.25rem] select-none touch-manipulation items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-[transform,background-color] duration-200 ease-out hover:bg-primary/85 active:scale-95 md:bottom-3 md:right-6"
          aria-label="Registrar transacción"
          title="Registrar Ingreso, Gasto o Matrícula"
        >
          <Receipt className="h-5 w-5" />
        </button>
      </TransactionDialog>
    </>
  );
}
