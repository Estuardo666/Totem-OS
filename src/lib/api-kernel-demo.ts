import { z } from "zod";
import {
  ApiProblem,
  apiSuccess,
  decodeCursor,
  encodeCursor,
  methodNotAllowed,
  parseCursorPage,
  readJsonBody,
  type ApiRequestContext,
} from "./api-kernel.ts";

const echoBodySchema = z.object({
  message: z.string().trim().min(1).max(280),
}).strict();

const demoCursorSchema = z.object({
  version: z.literal(1),
  offset: z.number().int().min(0).max(60),
});

const DEMO_ITEMS = Array.from({ length: 60 }, (_, index) => ({
  id: `kernel-item-${String(index + 1).padStart(2, "0")}`,
  label: `Kernel item ${index + 1}`,
}));

/** Endpoint stateless de contrato; no accede a datos de negocio ni a Prisma. */
export async function handleKernelEcho(context: ApiRequestContext): Promise<Response> {
  if (context.request.method === "GET") {
    const { cursor, limit } = parseCursorPage(new URL(context.request.url));
    const decoded = cursor
      ? decodeCursor(cursor, demoCursorSchema)
      : { version: 1 as const, offset: 0 };

    if (decoded.offset > DEMO_ITEMS.length) {
      throw new ApiProblem({
        status: 400,
        code: "INVALID_CURSOR",
        title: "Invalid cursor",
        detail: "The cursor points beyond the available collection.",
      });
    }

    const items = DEMO_ITEMS.slice(decoded.offset, decoded.offset + limit);
    const nextOffset = decoded.offset + items.length;
    const hasMore = nextOffset < DEMO_ITEMS.length;

    return apiSuccess(context, items, {
      pagination: {
        limit,
        hasMore,
        nextCursor: hasMore
          ? encodeCursor({ version: 1, offset: nextOffset })
          : null,
      },
    });
  }

  if (context.request.method === "POST") {
    const body = await readJsonBody(context, echoBodySchema);
    return apiSuccess(context, { echo: body.message });
  }

  throw methodNotAllowed(["GET", "POST"]);
}
