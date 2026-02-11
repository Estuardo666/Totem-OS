"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema } from "@/schemas/user";
import type { RegisterInput } from "@/schemas/user";
import { registerUser } from "@/actions/user.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Chrome, Loader2 } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";

interface SignUpFormProps {
  callbackUrl?: string;
}

export function SignUpForm({ callbackUrl = "/" }: SignUpFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const passwordValue = watch("password");

  const onSubmit = async (data: RegisterInput) => {
    setIsLoading(true);
    setIsSubmitting(true);
    try {
      const result = await registerUser(data);

      if (!result.success) {
        toast({
          variant: "destructive",
          title: "Error al registrarse",
          description: result.error || "No se pudo crear la cuenta",
        });
        setIsSubmitting(false);
        return;
      }

      // Si el registro fue exitoso, iniciar sesión automáticamente
      const signInResult = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (signInResult?.error) {
        toast({
          variant: "destructive",
          title: "Cuenta creada",
          description: "Pero no se pudo iniciar sesión automáticamente. Por favor, inicia sesión manualmente.",
        });
        setIsSubmitting(false);
        window.location.href = "/sign-in";
      } else if (signInResult?.ok) {
        toast({
          title: "¡Bienvenido!",
          description: "Tu cuenta ha sido creada exitosamente",
        });
        // Forzar refresco completo de la sesión
        setTimeout(() => {
          window.location.href = callbackUrl || "/dashboard";
        }, 600);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Ocurrió un error al crear la cuenta",
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
      <style>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .form-container {
          animation: slideInUp 0.6s ease-out;
        }

        .input-field {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .input-field:focus-within {
          transform: translateY(-2px);
        }

        .macos-input {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        .macos-input:focus {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(100, 200, 255, 0.5);
          box-shadow: 0 0 0 3px rgba(100, 200, 255, 0.1);
        }

        .macos-button {
          position: relative;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-weight: 600;
          letter-spacing: -0.3px;
        }

        .macos-button:hover:not(:disabled) {
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.3);
        }

        .macos-button:active:not(:disabled) {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .macos-button:disabled {
          opacity: 0.6;
        }

        .primary-button {
          background: #9fe842 !important;
          color: #1a1a1a !important;
          border: none !important;
          font-weight: 700 !important;
          letter-spacing: -0.4px;
        }

        .primary-button:hover:not(:disabled) {
          background: #aff062 !important;
        }

        .secondary-button {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          color: rgba(255, 255, 255, 0.9);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .secondary-button:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.3);
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.2);
        }

        .divider-container {
          position: relative;
          margin: 1.5rem 0;
        }

        .divider-line {
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          height: 1px;
          background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.2), transparent);
        }

        .divider-text {
          position: relative;
          display: flex;
          justify-content: center;
          background: rgb(17, 24, 39);
          padding: 0 1rem;
          width: fit-content;
          margin: 0 auto;
        }

        .label-text {
          transition: all 0.2s ease;
          font-weight: 500;
          font-size: 0.875rem;
        }
      `}</style>

      <form onSubmit={handleSubmit(onSubmit)} className="form-container space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="input-field space-y-2">
            <Label htmlFor="firstName" className="label-text text-gray-200">
              Nombre
            </Label>
            <Input
              id="firstName"
              type="text"
              placeholder="Juan"
              {...register("firstName")}
              disabled={isLoading}
              className="macos-input w-full rounded-2xl h-11 px-4 text-white placeholder:text-gray-400"
            />
            {errors.firstName && (
              <p className="text-sm text-red-400 animate-pulse">
                {errors.firstName.message}
              </p>
            )}
          </div>

          <div className="input-field space-y-2">
            <Label htmlFor="lastName" className="label-text text-gray-200">
              Apellido
            </Label>
            <Input
              id="lastName"
              type="text"
              placeholder="Pérez"
              {...register("lastName")}
              disabled={isLoading}
              className="macos-input w-full rounded-2xl h-11 px-4 text-white placeholder:text-gray-400"
            />
            {errors.lastName && (
              <p className="text-sm text-red-400 animate-pulse">
                {errors.lastName.message}
              </p>
            )}
          </div>
        </div>

        <div className="input-field space-y-2">
          <Label htmlFor="email" className="label-text text-gray-200">
            Correo electrónico
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="tu@email.com"
            {...register("email")}
            disabled={isLoading}
            className="macos-input w-full rounded-2xl h-11 px-4 text-white placeholder:text-gray-400"
          />
          {errors.email && (
            <p className="text-sm text-red-400 animate-pulse">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="input-field space-y-2">
          <Label htmlFor="password" className="label-text text-gray-200">
            Contraseña
          </Label>
          <PasswordInput
            id="password"
            placeholder="••••••••"
            {...register("password")}
            disabled={isLoading}
            showStrengthMeter={true}
            value={passwordValue}
            className="macos-input w-full rounded-2xl h-11 px-4 text-white placeholder:text-gray-400"
          />
          {errors.password && (
            <p className="text-sm text-red-400 animate-pulse">
              {errors.password.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="macos-button primary-button w-full rounded-full h-11 text-base mt-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Creando cuenta...
            </>
          ) : (
            "Crear Cuenta"
          )}
        </Button>
      </form>

      <div className="divider-container">
        <div className="divider-line" />
        <div className="divider-text">
          <span className="text-xs uppercase tracking-wider text-gray-400">
            O continúa con
          </span>
        </div>
      </div>

      <Button
        type="button"
        disabled={isLoading}
        onClick={handleGoogleSignIn}
        className="macos-button secondary-button w-full rounded-full h-11 text-base font-medium"
      >
        <Chrome className="mr-2 h-5 w-5" />
        Continuar con Google
      </Button>
    </div>
  );
}
