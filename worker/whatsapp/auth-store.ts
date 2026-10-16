import { BufferJSON, initAuthCreds, proto, type AuthenticationState, type SignalDataTypeMap } from "@whiskeysockets/baileys";
import { db } from "../../src/lib/db";

const encode = (value: unknown) => JSON.parse(JSON.stringify(value, BufferJSON.replacer));
const decode = <T>(value: unknown): T => JSON.parse(JSON.stringify(value), BufferJSON.reviver) as T;

export async function useWhatsAppAuthState(): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const initial = await db.whatsAppAuth.findUnique({ where: { id: "creds" } });
  const creds = initial ? decode<AuthenticationState["creds"]>(initial.data) : initAuthCreds();
  const state: AuthenticationState = {
    creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
        const rows = await db.whatsAppAuth.findMany({ where: { id: { in: ids.map((id) => `${type}:${id}`) } } });
        const byId = new Map(rows.map((row) => [row.id, row.data]));
        return Object.fromEntries(ids.map((id) => {
          const value = byId.get(`${type}:${id}`);
          if (value == null) return [id, undefined];
          const decoded = decode<SignalDataTypeMap[T]>(value);
          return [id, type === "app-state-sync-key" ? proto.Message.AppStateSyncKeyData.fromObject(decoded as never) as unknown as SignalDataTypeMap[T] : decoded];
        })) as { [id: string]: SignalDataTypeMap[T] };
      },
      set: async (data) => {
        const writes: Array<Promise<unknown>> = [];
        for (const [type, entries] of Object.entries(data) as Array<[string, Record<string, unknown> | undefined]>) {
          for (const [id, value] of Object.entries(entries ?? {})) {
            const key = `${type}:${id}`;
            if (value == null) writes.push(db.whatsAppAuth.deleteMany({ where: { id: key } }));
            else writes.push(db.whatsAppAuth.upsert({ where: { id: key }, create: { id: key, data: encode(value) }, update: { data: encode(value) } }));
          }
        }
        await Promise.all(writes);
      },
    },
  };
  return {
    state,
    saveCreds: async () => {
      await db.whatsAppAuth.upsert({ where: { id: "creds" }, create: { id: "creds", data: encode(state.creds) }, update: { data: encode(state.creds) } });
    },
  };
}
