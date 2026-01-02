"use client";

import { useState, useTransition } from "react";
import { generateTaskOptionsAction, refineTaskContentAction } from "@/actions/ai-actions";
import { AiLoadingState } from "./ai-loading-state";
import { AiOptionCard } from "./ai-option-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sparkles, ChevronDown, ChevronUp, Wand2, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AIOption {
  framework: "AIDA" | "PAS" | "Storytelling";
  content: string;
}

interface AiContentAssistantProps {
  taskId: string;
  currentScript?: string;
  currentCopy?: string;
  onInsertScript?: (content: string) => void;
  onInsertCopy?: (content: string) => void;
  hasCompleteBrandDNA?: boolean;
  brandDNAError?: string;
}

export function AiContentAssistant({
  taskId,
  currentScript,
  currentCopy,
  onInsertScript,
  onInsertCopy,
  hasCompleteBrandDNA = true,
  brandDNAError,
}: AiContentAssistantProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"generate" | "refine">("generate");
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<AIOption[]>([]);
  const [refinedContent, setRefinedContent] = useState<string | null>(null);
  const [originalContent, setOriginalContent] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isRefining, startRefineTransition] = useTransition();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingInsert, setPendingInsert] = useState<{
    content: string;
    destination: "script" | "copy";
  } | null>(null);
  const [lengthPreference, setLengthPreference] = useState<"short" | "medium" | "long">("medium");
  const [includeEmojis, setIncludeEmojis] = useState(false);

  const handleGenerate = () => {
    if (!hasCompleteBrandDNA) {
      toast({
        variant: "destructive",
        title: "ADN de marca incompleto",
        description: brandDNAError || "Completa el ADN de marca del cliente para usar esta función.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const result = await generateTaskOptionsAction(taskId, {
          length: lengthPreference,
          includeEmojis,
        });

        if (!result.success) {
          // Mensaje específico para errores de configuración
          let errorMessage = result.error || "Error al generar contenido";
          
          if (result.error?.includes("proveedor") || result.error?.includes("configuración") || result.error?.includes("API key")) {
            errorMessage = "Error de configuración: Verifica la API Key y el Base URL en Settings > Configuración de IA";
          }

          toast({
            variant: "destructive",
            title: "Error de IA",
            description: errorMessage,
          });
          return;
        }

        if (result.data) {
          setOptions(result.data.options);
          setIsOpen(true);
          toast({
            title: "✅ Contenido generado",
            description: "Se han generado 3 opciones de copy con IA",
          });
        }
      } catch (error) {
        let errorMessage = "Error desconocido al generar contenido";
        
        if (error instanceof Error) {
          if (error.message.includes("configuración") || error.message.includes("proveedor")) {
            errorMessage = "Error de configuración: Verifica la API Key y el Base URL en Settings > Configuración de IA";
          } else if (error.message.includes("fetch") || error.message.includes("network")) {
            errorMessage = "Error de conexión: No se pudo contactar con la API de IA. Verifica tu conexión e inténtalo de nuevo.";
          } else {
            errorMessage = error.message;
          }
        }

        toast({
          variant: "destructive",
          title: "Error de IA",
          description: errorMessage,
        });
      }
    });
  };

  const handleRefine = (destination: "script" | "copy") => {
    if (!hasCompleteBrandDNA) {
      toast({
        variant: "destructive",
        title: "ADN de marca incompleto",
        description: brandDNAError || "Completa el ADN de marca del cliente para usar esta función.",
      });
      return;
    }

    const contentToRefine = destination === "script" ? currentScript : currentCopy;

    if (!contentToRefine || contentToRefine.trim().length === 0) {
      toast({
        variant: "destructive",
        title: "Sin contenido",
        description: `No hay contenido en ${destination === "script" ? "Script" : "Copy"} para refinar. Escribe algo primero.`,
      });
      return;
    }

    startRefineTransition(async () => {
      try {
        const result = await refineTaskContentAction(taskId, contentToRefine, destination);

        if (!result.success) {
          toast({
            variant: "destructive",
            title: "Error",
            description: result.error || "Error al refinar contenido",
          });
          return;
        }

        if (result.data) {
          setRefinedContent(result.data.refinedContent);
          setOriginalContent(contentToRefine);
          setIsOpen(true);
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description:
            error instanceof Error
              ? error.message
              : "Error desconocido al refinar contenido",
        });
      }
    });
  };

  const handleSelectOption = (
    content: string,
    framework: AIOption["framework"],
    destination: "script" | "copy"
  ) => {
    const targetContent = destination === "script" ? currentScript : currentCopy;

    // Si el campo de destino tiene contenido, mostrar diálogo de confirmación
    if (targetContent && targetContent.trim().length > 0) {
      setPendingInsert({ content, destination });
      setShowConfirmDialog(true);
    } else {
      // Insertar directamente
      insertContent(content, destination);
    }
  };

  const handleSelectRefined = (destination: "script" | "copy") => {
    if (!refinedContent) return;

    const targetContent = destination === "script" ? currentScript : currentCopy;

    // Si el campo de destino tiene contenido, mostrar diálogo de confirmación
    if (targetContent && targetContent.trim().length > 0) {
      setPendingInsert({ content: refinedContent, destination });
      setShowConfirmDialog(true);
    } else {
      // Insertar directamente
      insertContent(refinedContent, destination);
    }
  };

  const insertContent = (content: string, destination: "script" | "copy") => {
    if (destination === "script" && onInsertScript) {
      onInsertScript(content);
      toast({
        title: "Copy insertado con éxito",
        description: "El contenido ha sido insertado en Script. Puedes continuar editando.",
      });
    } else if (destination === "copy" && onInsertCopy) {
      onInsertCopy(content);
      toast({
        title: "Copy insertado con éxito",
        description: "El contenido ha sido insertado. Puedes continuar editando.",
      });
    }
    // NO cerrar el diálogo automáticamente - solo cerrar el diálogo de confirmación
    setShowConfirmDialog(false);
    setPendingInsert(null);
    // El diálogo principal (isOpen) permanece abierto para que el usuario pueda seguir trabajando
  };

  const handleConfirmReplace = () => {
    if (pendingInsert) {
      insertContent(pendingInsert.content, pendingInsert.destination);
    }
  };

  const handleConfirmAppend = () => {
    if (pendingInsert) {
      const targetContent =
        pendingInsert.destination === "script" ? currentScript : currentCopy;
      const newContent = `${targetContent}\n\n${pendingInsert.content}`;
      insertContent(newContent, pendingInsert.destination);
    }
  };

  const isDisabled = !hasCompleteBrandDNA;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "generate" | "refine")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate">Generar</TabsTrigger>
            <TabsTrigger value="refine">Refinar</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-4 mt-4">
            {/* Preferencias de Usuario */}
            <div className="space-y-3 rounded-lg border p-4">
              <div className="space-y-2">
                <Label htmlFor="length-preference">Extensión</Label>
                <Select
                  value={lengthPreference}
                  onValueChange={(value: "short" | "medium" | "long") =>
                    setLengthPreference(value)
                  }
                  disabled={isDisabled}
                >
                  <SelectTrigger id="length-preference">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Corta (aprox. 30 palabras)</SelectItem>
                    <SelectItem value="medium">Media (aprox. 70 palabras)</SelectItem>
                    <SelectItem value="long">Larga (más de 120 palabras)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="include-emojis" className="cursor-pointer">
                  Incluir Emojis
                </Label>
                <Switch
                  id="include-emojis"
                  checked={includeEmojis}
                  onCheckedChange={setIncludeEmojis}
                  disabled={isDisabled}
                />
              </div>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Button
                    onClick={handleGenerate}
                    disabled={isPending || isDisabled}
                    className="w-full"
                    variant="outline"
                  >
                    {isPending ? (
                      <>
                        <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generar Opciones con IA
                      </>
                    )}
                  </Button>
                </div>
              </TooltipTrigger>
              {isDisabled && (
                <TooltipContent>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <p className="max-w-xs">{brandDNAError || "Completa el ADN de marca del cliente para usar esta función."}</p>
                  </div>
                </TooltipContent>
              )}
            </Tooltip>

            {isPending && <AiLoadingState />}

            {isOpen && options.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    Opciones Generadas ({options.length})
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(!isOpen)}
                  >
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {isOpen && (
                  <div className="space-y-4">
                    {options.map((option, index) => (
                      <div
                        key={option.framework}
                        className="animate-in fade-in slide-in-from-left-4 duration-500"
                        style={{ 
                          animationDelay: `${index * 150}ms`,
                        }}
                      >
                        <AiOptionCard
                          option={option}
                          onSelect={handleSelectOption}
                          index={index}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="refine" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Wand2 className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">Pulir con IA</p>
                    <p className="text-xs text-muted-foreground">
                      Optimiza tu contenido existente para que suene 100% acorde al tono de voz y valores de marca del cliente.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Button
                          onClick={() => handleRefine("script")}
                          disabled={isRefining || isDisabled || !currentScript || currentScript.trim().length === 0}
                          variant="outline"
                          className="w-full"
                          size="sm"
                        >
                          {isRefining ? (
                            <>
                              <Wand2 className="h-4 w-4 mr-2 animate-spin" />
                              Pulir Script...
                            </>
                          ) : (
                            <>
                              <Wand2 className="h-4 w-4 mr-2" />
                              Pulir Script
                            </>
                          )}
                        </Button>
                      </div>
                    </TooltipTrigger>
                    {isDisabled && (
                      <TooltipContent>
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          <p className="max-w-xs">{brandDNAError || "Completa el ADN de marca del cliente para usar esta función."}</p>
                        </div>
                      </TooltipContent>
                    )}
                    {!isDisabled && (!currentScript || currentScript.trim().length === 0) && (
                      <TooltipContent>
                        <p>Escribe algo en Script primero para poder refinarlo.</p>
                      </TooltipContent>
                    )}
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Button
                          onClick={() => handleRefine("copy")}
                          disabled={isRefining || isDisabled || !currentCopy || currentCopy.trim().length === 0}
                          variant="outline"
                          className="w-full"
                          size="sm"
                        >
                          {isRefining ? (
                            <>
                              <Wand2 className="h-4 w-4 mr-2 animate-spin" />
                              Pulir Copy...
                            </>
                          ) : (
                            <>
                              <Wand2 className="h-4 w-4 mr-2" />
                              Pulir Copy
                            </>
                          )}
                        </Button>
                      </div>
                    </TooltipTrigger>
                    {isDisabled && (
                      <TooltipContent>
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          <p className="max-w-xs">{brandDNAError || "Completa el ADN de marca del cliente para usar esta función."}</p>
                        </div>
                      </TooltipContent>
                    )}
                    {!isDisabled && (!currentCopy || currentCopy.trim().length === 0) && (
                      <TooltipContent>
                        <p>Escribe algo en Copy primero para poder refinarlo.</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </div>
              </div>

              {isRefining && (
                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                      <div className="relative">
                        <Wand2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                      <div className="text-center space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">
                          Ajustando tono de marca...
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Optimizando gramática y gancho inicial...
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {isOpen && refinedContent && originalContent && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Contenido Refinado</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsOpen(!isOpen)}
                    >
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {isOpen && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-500">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Versión Original</CardTitle>
                          <CardDescription className="text-xs">
                            Tu contenido antes del refinamiento
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">
                            {originalContent}
                          </p>
                        </CardContent>
                      </Card>

                      <Card className="border-primary/50 bg-primary/5">
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            Versión Optimizada
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Contenido refinado con IA
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">
                            {refinedContent}
                          </p>
                          <div className="flex gap-2 mt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSelectRefined("script")}
                              className="flex-1"
                            >
                              <Sparkles className="h-4 w-4 mr-2" />
                              Usar en Script
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSelectRefined("copy")}
                              className="flex-1"
                            >
                              <Sparkles className="h-4 w-4 mr-2" />
                              Usar en Copy
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Inserción</DialogTitle>
              <DialogDescription>
                El campo de destino ya tiene contenido. ¿Cómo deseas proceder?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowConfirmDialog(false);
                  setPendingInsert(null);
                }}
              >
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleConfirmReplace}>
                Reemplazar
              </Button>
              <Button onClick={handleConfirmAppend}>
                Añadir al final
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
