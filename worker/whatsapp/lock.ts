import { db } from "../../src/lib/db";
import { createWhatsAppLockStore } from "./lock-store";

const LOCK_ID = "default";
const STALE_AFTER_MS = 120_000;

const lockStore = createWhatsAppLockStore(db.whatsAppLock);
export const acquireWhatsAppLock = lockStore.acquire;
export const refreshWhatsAppLock = lockStore.refresh;
export const releaseWhatsAppLock = lockStore.release;
