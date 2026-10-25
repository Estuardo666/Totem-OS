import { PrismaClient } from "@prisma/client";
import { db as applicationDb } from "../db";
import { resolveSriDatabaseUrl } from "./execution-policy";

const url = resolveSriDatabaseUrl(process.env.SRI_AMBIENTE, process.env.SRI_DATABASE_URL, process.env.DATABASE_URL);
const globalSri = globalThis as unknown as { sriPrisma?: PrismaClient };

// A separate datasource keeps certification records out of the live app's DB.
export const db = url
  ? globalSri.sriPrisma ?? new PrismaClient({ datasourceUrl: url })
  : applicationDb;
if (url) globalSri.sriPrisma = db;
