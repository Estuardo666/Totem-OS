"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  Eye,
  EyeOff,
  Facebook,
  Globe,
  Instagram,
  Mail,
  Monitor,
  Plus,
  Save,
} from "lucide-react";
import { credentialGroupSchema, credentialServices, type CredentialService } from "@/schemas/client";
import type { VaultGroupFormValues } from "./vault-types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type VaultGroupFormProps = {
  clientId: string;
  initialValues?: VaultGroupFormValues;
  isSubmitting: boolean;
  submitLabel: string;
  onCancel?: () => void;
  onSubmit: (values: VaultGroupFormValues) => Promise<void>;
};

const serviceIcons: Record<CredentialService, typeof Facebook> = {
  Facebook,
  Instagram,
  TikTok: Monitor,
  Gmail: Mail,
  Hotmail: Mail,
  Web: Globe,
  Otros: Plus,
};

const serviceColors: Record<CredentialService, string> = {
  Facebook: "text-blue-600",
  Instagram: "text-pink-500",
  TikTok: "text-slate-900 dark:text-slate-100",
  Gmail: "text-red-500",
  Hotmail: "text-sky-500",
  Web: "text-emerald-500",
  Otros: "text-amber-500",
};

export function VaultGroupForm({
  clientId,
  initialValues,
  isSubmitting,
  submitLabel,
  onCancel,
  onSubmit,
}: VaultGroupFormProps) {
  const [showPassword, setShowPassword] = useState(false);

  const defaultValues = useMemo<VaultGroupFormValues>(
    () => ({
      services: initialValues?.services ?? [],
      username: initialValues?.username ?? "",
      password: initialValues?.password ?? "",
      url: initialValues?.url ?? "",
      clientId,
      existingCredentials: initialValues?.existingCredentials ?? [],
    }),
    [clientId, initialValues]
  );

  const form = useForm<VaultGroupFormValues>({
    resolver: zodResolver(credentialGroupSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  return (
    <div className="rounded-3xl border bg-card p-4 md:p-5">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="services"
            render={({ field }) => (
              <FormItem>
                <div className="sr-only">
                  <FormLabel>Servicio</FormLabel>
                </div>
                <FormControl>
                  <div className="flex flex-nowrap items-center gap-2 overflow-x-auto py-1">
                    {credentialServices.map((service) => {
                      const Icon = serviceIcons[service];
                      const checked = field.value.includes(service);

                      return (
                        <button
                          key={service}
                          type="button"
                          title={service}
                          className={cn(
                            "relative flex min-w-[60px] flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 transition-all",
                            checked
                              ? "border-primary bg-primary/10 shadow-sm"
                              : "border-border hover:border-primary/40"
                          )}
                          onClick={() => {
                            const nextValue = checked
                              ? field.value.filter((value) => value !== service)
                              : [...field.value, service];
                            field.onChange(nextValue);
                          }}
                          disabled={isSubmitting}
                          aria-pressed={checked}
                        >
                          <Icon className={cn("h-5 w-5", serviceColors[service])} />
                          <span className="text-[10px] font-medium leading-none text-muted-foreground">
                            {service}
                          </span>
                          {checked ? (
                            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                              <Check className="h-3 w-3" />
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_1.2fr_1fr] md:items-start">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Usuario</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nombre de usuario o email"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Contraseña"
                        className="pr-12"
                        {...field}
                        disabled={isSubmitting}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1 h-8 w-8"
                        onClick={() => setShowPassword((prev) => !prev)}
                        disabled={isSubmitting}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://ejemplo.com"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            {onCancel ? (
              <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                Cancelar
              </Button>
            ) : null}
            <Button type="submit" disabled={isSubmitting}>
              <Save className="h-4 w-4" />
              {submitLabel}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
