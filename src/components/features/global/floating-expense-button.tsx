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
          onPointerDown={() => {
            const isPwa = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
            if (isPwa && "vibrate" in navigator) navigator.vibrate(12);
          }}
          className="fixed bottom-[calc(0.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 select-none touch-manipulation items-center justify-center rounded-full border border-primary/30 bg-primary text-primary-foreground shadow-xl shadow-primary/20 transition-[transform,background-color,box-shadow] duration-300 hover:scale-105 hover:bg-primary/85 hover:shadow-2xl hover:shadow-primary/30 active:scale-90 active:shadow-md md:bottom-3 md:right-6"
          aria-label="Registrar transacción"
          title="Registrar Ingreso, Gasto o Matrícula"
        >
          <Receipt className="h-6 w-6" />
        </button>
      </TransactionDialog>
    </>
  );
}
