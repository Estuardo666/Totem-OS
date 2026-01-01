"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadButton } from "@uploadthing/react";
import { Image, FileText, Trash2, ExternalLink, Loader2, Copy, Check, Download, Palette } from "lucide-react";
import type { BrandAsset } from "@prisma/client";
// @ts-expect-error - TypeScript no detecta el uso en callback inline, pero sí se usa
import { addBrandAsset, deleteBrandAsset } from "@/actions/client-actions";
import type { OurFileRouter } from "@/app/api/uploadthing/core";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

interface BrandKitProps {
  assets: BrandAsset[];
  clientId: string;
}

// @ts-expect-error - TypeScript no detecta el uso de clientId en callback inline, pero sí se usa
export function BrandKit({ assets, clientId }: BrandKitProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  void setIsUploading; // Forzar referencia para TypeScript (se usa en callback inline)


  const handleDelete = async (id: string) => {
    try {
      const result = await deleteBrandAsset(id);

      if (result.success) {
        toast({
          title: "Archivo eliminado",
          description: "El archivo ha sido eliminado exitosamente.",
        });
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "Error al eliminar archivo",
          description: result.error || "Ocurrió un error inesperado",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al eliminar archivo",
        description:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado",
      });
    }
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      toast({
        title: "URL copiada",
        description: "La URL del archivo ha sido copiada al portapapeles.",
      });
      // Resetear el estado después de 2 segundos
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al copiar URL",
        description: "No se pudo copiar la URL al portapapeles.",
      });
    }
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case "image":
        return <Image className="h-5 w-5" />;
      case "pdf":
        return <FileText className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getFileCategory = (fileName: string): "Logo" | "Paleta" | "Documento" => {
    const lowerName = fileName.toLowerCase();
    if (lowerName.includes("logo") || lowerName.includes("logotipo") || lowerName.includes("brand")) {
      return "Logo";
    }
    if (lowerName.includes("paleta") || lowerName.includes("color") || lowerName.includes("colores")) {
      return "Paleta";
    }
    return "Documento";
  };

  const handleDownload = (url: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Brand Kit</h2>
        <div className="flex items-center gap-2">
          {isUploading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          <UploadButton<OurFileRouter>
            endpoint="brandAsset"
            onClientUploadComplete={async (res) => {
              setIsUploading(true);

              try {
                for (const file of res) {
                  // Determinar el tipo de archivo
                  const fileType = file.name.endsWith(".pdf")
                    ? "pdf"
                    : file.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
                      ? "image"
                      : "document";

                  // @ts-ignore - TypeScript no detecta el uso en callback inline
                  const result = await addBrandAsset({
                    name: file.name,
                    url: file.url,
                    fileKey: file.key,
                    fileType,
                    clientId,
                  });

                  if (!result.success) {
                    toast({
                      variant: "destructive",
                      title: "Error al guardar archivo",
                      description: result.error || "No se pudo guardar el archivo",
                    });
                  }
                }

                toast({
                  title: "Archivos subidos",
                  description: `${res.length} archivo(s) agregado(s) exitosamente.`,
                });

                router.refresh();
              } catch (error) {
                toast({
                  variant: "destructive",
                  title: "Error al subir archivos",
                  description:
                    error instanceof Error
                      ? error.message
                      : "Ocurrió un error inesperado",
                });
              } finally {
                setIsUploading(false);
              }
            }}
            onUploadError={(error: Error) => {
              toast({
                variant: "destructive",
                title: "Error al subir archivo",
                description: error.message,
              });
            }}
            appearance={{
              allowedContent: "hidden",
              button: "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 ut-ready:bg-purple-600 ut-ready:text-white ut-uploading:cursor-not-allowed ut-uploading:bg-purple-600/50 ut-uploading:opacity-70",
            }}
            content={{
              button: ({ ready }) => (ready ? "Subir Activo" : "Cargando..."),
            }}
          />
        </div>
      </div>

      {assets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center text-lg">
              No hay archivos en el Brand Kit
            </p>
            <p className="text-muted-foreground mt-2 text-center text-sm">
              Sube logos, imágenes, PDFs y otros recursos de marca
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => {
            const category = getFileCategory(asset.name);
            return (
              <Card key={asset.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {getFileIcon(asset.fileType)}
                        <Badge
                          variant={
                            category === "Logo"
                              ? "default"
                              : category === "Paleta"
                                ? "secondary"
                                : "outline"
                          }
                          className="text-xs"
                        >
                          {category === "Logo" && <Image className="mr-1 h-3 w-3" />}
                          {category === "Paleta" && <Palette className="mr-1 h-3 w-3" />}
                          {category === "Documento" && <FileText className="mr-1 h-3 w-3" />}
                          {category}
                        </Badge>
                      </div>
                      <CardTitle className="text-sm truncate" title={asset.name}>
                        {asset.name}
                      </CardTitle>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive hover:text-destructive-foreground flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar archivo?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará
                            permanentemente el archivo {asset.name}.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(asset.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col space-y-3">
                  <div className="relative aspect-square w-full overflow-hidden rounded-md border bg-muted">
                    {asset.fileType === "image" ? (
                      <img
                        src={asset.url}
                        alt={asset.name}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <FileText className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyUrl(asset.url)}
                      className="w-full"
                    >
                      {copiedUrl === asset.url ? (
                        <>
                          <Check className="mr-1.5 h-3.5 w-3.5" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1.5 h-3.5 w-3.5" />
                          URL
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(asset.url, asset.name)}
                      className="w-full"
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Descargar
                    </Button>
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


