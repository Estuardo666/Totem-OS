"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Eye, EyeOff, Sparkles, Zap, Brain, CheckCircle2, XCircle, Key } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { updateGlobalAiConfig, getGlobalAiConfig, testAIConnection } from "@/actions/admin-actions";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const aiConfigSchema = z.object({
  activeProvider: z.enum(["openai", "grok", "deepseek", "google"]),
  openaiApiKey: z.string().optional(),
  openaiBaseUrl: z.string().url("Debe ser una URL válida").optional().or(z.literal("")),
  openaiModel: z.string().optional().or(z.literal("")),
  grokApiKey: z.string().optional(),
  deepseekApiKey: z.string().optional(),
  googleApiKey: z.string().optional(),
});

type AiConfigFormData = z.infer<typeof aiConfigSchema>;

interface ModelOption {
  id: string;
  name: string;
}

export function AiConfigForm() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; models?: ModelOption[] } | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const form = useForm<AiConfigFormData>({
    resolver: zodResolver(aiConfigSchema),
    defaultValues: {
      activeProvider: "openai",
      openaiApiKey: "",
      openaiBaseUrl: "",
      grokApiKey: "",
      deepseekApiKey: "",
      googleApiKey: "",
    },
  });

  useEffect(() => {
    let isMounted = true;

    const loadConfig = async () => {
      setIsLoading(true);
      try {
        const result = await getGlobalAiConfig();
        if (!isMounted) return;

        if (result.success && result.data) {
          form.reset({
            activeProvider: (result.data.activeProvider as "openai" | "grok" | "deepseek" | "google") || "openai",
            openaiApiKey: result.data.openaiApiKey || "",
            openaiBaseUrl: result.data.openaiBaseUrl || "",
            openaiModel: result.data.openaiModel || "",
            grokApiKey: result.data.grokApiKey || "",
            deepseekApiKey: result.data.deepseekApiKey || "",
            googleApiKey: result.data.googleApiKey || "",
          });
        } else if (!result.success) {
          form.reset({
            activeProvider: "openai",
            openaiApiKey: "",
            openaiBaseUrl: "",
            openaiModel: "",
            grokApiKey: "",
            deepseekApiKey: "",
            googleApiKey: "",
          });
        }
      } catch (error) {
        if (!isMounted) return;
        console.error("Error al cargar configuración:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo cargar la configuración",
        });
        form.reset({
          activeProvider: "openai",
          openaiApiKey: "",
          openaiBaseUrl: "",
          openaiModel: "",
          grokApiKey: "",
          deepseekApiKey: "",
          googleApiKey: "",
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadConfig();

    return () => {
      isMounted = false;
    };
  }, [form, toast]);

  const onSubmit = async (data: AiConfigFormData) => {
    setIsSaving(true);
    try {
      const result = await updateGlobalAiConfig(data);

      if (result.success) {
        toast({
          title: "Configuración guardada",
          description: "La configuración de IA se ha guardado correctamente",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo guardar la configuración",
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

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setAvailableModels([]);

    const formData = form.getValues();
    const apiKey = formData.openaiApiKey || "";
    const baseUrl = formData.openaiBaseUrl || "";

    if (!apiKey.trim()) {
      setTestResult({
        success: false,
        message: "Debes ingresar una API Key primero",
      });
      setIsTesting(false);
      toast({
        variant: "destructive",
        title: "Error de validación",
        description: "Debes ingresar una API Key primero",
      });
      return;
    }

    try {
      const result = await testAIConnection(apiKey, baseUrl || undefined);

      if (result.success && result.data) {
        if (result.data.models && result.data.models.length > 0) {
          setAvailableModels(result.data.models);
          
          if (!formData.openaiModel && result.data.models.length > 0) {
            const commonModel = result.data.models.find(m => 
              m.id.includes("gpt-4o-mini") || 
              m.id.includes("gpt-3.5-turbo") || 
              m.id.includes("gpt-4")
            ) || result.data.models[0];
            
            form.setValue("openaiModel", commonModel.id, { shouldDirty: true });
          }
        }

        setTestResult({
          success: true,
          message: `${result.data.models.length} modelos disponibles`,
        });
        toast({
          title: "Conexión exitosa",
          description: `Se encontraron ${result.data.models.length} modelos`,
        });
      } else {
        setTestResult({
          success: false,
          message: result.error || "Error de conexión",
        });
        toast({
          variant: "destructive",
          title: "Error de conexión",
          description: result.error,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      setTestResult({
        success: false,
        message: errorMessage,
      });
      toast({
        variant: "destructive",
        title: "Error inesperado",
        description: errorMessage,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const toggleShowKey = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-medium">Inteligencia Artificial</h3>
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
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium">Inteligencia Artificial</h3>
            <p className="text-xs text-muted-foreground">Configura proveedores y API Keys</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="divide-y">
            {/* Provider Selection Row */}
            <div className="px-4 py-3">
              <FormField
                control={form.control}
                name="activeProvider"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
                        <Zap className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <FormLabel className="text-sm font-medium">Proveedor activo</FormLabel>
                        <p className="text-xs text-muted-foreground">Selecciona el servicio de IA a utilizar</p>
                      </div>
                    </div>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecciona un proveedor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI (GPT-4o-mini)</SelectItem>
                        <SelectItem value="grok">Grok (xAI)</SelectItem>
                        <SelectItem value="deepseek">DeepSeek</SelectItem>
                        <SelectItem value="google">Google (Gemini)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* API Keys Section */}
            <div className="px-4 py-3 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
                  <Key className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium">API Keys</p>
                  <p className="text-xs text-muted-foreground">Las claves se almacenan de forma segura en el servidor</p>
                </div>
              </div>

              {/* OpenAI API Key */}
              <FormField
                control={form.control}
                name="openaiApiKey"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs">OpenAI API Key</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showKeys.openai ? "text" : "password"}
                          placeholder="sk-..."
                          className="h-9 pr-10"
                          {...field}
                          disabled={isSaving}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-9 w-9"
                          onClick={() => toggleShowKey("openai")}
                        >
                          {showKeys.openai ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* OpenAI Base URL */}
              <FormField
                control={form.control}
                name="openaiBaseUrl"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs">OpenAI Base URL (Opcional)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="https://api.openai.com/v1"
                        className="h-9"
                        {...field}
                        value={field.value || ""}
                        disabled={isSaving}
                      />
                    </FormControl>
                    <p className="text-[10px] text-muted-foreground">
                      Compatible con OpenRouter, Together AI, etc.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Model Selection */}
              <FormField
                control={form.control}
                name="openaiModel"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-xs">Modelo de IA</FormLabel>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleTestConnection}
                        disabled={isTesting || isSaving}
                        className="h-7 text-xs"
                      >
                        {isTesting ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Zap className="h-3 w-3 mr-1" />
                        )}
                        Probar
                      </Button>
                    </div>
                    <FormControl>
                      {availableModels.length > 0 ? (
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || ""}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Selecciona un modelo" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableModels.map((model) => (
                              <SelectItem key={model.id} value={model.id}>
                                {model.name} {model.id !== model.name ? `(${model.id})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type="text"
                          placeholder="gpt-4o-mini"
                          className="h-9"
                          {...field}
                          value={field.value || ""}
                          disabled={isSaving}
                        />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Test Result */}
              {testResult && (
                <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
                  testResult.success 
                    ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' 
                    : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                }`}>
                  {testResult.success ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              {/* Grok API Key */}
              <FormField
                control={form.control}
                name="grokApiKey"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs">Grok (xAI) API Key</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showKeys.grok ? "text" : "password"}
                          placeholder="xai-..."
                          className="h-9 pr-10"
                          {...field}
                          disabled={isSaving}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-9 w-9"
                          onClick={() => toggleShowKey("grok")}
                        >
                          {showKeys.grok ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* DeepSeek API Key */}
              <FormField
                control={form.control}
                name="deepseekApiKey"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs">DeepSeek API Key</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showKeys.deepseek ? "text" : "password"}
                          placeholder="sk-..."
                          className="h-9 pr-10"
                          {...field}
                          disabled={isSaving}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-9 w-9"
                          onClick={() => toggleShowKey("deepseek")}
                        >
                          {showKeys.deepseek ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Google API Key */}
              <FormField
                control={form.control}
                name="googleApiKey"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs">Google (Gemini) API Key</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showKeys.google ? "text" : "password"}
                          placeholder="AIza..."
                          className="h-9 pr-10"
                          {...field}
                          disabled={isSaving}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-9 w-9"
                          onClick={() => toggleShowKey("google")}
                        >
                          {showKeys.google ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t bg-muted/30">
            <Button 
              type="submit" 
              disabled={isSaving || (isTesting === false && testResult === null)} 
              size="sm"
              className="w-full"
              title={(isTesting === false && testResult === null) ? "Primero prueba la conexión" : ""}
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
        </form>
      </Form>
    </div>
  );
}

