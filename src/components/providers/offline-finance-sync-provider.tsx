"use client";

import { startTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  createExpense,
  createInvoice,
  createTransaction,
  markExpenseAsReimbursed,
  markInvoiceAsPaid,
  markRecurringAsPaid,
  markTransactionAsPaid,
} from "@/actions/finance-actions";
import {
  readFinanceQueue,
  removeFinanceAction,
  subscribeFinanceOffline,
} from "@/lib/finance-offline-store";
import type { FinanceOfflineQueueItem } from "@/lib/finance-offline-types";
import { useToast } from "@/components/ui/use-toast";

type SyncResult = {
  success: boolean;
  error?: string;
};

async function executeQueueItem(item: FinanceOfflineQueueItem): Promise<SyncResult> {
  switch (item.kind) {
    case "CREATE_INVOICE":
      return createInvoice(item.payload);
    case "CREATE_EXPENSE":
      return createExpense(item.payload);
    case "CREATE_TRANSACTION":
      return createTransaction(item.payload);
    case "MARK_INVOICE_PAID":
      return markInvoiceAsPaid(item.payload.invoiceId);
    case "MARK_TRANSACTION_PAID":
      return markTransactionAsPaid(item.payload.transactionId);
    case "MARK_RECURRING_PAID":
      return markRecurringAsPaid(item.payload.recurringId, item.payload.amount);
    case "MARK_EXPENSE_REIMBURSED":
      return markExpenseAsReimbursed(item.payload.expenseId);
    default:
      return { success: false, error: "Operación offline no soportada" };
  }
}

export function OfflineFinanceSyncProvider() {
  const router = useRouter();
  const { toast } = useToast();
  const { status } = useSession();
  const syncingRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    const syncQueue = async () => {
      if (syncingRef.current) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;

      const queue = readFinanceQueue();
      if (queue.length === 0) return;

      syncingRef.current = true;
      let syncedCount = 0;

      try {
        for (const item of queue) {
          const result = await executeQueueItem(item);

          if (!result.success) {
            toast({
              variant: "destructive",
              title: "No se pudo sincronizar finanzas",
              description:
                result.error ||
                "La cola offline se mantuvo intacta para reintentar luego.",
            });
            break;
          }

          removeFinanceAction(item.id);
          syncedCount += 1;
        }

        if (syncedCount > 0) {
          toast({
            title: "Finanzas sincronizadas",
            description: `${syncedCount} operación(es) offline ya se registraron en el servidor.`,
          });

          startTransition(() => {
            router.refresh();
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error de sincronización",
          description:
            error instanceof Error
              ? error.message
              : "No se pudieron sincronizar las operaciones offline.",
        });
      } finally {
        syncingRef.current = false;
      }
    };

    const handleOnline = () => {
      void syncQueue();
    };

    const unsubscribe = subscribeFinanceOffline(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        void syncQueue();
      }
    });

    window.addEventListener("online", handleOnline);
    void syncQueue();

    return () => {
      unsubscribe();
      window.removeEventListener("online", handleOnline);
    };
  }, [router, status, toast]);

  return null;
}