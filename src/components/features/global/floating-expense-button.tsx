"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Receipt, X } from "lucide-react";
import { TransactionDialog } from "@/components/features/finance/transaction-dialog";

export function FloatingExpenseButton() {
  const pathname = usePathname();
  
  // Ocultar en páginas donde no tiene sentido mostrar el botón
  const isHidden =
    pathname?.startsWith("/sign-in") ||
    pathname?.startsWith("/sign-up") ||
    pathname?.startsWith("/admin/voice-control");

  const [open, setOpen] = useState(false);

  if (isHidden) {
    return null;
  }

  return (
    <>
      {/* Botón flotante */}
      <TransactionDialog>
        <button
          className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-emerald-500 text-white shadow-xl shadow-emerald-500/30 transition-all duration-300 hover:scale-110 hover:shadow-2xl hover:shadow-emerald-500/40 active:scale-95 border border-emerald-400/30"
          aria-label="Registrar transacción"
          title="Registrar Ingreso, Gasto o Matrícula"
        >
          <Receipt className="h-6 w-6" />
        </button>
      </TransactionDialog>
    </>
  );
}
