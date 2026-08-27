"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  listUploadThingFilesAction,
  deleteUploadThingFilesAction,
  type UploadThingFile,
} from "@/actions/uploadthing-actions";
import { Trash2, RefreshCw, Search, ExternalLink, Download, Copy, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export default function UploadThingFilesPage() {
  const { toast } = useToast();
  const [files, setFiles] = useState<UploadThingFile[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<UploadThingFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [previewFile, setPreviewFile] = useState<UploadThingFile | null>(null);

  const isImageFile = (url: string | undefined): boolean => {
    if (!url) return false;
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
    return imageExtensions.some(ext => url.toLowerCase().includes(ext));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado al portapapeles" });
  };

  const loadFiles = async (reset = false, startOffset?: number) => {
    setLoading(true);
    try {
      const currentOffset = reset ? 0 : startOffset ?? offset;
      const response = await listUploadThingFilesAction(currentOffset, 100);

      if (response.success && response.data) {
        if (reset) {
          setFiles(response.data.files);
          setFilteredFiles(response.data.files);
          setOffset(0);
        } else {
          setFiles((prev) => [...prev, ...response.data!.files]);
          setFilteredFiles((prev) => [...prev, ...response.data!.files]);
          setOffset(currentOffset);
        }
        setHasMore(response.data.hasMore);
      } else {
        toast({
          title: "Error",
          description: response.error || "No se pudieron cargar los archivos",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar los archivos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles(true);
  // Carga inicial única: loadFiles se recrea en cada render, incluirla como
  // dependencia dispararía la petición en bucle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = files.filter(
        (file) =>
          file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          file.key.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredFiles(filtered);
    } else {
      setFilteredFiles(files);
    }
  }, [searchTerm, files]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFiles(new Set(filteredFiles.map((f) => f.key)));
    } else {
      setSelectedFiles(new Set());
    }
  };

  const handleSelectFile = (fileKey: string, checked: boolean) => {
    const newSelected = new Set(selectedFiles);
    if (checked) {
      newSelected.add(fileKey);
    } else {
      newSelected.delete(fileKey);
    }
    setSelectedFiles(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return;

    try {
      const response = await deleteUploadThingFilesAction(Array.from(selectedFiles));

      if (response.success) {
        toast({
          title: "Archivos eliminados",
          description: `Se eliminaron ${response.data?.deletedCount} archivo(s) exitosamente`,
        });
        setSelectedFiles(new Set());
        await loadFiles(true);
      } else {
        toast({
          title: "Error",
          description: response.error || "No se pudieron eliminar los archivos",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al eliminar archivos",
        variant: "destructive",
      });
    } finally {
      setShowDeleteDialog(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "N/A";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const totalSize = filteredFiles.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Archivos</h1>
          <p className="text-muted-foreground">
            Administra todos los archivos subidos a UploadThing
          </p>
        </div>
        <Button onClick={() => loadFiles(true)} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Recargar
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total de archivos</CardDescription>
            <CardTitle className="text-3xl">{filteredFiles.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Espacio utilizado</CardDescription>
            <CardTitle className="text-3xl">{formatFileSize(totalSize)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Archivos seleccionados</CardDescription>
            <CardTitle className="text-3xl">{selectedFiles.size}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>Archivos subidos</CardTitle>
            <div className="flex gap-2 flex-col md:flex-row">
              <div className="relative flex-1 md:min-w-[300px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o key..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              {selectedFiles.size > 0 && (
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar ({selectedFiles.size})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        filteredFiles.length > 0 &&
                        selectedFiles.size === filteredFiles.length
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-20">Vista previa</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden md:table-cell">Tamaño</TableHead>
                  <TableHead className="hidden lg:table-cell">Subido</TableHead>
                  <TableHead className="hidden md:table-cell">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && filteredFiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Cargando archivos...
                    </TableCell>
                  </TableRow>
                ) : filteredFiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No se encontraron archivos
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFiles.map((file) => (
                    <TableRow key={file.key}>
                      <TableCell>
                        <Checkbox
                          checked={selectedFiles.has(file.key)}
                          onCheckedChange={(checked) =>
                            handleSelectFile(file.key, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {isImageFile(file.url) && file.url ? (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setPreviewFile(file)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") setPreviewFile(file);
                            }}
                            className="relative w-16 h-16 rounded-md overflow-hidden border hover:opacity-80 transition-opacity cursor-pointer"
                          >
                            <Image
                              src={file.url}
                              alt={file.name || "Imagen"}
                              fill
                              draggable
                              className="object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center text-xs font-medium">
                            {file.name?.split(".").pop()?.toUpperCase() || "FILE"}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium truncate max-w-[200px] md:max-w-[300px]">
                            {file.name || "Sin nombre"}
                          </span>
                          <span className="text-xs text-muted-foreground truncate max-w-[200px] md:max-w-[300px] cursor-pointer hover:underline"
                                onClick={() => copyToClipboard(file.key)}>
                            {file.key}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {formatFileSize(file.size)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {formatDistanceToNow(new Date(file.uploadedAt), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant={file.status === "uploaded" ? "default" : "secondary"}>
                          {file.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          {isImageFile(file.url) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setPreviewFile(file)}
                              title="Ver preview"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (file.url) {
                                window.open(file.url, "_blank", "noopener,noreferrer");
                              } else {
                                toast({
                                  title: "Error",
                                  description: "URL del archivo no disponible",
                                  variant: "destructive",
                                });
                              }
                            }}
                            title="Abrir en nueva pestaña"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (!file.url) {
                                toast({
                                  title: "Error",
                                  description: "URL del archivo no disponible",
                                  variant: "destructive",
                                });
                                return;
                              }
                              const link = document.createElement("a");
                              link.href = file.url;
                              link.download = file.name || "download";
                              link.rel = "noopener noreferrer";
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            title="Descargar"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {hasMore && (
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                onClick={() => loadFiles(false, offset + 100)}
                disabled={loading}
              >
                Cargar más archivos
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar {selectedFiles.size} archivo(s). Esta acción no se puede
              deshacer y los archivos se eliminarán permanentemente de UploadThing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewFile?.name}</DialogTitle>
          </DialogHeader>
          {previewFile && isImageFile(previewFile.url) && previewFile.url && (
            <div className="relative w-full aspect-auto max-h-[500px]">
              <Image
                src={previewFile.url}
                alt={previewFile.name || "Preview"}
                width={800}
                height={600}
                className="w-full h-auto rounded-lg object-contain"
              />
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                if (previewFile?.url) {
                  copyToClipboard(previewFile.url);
                }
              }}
              disabled={!previewFile?.url}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar URL
            </Button>
            <Button
              onClick={() => {
                if (previewFile?.url) {
                  window.open(previewFile.url, "_blank", "noopener,noreferrer");
                }
              }}
              disabled={!previewFile?.url}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir en nueva pestaña
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
