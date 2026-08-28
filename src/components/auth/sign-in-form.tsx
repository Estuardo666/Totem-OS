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
import { Chrome, Loader2 } from "lucide-react";
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

        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-5px);
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

        .loading-pulse {
          animation: shimmer 2s infinite;
          background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.1), transparent);
          background-size: 1000px 100%;
        }
      `}</style>

      <form onSubmit={handleSubmit(onSubmit)} className="form-container space-y-4">
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
          className="macos-button primary-button w-full rounded-full h-11 text-base"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              <span className={isSubmitting ? "loading-pulse" : ""}>
                Iniciando sesión...
              </span>
            </>
          ) : (
            "Iniciar Sesión"
          )}
        </Button>
      </form>

      {isTotemIOSApp ? (
        <p className="text-center text-xs text-gray-400">
          En la app iOS, inicia sesión con correo y contraseña.
        </p>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
