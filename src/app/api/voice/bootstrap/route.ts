import { NextResponse } from "next/server";
import { getClients } from "@/actions/client-actions";
import { getUsers } from "@/actions/user.actions";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";

export async function GET(request: Request) {
  try {
    // Verificar que Prisma esté disponible
    if (!process.env.DATABASE_URL) {
      console.warn("[Bootstrap] DATABASE_URL no configurada");
      return NextResponse.json({ 
        clients: [], 
        users: [],
        warning: "Base de datos no disponible" 
      });
    }

    // Rate limiting: 60 requests per minute per IP (bootstrap es más frecuente)
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(clientIP, "voice-bootstrap", 60, 60 * 1000);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: "Demasiados intentos. Inténtalo más tarde.",
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": (rateLimitResult.retryAfter ?? 60).toString(),
          },
        }
      );
    }

    const [clientsResult, usersResult] = await Promise.all([
      getClients(),
      getUsers(),
    ]);

    if (!clientsResult.success || !clientsResult.data) {
      console.error("[Bootstrap] Error obteniendo clientes:", clientsResult.error);
      return NextResponse.json({ 
        clients: [], 
        users: [],
        warning: clientsResult.error || "No se pudieron obtener los datos" 
      });
    }

    const clients = clientsResult.data.map((client) => ({
      id: client.id,
      name: client.name,
      logo: client.logo ?? undefined,
      color: (client as any).color ?? undefined,
    }));

    const users = usersResult.success && usersResult.data 
      ? usersResult.data.map((user) => ({
          id: user.id,
          name: user.name || "",
          email: user.email || "",
          role: user.role,
        }))
      : [];

    return NextResponse.json({ clients, users });
  } catch (error) {
    console.error("[Bootstrap] Error general:", error);
    // No fallar con 500, devolver datos vacíos
    return NextResponse.json({ 
      clients: [], 
      users: [],
      warning: error instanceof Error ? error.message : "Error interno" 
    });
  }
}
