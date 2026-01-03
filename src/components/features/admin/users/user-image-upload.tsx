"use client";

import { useState, useEffect } from "react";
import { UploadButton, UploadDropzone } from "@/utils/uploadthing";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { X, UploadCloud } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface UserImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

export function UserImageUpload({ value, onChange, disabled = false }: UserImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(value || null);
  const { toast } = useToast();

  // Sincronizar el preview con el valor externo
  useEffect(() => {
    setPreview(value || null);
  }, [value]);

  const handleUploadComplete = (res: { url: string }[]) => {
    if (res && res.length > 0) {
      const url = res[0].url;
      setPreview(url);
      onChange(url);
      toast({
        title: "Imagen subida",
        description: "La foto de perfil se ha cargado correctamente.",
      });
    }
  };

  const handleRemoveImage = () => {
    setPreview(null);
    onChange(null);
    toast({
      title: "Imagen eliminada",
      description: "La foto de perfil ha sido removida.",
    });
  };

  if (preview) {
    return (
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={preview} alt="Vista previa" />
          <AvatarFallback>Foto</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Imagen cargada</p>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleRemoveImage}
            disabled={disabled}
            className="w-fit"
          >
            <X className="h-4 w-4 mr-2" />
            Eliminar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <UploadDropzone
        endpoint="imageUploader"
        onClientUploadComplete={handleUploadComplete}
        onUploadError={(error: Error) => {
          toast({
            variant: "destructive",
            title: "Error al subir imagen",
            description: error.message || "Ocurrió un error inesperado",
          });
        }}
        config={{
          mode: "auto",
        }}
        className="ut-label:text-sm ut-label:font-medium ut-allowed-content:ut-text-xs ut-button:bg-primary ut-button:ut-ready:bg-primary/90 ut-button:ut-uploading:bg-primary/70"
      />
      <p className="text-xs text-muted-foreground">
        Formatos soportados: JPG, PNG, GIF. Tamaño máximo: 4MB
      </p>
    </div>
  );
}

