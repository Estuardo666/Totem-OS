"use client";

import { useState, useEffect } from "react";
import { UploadButton } from "@uploadthing/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Image as ImageIcon, X, Palette } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { updateBrandSettings, getBrandSettings, updateLoginBackground, getLoginBackground } from "@/actions/admin-actions";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

export function BrandingSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [logoLightUrl, setLogoLightUrl] = useState<string | null>(null);
  const [logoDarkUrl, setLogoDarkUrl] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [isUploadingLight, setIsUploadingLight] = useState(false);
  const [isUploadingDark, setIsUploadingDark] = useState(false);
  const [isUploadingBackground, setIsUploadingBackground] = useState(false);
  const { toast } = useToast();

  // Cargar configuración existente
  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const [brandResult, backgroundResult] = await Promise.all([
          getBrandSettings(),
          getLoginBackground(),
        ]);
        if (!isMounted) return;

        if (brandResult.success && brandResult.data) {
          setLogoLightUrl(brandResult.data.logoLight);
          setLogoDarkUrl(brandResult.data.logoDark);
        }

        if (backgroundResult.success && backgroundResult.data) {
          setBackgroundUrl(backgroundResult.data.backgroundUrl);
        }
      } catch (error) {
        if (!isMounted) return;
        console.error("Error al cargar configuración:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo cargar la configuración",
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, [toast]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const [brandResult, backgroundResult] = await Promise.all([
        updateBrandSettings({
          logoLight: logoLightUrl || undefined,
          logoDark: logoDarkUrl || undefined,
        }),
        updateLoginBackground({
          backgroundUrl: backgroundUrl || undefined,
        }),
      ]);

      if (brandResult.success && backgroundResult.success) {
        toast({
          title: "Configuración guardada",
          description: "La configuración de marca y background se han guardado correctamente",
        });
      } else {
        const errorMessage = brandResult.error || backgroundResult.error || "No se pudo guardar la configuración";
        toast({
          variant: "destructive",
          title: "Error",
          description: errorMessage,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al guardar la configuración",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveLogo = (type: "light" | "dark") => {
    if (type === "light") {
      setLogoLightUrl(null);
    } else {
      setLogoDarkUrl(null);
    }
  };

  const handleRemoveBackground = () => {
    setBackgroundUrl(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Identidad de Marca
        </CardTitle>
        <CardDescription>
          Configura los logos de la aplicación y el background de login. El logo claro se mostrará sobre fondos blancos y el logo oscuro sobre fondos oscuros.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Grid de 3 columnas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Logo Modo Claro - Columna 1 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Logo Modo Claro</label>
              {logoLightUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveLogo("light")}
                  className="h-8 text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4 mr-1" />
                  Eliminar
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Se verá sobre fondos blancos
            </p>

            {logoLightUrl ? (
              <div className="flex flex-col gap-3">
                <div className="relative w-full h-32 bg-white border-2 border-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                  <img
                    src={logoLightUrl}
                    alt="Logo modo claro"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {isUploadingLight && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                <UploadButton<OurFileRouter>
                  endpoint="brandLogo"
                  onClientUploadComplete={(res) => {
                    if (res && res.length > 0) {
                      setLogoLightUrl(res[0].url);
                      setIsUploadingLight(false);
                      toast({
                        title: "Logo subido",
                        description: "El logo modo claro se ha subido correctamente. No olvides guardar los cambios.",
                      });
                    }
                  }}
                  onUploadProgress={() => {
                    setIsUploadingLight(true);
                  }}
                  onUploadError={(error: Error) => {
                    setIsUploadingLight(false);
                    toast({
                      variant: "destructive",
                      title: "Error al subir logo",
                      description: error.message,
                    });
                  }}
                />
              </div>
            )}
          </div>

          {/* Logo Modo Oscuro - Columna 2 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Logo Modo Oscuro</label>
              {logoDarkUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveLogo("dark")}
                  className="h-8 text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4 mr-1" />
                  Eliminar
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Se verá sobre fondos oscuros
            </p>

            {logoDarkUrl ? (
              <div className="flex flex-col gap-3">
                <div className="relative w-full h-32 bg-gray-900 border-2 border-gray-700 rounded-lg flex items-center justify-center overflow-hidden">
                  <img
                    src={logoDarkUrl}
                    alt="Logo modo oscuro"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {isUploadingDark && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                <UploadButton<OurFileRouter>
                  endpoint="brandLogo"
                  onClientUploadComplete={(res) => {
                    if (res && res.length > 0) {
                      setLogoDarkUrl(res[0].url);
                      setIsUploadingDark(false);
                      toast({
                        title: "Logo subido",
                        description: "El logo modo oscuro se ha subido correctamente. No olvides guardar los cambios.",
                      });
                    }
                  }}
                  onUploadProgress={() => {
                    setIsUploadingDark(true);
                  }}
                  onUploadError={(error: Error) => {
                    setIsUploadingDark(false);
                    toast({
                      variant: "destructive",
                      title: "Error al subir logo",
                      description: error.message,
                    });
                  }}
                />
              </div>
            )}
          </div>

          {/* Background del Login - Columna 3 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Background Login
              </label>
              {backgroundUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveBackground}
                  className="h-8 text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4 mr-1" />
                  Eliminar
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Imagen de fondo para login/registro
            </p>

            {backgroundUrl ? (
              <div className="flex flex-col gap-3">
                <div className="relative w-full h-32 border-2 border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <img
                    src={backgroundUrl}
                    alt="Background del login"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {isUploadingBackground && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                <UploadButton<OurFileRouter>
                  endpoint="loginBackground"
                  onClientUploadComplete={(res) => {
                    if (res && res.length > 0) {
                      setBackgroundUrl(res[0].url);
                      setIsUploadingBackground(false);
                      toast({
                        title: "Background subido",
                        description: "El background se ha subido correctamente. No olvides guardar los cambios.",
                      });
                    }
                  }}
                  onUploadProgress={() => {
                    setIsUploadingBackground(true);
                  }}
                  onUploadError={(error: Error) => {
                    setIsUploadingBackground(false);
                    toast({
                      variant: "destructive",
                      title: "Error al subir background",
                      description: error.message,
                    });
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Botón Guardar - Fuera del grid */}
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="w-full"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Guardar Configuración
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

