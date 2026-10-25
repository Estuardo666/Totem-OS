"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { useTotemIOSApp } from "@/hooks/use-totem-ios-app";

const signInSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

type SignInFormData = z.infer<typeof signInSchema>;

interface SignInFormProps {
  callbackUrl?: string;
}

export function SignInForm({ callbackUrl = "/" }: SignInFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isTotemIOSApp = useTotemIOSApp();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = async (data: SignInFormData) => {
    setIsLoading(true);
    setIsSubmitting(true);
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        toast({
          variant: "destructive",
          title: "Error al iniciar sesión",
          description: "Credenciales inválidas",
        });
        setIsSubmitting(false);
      } else if (result?.ok) {
        // Mantener animación durante navegación
        setTimeout(() => {
          window.location.href = callbackUrl;
        }, 600);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Ocurrió un error al iniciar sesión",
      });
      setIsSubmitting(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium">
            Correo electrónico
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            {...register("email")}
            disabled={isLoading}
            className="h-11"
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium">
            Contraseña
          </Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="Tu contraseña"
            {...register("password")}
            disabled={isLoading}
            className="h-11"
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <Button type="submit" disabled={isLoading} size="lg" className="w-full bg-foreground text-background hover:bg-foreground/85">
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Iniciando sesión…
            </>
          ) : (
            "Iniciar sesión"
          )}
        </Button>
      </form>

      {isTotemIOSApp ? (
        <p className="text-center text-xs text-muted-foreground">
          En la app iOS, inicia sesión con correo y contraseña.
        </p>
      ) : (
        <div className="space-y-4">
          {/* Separador por espacio y texto, sin líneas */}
          <p className="text-center text-xs text-muted-foreground">o continúa con</p>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isLoading}
            onClick={handleGoogleSignIn}
            className="w-full"
          >
            <GoogleLogo />
            Continuar con Google
          </Button>
        </div>
      )}
    </div>
  );
}

/** Logo oficial de Google (marca a cuatro colores; no es un icono decorativo). */
function GoogleLogo() {
  return (
    <svg data-brand-logo viewBox="0 0 24 24" aria-hidden className="h-[18px] w-[18px]">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3a7.2 7.2 0 0 1-10.73-3.78H1.33v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.34 14.31a7.2 7.2 0 0 1 0-4.62v-3.1H1.33a12 12 0 0 0 0 10.82l4.01-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.35.6 4.6 1.8l3.44-3.45A11.96 11.96 0 0 0 12 0 12 12 0 0 0 1.33 6.59l4.01 3.1A7.15 7.15 0 0 1 12 4.75Z" />
    </svg>
  );
}
