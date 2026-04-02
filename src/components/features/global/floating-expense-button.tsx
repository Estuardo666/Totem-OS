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
          className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#27221F] text-[#A8E635] shadow-xl shadow-[#27221F]/30 transition-all duration-300 hover:scale-110 hover:shadow-2xl hover:shadow-[#27221F]/40 active:scale-95 border border-[#3d3530]"
          aria-label="Registrar transacción"
          title="Registrar Ingreso, Gasto o Matrícula"
        >
          <Receipt className="h-6 w-6" />
        </button>
      </TransactionDialog>
    </>
  );
}
