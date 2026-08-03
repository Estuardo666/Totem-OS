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
          className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary text-primary-foreground shadow-xl shadow-primary/20 transition-all duration-300 hover:scale-110 hover:bg-primary/85 hover:shadow-2xl hover:shadow-primary/30 active:scale-95"
          aria-label="Registrar transacción"
          title="Registrar Ingreso, Gasto o Matrícula"
        >
          <Receipt className="h-6 w-6" />
        </button>
      </TransactionDialog>
    </>
  );
}
