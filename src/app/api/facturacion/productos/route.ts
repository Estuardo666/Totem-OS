// API Route CRUD de Productos de Facturación
// GET /api/facturacion/productos - Listar
// POST /api/facturacion/productos - Crear
// PUT /api/facturacion/productos - Actualizar
// DELETE /api/facturacion/productos?id=xxx - Eliminar

import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";

export async function GET() {
  try {
    const productos = await prisma.productoFacturacion.findMany({
      orderBy: { descripcion: "asc" },
    });
    return NextResponse.json(productos);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { codigo, descripcion, precioUnitario, tipoIva, unidad } = body;

    if (!codigo || !descripcion) {
      return NextResponse.json({ error: "Código y descripción requeridos" }, { status: 400 });
    }

    const existe = await prisma.productoFacturacion.findUnique({ where: { codigo } });
    if (existe) {
      return NextResponse.json({ error: `Ya existe un producto con código ${codigo}` }, { status: 409 });
    }

    const producto = await prisma.productoFacturacion.create({
      data: {
        codigo,
        descripcion,
        precioUnitario: parseFloat(precioUnitario) || 0,
        tipoIva: tipoIva ?? "4",
        unidad: unidad ?? "SERVICIO",
      },
    });

    return NextResponse.json(producto, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, codigo, descripcion, precioUnitario, tipoIva, unidad } = body;

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const producto = await prisma.productoFacturacion.update({
      where: { id },
      data: {
        codigo,
        descripcion,
        precioUnitario: parseFloat(precioUnitario) || 0,
        tipoIva,
        unidad,
      },
    });

    return NextResponse.json(producto);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    await prisma.productoFacturacion.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
