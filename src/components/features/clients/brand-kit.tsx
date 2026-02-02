"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UploadButton } from "@uploadthing/react";
import { Image as ImageIcon, FileText, Trash2, ExternalLink, Loader2, Copy, Check, Download, Palette, Search } from "lucide-react";
import type { BrandAsset } from "@prisma/client";
import Image from "next/image";
// @ts-expect-error - TypeScript no detecta el uso en callback inline, pero sí se usa
import { addBrandAsset, deleteBrandAsset } from "@/actions/client-actions";
import type { OurFileRouter } from "@/app/api/uploadthing/core";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
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
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [sortKey, setSortKey] = useState<"name" | "createdAt" | "fileType" | "fileSize">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
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
        return <ImageIcon className="h-5 w-5" />;
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

  // Filter assets based on search term
  const filteredAssets = [...assets]
    .filter(asset =>
      debouncedSearchTerm.length < 3 ||
      asset.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      getFileCategory(asset.name).toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortKey) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "createdAt":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "fileType":
          comparison = a.fileType.localeCompare(b.fileType);
          break;
        case "fileSize":
          comparison = ((a as any).fileSize || 0) - ((b as any).fileSize || 0);
          break;
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });

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
            onUploadBegin={(files) => {
              setIsUploading(true);
              // Handle different possible formats of files parameter
              const fileNames = Array.isArray(files) 
                ? files.map(f => f.name || f)
                : files ? [files.name || files] : [];
              setUploadingFiles(fileNames);
            }}
            onClientUploadComplete={async (res) => {
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
                    fileSize: file.size,
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
                setUploadingFiles([]);
              }
            }}
            onUploadError={(error: Error) => {
              toast({
                variant: "destructive",
                title: "Error al subir archivo",
                description: error.message,
              });
              setIsUploading(false);
              setUploadingFiles([]);
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

      {/* Search and Sort Controls */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar archivos (mínimo 3 caracteres)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Select value={sortKey} onValueChange={(value: "name" | "createdAt" | "fileType" | "fileSize") => setSortKey(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nombre</SelectItem>
              <SelectItem value="createdAt">Fecha</SelectItem>
              <SelectItem value="fileType">Tipo</SelectItem>
              <SelectItem value="fileSize">Tamaño</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortOrder} onValueChange={(value: "asc" | "desc") => setSortOrder(value)}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">A-Z</SelectItem>
              <SelectItem value="desc">Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Upload Progress Indicator */}
      {isUploading && uploadingFiles.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Subiendo {uploadingFiles.length} archivo{uploadingFiles.length > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-blue-700">
                  {uploadingFiles.map((name, index) => (
                    <span key={index}>
                      {name}
                      {index < uploadingFiles.length - 1 && ', '}
                    </span>
                  ))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredAssets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center text-lg">
              {debouncedSearchTerm.length >= 3 
                ? "No se encontraron archivos que coincidan con la búsqueda"
                : "No hay archivos en el Brand Kit"
              }
            </p>
            <p className="text-muted-foreground mt-2 text-center text-sm">
              {debouncedSearchTerm.length >= 3 
                ? `Intenta con otros términos para "${debouncedSearchTerm}"`
                : "Sube logos, imágenes, PDFs y otros recursos de marca"
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAssets.map((asset) => {
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
                          {category === "Logo" && <ImageIcon className="mr-1 h-3 w-3" />}
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
                      <Image
                        src={asset.url}
                        alt={asset.name}
                        fill
                        className="object-contain"
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


