"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Eye, EyeOff, Loader2, Plus, Trash2, ExternalLink } from "lucide-react";
import type { Credential } from "@prisma/client";
import { createCredentialSchema, type CreateCredentialInput } from "@/schemas/client";
import { addCredential, deleteCredential } from "@/actions/client-actions";
import { useRedirectOnAuthError } from "@/hooks/use-redirect-on-auth-error";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface VaultListProps {
  credentials: Credential[];
  clientId: string;
}

export function VaultList({ credentials, clientId }: VaultListProps) {
  const router = useRouter();
  const { toast } = useToast();
  const handleAuthError = useRedirectOnAuthError();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set());

  const form = useForm<CreateCredentialInput>({
    resolver: zodResolver(createCredentialSchema),
    defaultValues: {
      service: "",
      username: "",
      password: "",
      url: "",
      clientId,
    },
  });

  const onSubmit = async (data: CreateCredentialInput) => {
    setIsSubmitting(true);

    try {
      const result = await addCredential(data);

      if (result.success) {
        toast({
          title: "Credencial agregada",
          description: "La credencial ha sido guardada exitosamente.",
        });
        form.reset();
        setIsDialogOpen(false);
        router.refresh();
      } else {
        if (handleAuthError(result)) {
          toast({
            variant: "destructive",
            title: "Sesión expirada",
            description: "Tu sesión ha expirado. Serás redirigido al login.",
          });
          return;
        }

        toast({
          variant: "destructive",
          title: "Error al agregar credencial",
          description: result.error || "Ocurrió un error inesperado",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al agregar credencial",
        description:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copiado",
        description: `${label} copiado al portapapeles`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al copiar",
        description: "No se pudo copiar al portapapeles",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await deleteCredential(id);

      if (result.success) {
        toast({
          title: "Credencial eliminada",
          description: "La credencial ha sido eliminada exitosamente.",
        });
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "Error al eliminar credencial",
          description: result.error || "Ocurrió un error inesperado",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al eliminar credencial",
        description:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado",
      });
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setRevealedPasswords((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Bóveda de Credenciales</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Agregar Credencial
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar Nueva Credencial</DialogTitle>
              <DialogDescription>
                Guarda las credenciales de acceso del cliente de forma segura.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="service"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Servicio</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej: Instagram, Web, Email"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usuario</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Nombre de usuario o email"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Contraseña"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL (Opcional)</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder="https://ejemplo.com"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      "Guardar"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {credentials.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center text-lg">
              No hay credenciales guardadas
            </p>
            <p className="text-muted-foreground mt-2 text-center text-sm">
              Agrega tu primera credencial para comenzar
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {credentials.map((credential) => {
            const isPasswordRevealed = revealedPasswords.has(credential.id);

            return (
              <Card key={credential.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{credential.service}</CardTitle>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar credencial?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará
                            permanentemente la credencial de {credential.service}.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(credential.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Usuario:
                      </span>
                      <span className="flex-1 truncate text-sm">
                        {credential.username}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleCopy(credential.username, "Usuario")}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Contraseña:
                      </span>
                      <Input
                        type={isPasswordRevealed ? "text" : "password"}
                        value={credential.password}
                        readOnly
                        className="flex-1 text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => togglePasswordVisibility(credential.id)}
                      >
                        {isPasswordRevealed ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleCopy(credential.password, "Contraseña")}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {credential.url && (
                      <div className="flex items-center gap-2">
                        <a
                          href={credential.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Abrir URL
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

