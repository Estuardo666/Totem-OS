"use client";

import Link from "next/link";
import { DollarSign, Plus, Video } from "lucide-react";
import { TransactionDialog } from "@/components/features/finance/transaction-dialog";

export function FloatingActionBar() {
  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 md:hidden">
      <div className="grid grid-cols-3 items-center rounded-[999px] border border-white/10 bg-slate-950/70 p-1 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl">
        <Link
          href="/content/new"
          className="group flex flex-col items-center justify-center gap-1 rounded-full px-2 py-2 text-[11px] font-medium text-slate-100/80 transition hover:text-white"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition group-hover:bg-white/20">
            <Plus className="h-4 w-4" />
          </span>
          Crear tarea
        </Link>

        <Link
          href="/content/shoots?new=1"
          className="group flex flex-col items-center justify-center gap-1 rounded-full px-2 py-2 text-[11px] font-medium text-slate-100/80 transition hover:text-white"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition group-hover:bg-white/20">
            <Video className="h-4 w-4" />
          </span>
          Crear rodaje
        </Link>

        <TransactionDialog defaultTab="expense">
          <button
            type="button"
            className="group flex w-full flex-col items-center justify-center gap-1 rounded-full px-2 py-2 text-[11px] font-medium text-slate-100/80 transition hover:text-white"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition group-hover:bg-white/20">
              <DollarSign className="h-4 w-4" />
            </span>
            Crear gasto
          </button>
        </TransactionDialog>
      </div>
    </div>
  );
}
