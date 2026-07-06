import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/push/search-users?q=query
 * Searches users by name or email. Admin-only.
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.roleLegacy !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    if (query.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const users = await db.user.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        roleLegacy: true,
      },
      take: 10,
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.roleLegacy,
      })),
    });
  } catch (error) {
    console.error("[Push SearchUsers] Error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
