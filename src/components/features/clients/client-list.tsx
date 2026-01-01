"use client";

import { format } from "date-fns";
import Link from "next/link";
import type { Client } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

interface ClientListProps {
  clients: Client[];
}

export function ClientList({ clients }: ClientListProps) {
  if (clients.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground text-center text-lg">
            No hay clientes aún
          </p>
          <p className="text-muted-foreground mt-2 text-center text-sm">
            Crea tu primer cliente para comenzar
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Último Post</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id} className="cursor-pointer hover:bg-muted/50">
              <TableCell className="font-medium">
                <Link href={`/clients/${client.id}`} className="hover:underline">
                  {client.name}
                </Link>
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    client.status === "ACTIVE" ? "default" : "secondary"
                  }
                  className={
                    client.status === "ACTIVE"
                      ? "bg-green-500 hover:bg-green-600 text-white border-transparent"
                      : "bg-gray-500 hover:bg-gray-600 text-white border-transparent"
                  }
                >
                  {client.status === "ACTIVE"
                    ? "Activo"
                    : client.status === "PAUSED"
                      ? "Pausado"
                      : "En Deuda"}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {client.lastPostDate
                  ? format(new Date(client.lastPostDate), "dd/MM/yyyy")
                  : "Nunca"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

