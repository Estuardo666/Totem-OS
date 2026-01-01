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
import { updateGlobalAiConfig, getGlobalAiConfig } from "@/actions/admin-actions";
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
  grokApiKey: z.string().optional(),
  deepseekApiKey: z.string().optional(),
  googleApiKey: z.string().optional(),
});

type AiConfigFormData = z.infer<typeof aiConfigSchema>;

export function AiConfigForm() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const form = useForm<AiConfigFormData>({
    resolver: zodResolver(aiConfigSchema),
    defaultValues: {
      activeProvider: "openai",
      openaiApiKey: "",
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
            grokApiKey: result.data.grokApiKey || "",
            deepseekApiKey: result.data.deepseekApiKey || "",
            googleApiKey: result.data.googleApiKey || "",
          });
        } else if (!result.success) {
          // Si no hay configuración, usar valores por defecto
          form.reset({
            activeProvider: "openai",
            openaiApiKey: "",
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

            <Button type="submit" disabled={isSaving} className="w-full">
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

