import { NextResponse } from "next/server";
import { getClients } from "@/actions/client-actions";

export async function GET() {
  try {
    const result = await getClients();
    if (!result.success || !result.data) {
      return NextResponse.json({ error: result.error || "No se pudieron obtener los clientes" }, { status: 500 });
    }

    const clients = result.data.map((client) => ({
      id: client.id,
      name: client.name,
      logo: client.logo ?? undefined,
      color: (client as any).color ?? undefined,
    }));

    return NextResponse.json({ clients });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error interno" }, { status: 500 });
  }
}
