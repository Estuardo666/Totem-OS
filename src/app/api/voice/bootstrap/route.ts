import { NextResponse } from "next/server";
import { getClients } from "@/actions/client-actions";
import { getUsers } from "@/actions/user.actions";

export async function GET() {
  try {
    const [clientsResult, usersResult] = await Promise.all([
      getClients(),
      getUsers(),
    ]);

    if (!clientsResult.success || !clientsResult.data) {
      return NextResponse.json({ error: clientsResult.error || "No se pudieron obtener los clientes" }, { status: 500 });
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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error interno" }, { status: 500 });
  }
}
