"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Eye, EyeOff, Sparkles } from "lucide-react";
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

  // Cargar configuración existente
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
          // Si no hay configuración, usar valores por defecto
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
        // Usar valores por defecto en caso de error
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

    // Validar que hay API Key
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
        // Guardar modelos disponibles
        if (result.data.models && result.data.models.length > 0) {
          setAvailableModels(result.data.models);
          
          // Si no hay modelo seleccionado, sugerir el primero o uno común
          if (!formData.openaiModel && result.data.models.length > 0) {
            // Buscar un modelo común o usar el primero
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
          message: `✅ Conexión exitosa. ${result.data.models.length} modelos disponibles.`,
        });
        toast({
          title: "Conexión exitosa",
          description: `Se encontraron ${result.data.models.length} modelos`,
        });
      } else {
        setTestResult({
          success: false,
          message: `❌ Error: ${result.error}`,
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
        message: `❌ Error: ${errorMessage}`,
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
          <Sparkles className="h-5 w-5" />
          Configuración de Inteligencia Artificial
        </CardTitle>
        <CardDescription>
          Configura los proveedores de IA y sus API Keys. Solo visible para administradores.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="activeProvider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proveedor Activo</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
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

            <div className="space-y-4">
              <h3 className="text-sm font-semibold">API Keys</h3>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">
                  <strong>Seguridad:</strong> Las API Keys se almacenan de forma segura en el servidor y solo se usan dentro de funciones "use server". 
                  Nunca se utilizan directamente en el navegador para hacer llamadas a APIs externas.
                </p>
              </div>

              <FormField
                control={form.control}
                name="openaiApiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OpenAI API Key</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showKeys.openai ? "text" : "password"}
                          placeholder="sk-..."
                          {...field}
                          disabled={isSaving}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full"
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

              <FormField
                control={form.control}
                name="openaiBaseUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OpenAI Base URL (Opcional)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="https://api.openai.com/v1"
                        {...field}
                        value={field.value || ""}
                        disabled={isSaving}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      URL personalizada para OpenAI. Por defecto: https://api.openai.com/v1
                      <br />
                      Ejemplos: https://openrouter.ai/api/v1, https://api.together.xyz/v1
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Campo de Modelo - Solo para OpenAI */}
              <FormField
                control={form.control}
                name="openaiModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modelo de IA (OpenAI)</FormLabel>
                    <FormControl>
                      {availableModels.length > 0 ? (
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || ""}
                        >
                          <SelectTrigger>
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
                          {...field}
                          value={field.value || ""}
                          disabled={isSaving}
                        />
                      )}
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {availableModels.length > 0 
                        ? `Modelos disponibles: ${availableModels.length}. Selecciona uno de la lista.`
                        : `Modelo a usar. Haz clic en "Probar Conexión" para cargar la lista de modelos disponibles.`}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Botón de Prueba de Conexión */}
              <div className="flex gap-2 items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isTesting || isSaving}
                  className="flex-1"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Probando...
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-4 w-4" />
                      Probar Conexión
                    </>
                  )}
                </Button>
              </div>

              {/* Resultado de la Prueba */}
              {testResult && (
                <div className={`p-3 rounded-lg border ${
                  testResult.success 
                    ? 'bg-green-50 border-green-200 text-green-800' 
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  <p className="text-sm font-medium">{testResult.message}</p>
                  {testResult.success && availableModels.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold mb-1">Modelos disponibles:</p>
                      <div className="max-h-32 overflow-y-auto text-xs space-y-1">
                        {availableModels.slice(0, 10).map((model) => (
                          <div key={model.id} className="flex items-center gap-2">
                            <span className="font-mono bg-white/50 px-1 rounded">{model.id}</span>
                            {model.name && model.name !== model.id && (
                              <span className="opacity-75">- {model.name}</span>
                            )}
                          </div>
                        ))}
                        {availableModels.length > 10 && (
                          <div className="opacity-75">...y {availableModels.length - 10} más</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <FormField
                control={form.control}
                name="grokApiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grok (xAI) API Key</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showKeys.grok ? "text" : "password"}
                          placeholder="xai-..."
                          {...field}
                          disabled={isSaving}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full"
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

              <FormField
                control={form.control}
                name="deepseekApiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DeepSeek API Key</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showKeys.deepseek ? "text" : "password"}
                          placeholder="sk-..."
                          {...field}
                          disabled={isSaving}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full"
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

              <FormField
                control={form.control}
                name="googleApiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Google (Gemini) API Key</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showKeys.google ? "text" : "password"}
                          placeholder="AIza..."
                          {...field}
                          disabled={isSaving}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full"
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

            <Button 
              type="submit" 
              disabled={isSaving || (isTesting === false && testResult === null)} 
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
                  Guardar Configuración de IA
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

