"use client";

import { useState, useEffect } from "react";
import { UploadButton } from "@uploadthing/react";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Image as ImageIcon, X, Sun, Moon, Sparkles, ImagePlus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { updateBrandSettings, getBrandSettings, updateLoginBackground, getLoginBackground } from "@/actions/admin-actions";
import type { OurFileRouter } from "@/app/api/uploadthing/core";
import Image from "next/image";

export function BrandingSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [logoLightUrl, setLogoLightUrl] = useState<string | null>(null);
  const [logoDarkUrl, setLogoDarkUrl] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [isUploadingLight, setIsUploadingLight] = useState(false);
  const [isUploadingDark, setIsUploadingDark] = useState(false);
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);
  const [isUploadingBackground, setIsUploadingBackground] = useState(false);
  const { toast } = useToast();

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
          setFaviconUrl(brandResult.data.favicon);
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
          favicon: faviconUrl || undefined,
        }),
        updateLoginBackground({
          backgroundUrl: backgroundUrl || undefined,
        }),
      ]);

      if (brandResult.success && backgroundResult.success) {
        toast({
          title: "Configuración guardada",
          description: "La configuración de marca se ha guardado correctamente",
        });
      } else {
        const errorMessage = brandResult.error || backgroundResult.error || "No se pudo guardar";
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

  const handleRemoveLogo = (type: "light" | "dark" | "favicon") => {
    if (type === "light") {
      setLogoLightUrl(null);
    } else if (type === "dark") {
      setLogoDarkUrl(null);
    } else if (type === "favicon") {
      setFaviconUrl(null);
    }
  };

  const handleRemoveBackground = () => {
    setBackgroundUrl(null);
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
              <ImageIcon className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-medium">Identidad de Marca</h3>
              <p className="text-xs text-muted-foreground">Cargando configuración...</p>
            </div>
          </div>
        </div>
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
            <ImageIcon className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium">Identidad de Marca</h3>
            <p className="text-xs text-muted-foreground">Logos, favicon y fondo de login</p>
          </div>
        </div>
      </div>

      {/* Content - Grid de logos */}
      <div className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Logo Modo Claro */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sun className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-medium">Logo Claro</span>
            </div>
            
            {logoLightUrl ? (
              <div className="relative group">
                <div className="relative w-full aspect-video bg-white border-2 border-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                  <Image
                    src={logoLightUrl}
                    alt="Logo modo claro"
                    fill
                    className="object-contain p-2"
                  />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={() => handleRemoveLogo("light")}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="relative w-full aspect-video border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center overflow-hidden hover:border-primary/50 transition-colors">
                {isUploadingLight ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <div className="text-center">
                    <ImagePlus className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                    <UploadButton<OurFileRouter>
                      endpoint="brandLogo"
                      onUploadBegin={() => setIsUploadingLight(true)}
                      onClientUploadComplete={(res) => {
                        if (res && res.length > 0) {
                          setLogoLightUrl(res[0].url);
                          setIsUploadingLight(false);
                          toast({
                            title: "Logo subido",
                            description: "No olvides guardar los cambios.",
                          });
                        }
                      }}
                      onUploadError={(error: Error) => {
                        setIsUploadingLight(false);
                        toast({
                          variant: "destructive",
                          title: "Error",
                          description: error.message,
                        });
                      }}
                      appearance={{
                        button: "text-xs h-6 px-2",
                        allowedContent: "hidden",
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Logo Modo Oscuro */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Moon className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-xs font-medium">Logo Oscuro</span>
            </div>
            
            {logoDarkUrl ? (
              <div className="relative group">
                <div className="relative w-full aspect-video bg-gray-900 border-2 border-gray-700 rounded-lg flex items-center justify-center overflow-hidden">
                  <Image
                    src={logoDarkUrl}
                    alt="Logo modo oscuro"
                    fill
                    className="object-contain p-2"
                  />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={() => handleRemoveLogo("dark")}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="relative w-full aspect-video border-2 border-dashed border-gray-600 bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden hover:border-primary/50 transition-colors">
                {isUploadingDark ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <div className="text-center">
                    <ImagePlus className="h-5 w-5 mx-auto text-gray-400 mb-1" />
                    <UploadButton<OurFileRouter>
                      endpoint="brandLogo"
                      onUploadBegin={() => setIsUploadingDark(true)}
                      onClientUploadComplete={(res) => {
                        if (res && res.length > 0) {
                          setLogoDarkUrl(res[0].url);
                          setIsUploadingDark(false);
                          toast({
                            title: "Logo subido",
                            description: "No olvides guardar los cambios.",
                          });
                        }
                      }}
                      onUploadError={(error: Error) => {
                        setIsUploadingDark(false);
                        toast({
                          variant: "destructive",
                          title: "Error",
                          description: error.message,
                        });
                      }}
                      appearance={{
                        button: "text-xs h-6 px-2",
                        allowedContent: "hidden",
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Favicon */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-medium">Favicon</span>
            </div>
            
            {faviconUrl ? (
              <div className="relative group">
                <div className="relative w-full aspect-video border-2 border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-center overflow-hidden">
                  <Image
                    src={faviconUrl}
                    alt="Favicon"
                    fill
                    className="object-contain p-2"
                  />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={() => handleRemoveLogo("favicon")}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="relative w-full aspect-video border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-center overflow-hidden hover:border-primary/50 transition-colors">
                {isUploadingFavicon ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <div className="text-center">
                    <ImagePlus className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                    <UploadButton<OurFileRouter>
                      endpoint="favicon"
                      onUploadBegin={() => setIsUploadingFavicon(true)}
                      onClientUploadComplete={(res) => {
                        if (res && res.length > 0) {
                          setFaviconUrl(res[0].url);
                          setIsUploadingFavicon(false);
                          toast({
                            title: "Favicon subido",
                            description: "No olvides guardar los cambios.",
                          });
                        }
                      }}
                      onUploadError={(error: Error) => {
                        setIsUploadingFavicon(false);
                        toast({
                          variant: "destructive",
                          title: "Error",
                          description: error.message,
                        });
                      }}
                      appearance={{
                        button: "text-xs h-6 px-2",
                        allowedContent: "hidden",
                      }}
                    />
                  </div>
                )}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">32x32px recomendado</p>
          </div>

          {/* Background Login */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs font-medium">Fondo Login</span>
            </div>
            
            {backgroundUrl ? (
              <div className="relative group">
                <div className="relative w-full aspect-video border-2 border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <Image
                    src={backgroundUrl}
                    alt="Background del login"
                    fill
                    className="object-cover"
                  />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={handleRemoveBackground}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="relative w-full aspect-video border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-center overflow-hidden hover:border-primary/50 transition-colors">
                {isUploadingBackground ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <div className="text-center">
                    <ImagePlus className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                    <UploadButton<OurFileRouter>
                      endpoint="loginBackground"
                      onUploadBegin={() => setIsUploadingBackground(true)}
                      onClientUploadComplete={(res) => {
                        if (res && res.length > 0) {
                          setBackgroundUrl(res[0].url);
                          setIsUploadingBackground(false);
                          toast({
                            title: "Background subido",
                            description: "No olvides guardar los cambios.",
                          });
                        }
                      }}
                      onUploadError={(error: Error) => {
                        setIsUploadingBackground(false);
                        toast({
                          variant: "destructive",
                          title: "Error",
                          description: error.message,
                        });
                      }}
                      appearance={{
                        button: "text-xs h-6 px-2",
                        allowedContent: "hidden",
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t bg-muted/30">
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          size="sm"
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
      </div>
    </div>
  );
}

