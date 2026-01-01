"use client";

import { useState, useTransition, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Facebook, Instagram, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { linkPageToClient, getManagedMetaPages, type getConnectedMetaAccount } from "@/actions/meta-actions";
import { getClients } from "@/actions/client-actions";
import type { Client } from "@prisma/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface DetectedPagesListProps {
  metaAccount: NonNullable<Awaited<ReturnType<typeof getConnectedMetaAccount>>["data"]>;
}

export function DetectedPagesList({ metaAccount }: DetectedPagesListProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [pages, setPages] = useState<
    Array<{
      id: string;
      name: string;
      access_token: string;
      instagramAccount: {
        id: string;
        username: string;
      } | null;
    }>
  >([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClients, setSelectedClients] = useState<Record<string, string>>({});
  const [linkedPages, setLinkedPages] = useState<Set<string>>(new Set());

  // Cargar páginas y clientes al montar
  useEffect(() => {
    startTransition(async () => {
      try {
        const [pagesResult, clientsResult] = await Promise.all([
          getManagedMetaPages(),
          getClients(),
        ]);

        if (pagesResult.success && pagesResult.data) {
          setPages(pagesResult.data);
          
          // Pre-cargar páginas ya vinculadas
          const linked = new Set<string>();
          if (clientsResult.success && clientsResult.data) {
            clientsResult.data.forEach((client) => {
              if (client.facebookPageId) {
                linked.add(client.facebookPageId);
                setSelectedClients((prev) => ({
                  ...prev,
                  [client.facebookPageId!]: client.id,
                }));
              }
            });
            setLinkedPages(linked);
            setClients(clientsResult.data);
          }
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: pagesResult.error || "Error al cargar páginas",
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Error inesperado al cargar datos",
        });
      }
    });
  }, [toast]);

  const handleLinkPage = (pageId: string, pageAccessToken: string, instagramBusinessId?: string | null, isUpdate: boolean = false) => {
    const clientId = selectedClients[pageId];
    if (!clientId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Por favor, selecciona un cliente primero",
      });
      return;
    }

    startTransition(async () => {
      try {
        const result = await linkPageToClient(clientId, pageId, pageAccessToken, instagramBusinessId);
        if (result.success) {
          setLinkedPages((prev) => new Set(prev).add(pageId));
          toast({
            title: isUpdate ? "Conexión actualizada" : "Página vinculada",
            description: isUpdate 
              ? "La conexión se ha actualizado correctamente" 
              : "La página se ha vinculado exitosamente al cliente",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: result.error || "Error al vincular página",
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Error inesperado al vincular página",
        });
      }
    });
  };

  if (!metaAccount) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <Facebook className="h-5 w-5" />
              Cuenta Conectada
            </CardTitle>
            <CardDescription>
              {metaAccount.name} (ID: {metaAccount.facebookUserId})
            </CardDescription>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Token expira el {format(metaAccount.tokenExpiresAt, "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isPending && pages.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : pages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No se encontraron páginas gestionadas
          </p>
        ) : (
          <div className="space-y-4">
            {pages.map((page) => {
              const isLinked = linkedPages.has(page.id);
              const selectedClientId = selectedClients[page.id] || "";

              return (
                <div
                  key={page.id}
                  className="flex flex-col sm:flex-row gap-3 p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Facebook className="h-4 w-4 text-primary" />
                      <span className="font-medium">{page.name}</span>
                      {isLinked && (
                        <Badge variant="default" className="ml-2">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Vinculada
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">ID: {page.id}</p>
                    {page.instagramAccount && (
                      <div className="flex items-center gap-2 mt-2">
                        <Instagram className="h-4 w-4 text-pink-500" />
                        <span className="text-sm text-muted-foreground">
                          @{page.instagramAccount.username} (ID: {page.instagramAccount.id})
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <Select
                      value={selectedClientId}
                      onValueChange={(value) => {
                        setSelectedClients((prev) => ({
                          ...prev,
                          [page.id]: value,
                        }));
                      }}
                      disabled={isPending}
                    >
                      <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Seleccionar cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() =>
                        handleLinkPage(page.id, page.access_token, page.instagramAccount?.id, isLinked)
                      }
                      disabled={!selectedClientId || isPending}
                      size="sm"
                      variant="default"
                      className="w-full sm:w-auto"
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Procesando...
                        </>
                      ) : isLinked ? (
                        "Actualizar Conexión"
                      ) : (
                        "Vincular"
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

