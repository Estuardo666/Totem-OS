"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Target } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { updateClientStrategy } from "@/actions/admin-actions";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

const clientStrategySchema = z.object({
  clientId: z.string().cuid(),
  businessDescription: z.string().optional(),
  toneOfVoice: z.string().optional(),
  audience: z.string().optional(),
  values: z.string().optional(),
  prohibitedTopics: z.string().optional(),
});

type ClientStrategyFormData = z.infer<typeof clientStrategySchema>;

interface ClientStrategyFormProps {
  clientId: string;
  initialData?: {
    businessDescription?: string;
    toneOfVoice?: string;
    audience?: string;
    values?: string;
    prohibitedTopics?: string;
  };
}

const toneOfVoiceOptions = [
  { value: "Profesional", label: "Profesional" },
  { value: "Divertido", label: "Divertido" },
  { value: "Cercano", label: "Cercano" },
  { value: "Formal", label: "Formal" },
  { value: "Casual", label: "Casual" },
  { value: "Inspirador", label: "Inspirador" },
  { value: "Técnico", label: "Técnico" },
  { value: "Empático", label: "Empático" },
];

export function ClientStrategyForm({
  clientId,
  initialData,
}: ClientStrategyFormProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ClientStrategyFormData>({
    resolver: zodResolver(clientStrategySchema),
    defaultValues: {
      clientId,
      businessDescription: initialData?.businessDescription || "",
      toneOfVoice: initialData?.toneOfVoice || "",
      audience: initialData?.audience || "",
      values: initialData?.values || "",
      prohibitedTopics: initialData?.prohibitedTopics || "",
    },
  });

  // Actualizar formulario cuando cambian los datos iniciales
  useEffect(() => {
    if (initialData) {
      form.reset({
        clientId,
        businessDescription: initialData.businessDescription || "",
        toneOfVoice: initialData.toneOfVoice || "",
        audience: initialData.audience || "",
        values: initialData.values || "",
        prohibitedTopics: initialData.prohibitedTopics || "",
      });
    }
  }, [initialData, clientId, form]);

  const onSubmit = async (data: ClientStrategyFormData) => {
    setIsSaving(true);
    try {
      const result = await updateClientStrategy(data);

      if (result.success) {
        toast({
          title: "Estrategia guardada",
          description: "El ADN de marca se ha guardado correctamente",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo guardar la estrategia",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al guardar la estrategia",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Estrategia de Marca (ADN)
        </CardTitle>
        <CardDescription>
          Define el ADN estratégico de la marca para generar contenido personalizado con IA.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="businessDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción del Negocio *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe qué hace el negocio, su propuesta de valor y su mercado..."
                      {...field}
                      disabled={isSaving}
                      className="min-h-[100px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Esta información es esencial para que la IA genere contenido relevante.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="audience"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Audiencia Objetivo *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Emprendedores de 25-40 años, interesados en tecnología..."
                      {...field}
                      disabled={isSaving}
                    />
                  </FormControl>
                  <FormDescription>
                    Define quién es tu público objetivo para personalizar el mensaje.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="toneOfVoice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tono de Voz *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isSaving}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el tono de voz" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {toneOfVoiceOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    El tono de voz define cómo se comunica la marca.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="values"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valores de Marca</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Innovación, Sostenibilidad, Transparencia..."
                      {...field}
                      disabled={isSaving}
                    />
                  </FormControl>
                  <FormDescription>
                    Valores y principios que guían la marca (opcional).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="prohibitedTopics"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Temas Prohibidos</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Política, Controversias, Competencia..."
                      {...field}
                      disabled={isSaving}
                    />
                  </FormControl>
                  <FormDescription>
                    Temas que la marca evita mencionar en su contenido (opcional).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isSaving} className="w-full">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Estrategia de Marca
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

