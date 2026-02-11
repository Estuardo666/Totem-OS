import { Suspense } from "react";
import { SignUpForm } from "@/components/auth/sign-up-form";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicBrandSettings, getLoginBackground } from "@/actions/admin-actions";

/**
 * Componente asíncrono para el branding
 * Se ejecuta en Suspense, no bloquea el renderizado de la página
 */
async function BrandingHeader() {
  const brandSettings = await getPublicBrandSettings();

  return (
    <div className="mb-12 text-center">
      <Link href="/" className="inline-block">
        <div className="flex flex-col items-center gap-3">
          {/* Logo Totem Mass Media */}
          <img
            src="https://utfs.io/f/NqZ6bO92fiLrsUO8ug8BUQnS2JwateHKzPxm4v83ydCfrjGT"
            alt="Totem Mass Media"
            className="h-auto w-48"
            loading="lazy"
          />
          <p className="text-gray-300 mt-1 text-sm font-medium opacity-80">
            Sistema Operativo Interno
          </p>
        </div>
      </Link>
    </div>
  );
}

/**
 * Componente para el background dinámico
 */
async function DynamicBackground() {
  const backgroundSettings = await getLoginBackground();
  
  if (backgroundSettings.success && backgroundSettings.data?.backgroundUrl) {
    return (
      <div 
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: `url(${backgroundSettings.data.backgroundUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
    );
  }
  
  return null;
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = params?.callbackUrl || "/";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 w-full relative dark overflow-hidden">
      <style>{`
        @keyframes gradientShift {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        .macos-card {
          background: rgba(17, 24, 39, 0.7);
          backdrop-filter: blur(30px);
          -webkit-backdrop-filter: blur(30px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          animation: slideInUp 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .macos-title {
          background: linear-gradient(135deg, #ffffff 0%, #b0b0b0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        .gradient-bg {
          background: linear-gradient(-45deg, #1f2937, #111827, #0f172a, #111827);
          background-size: 400% 400%;
          animation: gradientShift 15s ease infinite;
        }

        .signin-link {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          color: #64c2ff;
        }

        .signin-link:hover {
          color: #7ecfff;
          text-decoration-thickness: 2px;
        }
      `}</style>

      {/* Background dinámico */}
      <Suspense fallback={null}>
        <DynamicBackground />
      </Suspense>

      {/* Gradient overlay */}
      <div className="fixed inset-0 -z-5 bg-cover bg-center" 
        style={{
          backgroundImage: 'url(https://totem-os.vercel.app/_next/image?url=https%3A%2F%2Futfs.io%2Ff%2FNqZ6bO92fiLrrxbgrqcxRmvHV7qsT39DXCwJcELoFK1k2MQi&w=1920&q=90)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />
      
      {/* Suspense para el branding - página renderiza inmediatamente */}
      <Suspense fallback={<Skeleton className="h-20 w-48 mb-8 rounded-lg" />}>
        <BrandingHeader />
      </Suspense>
      
      {/* Card con formulario se renderiza INMEDIATAMENTE */}
      <div className="macos-card w-full max-w-md rounded-3xl px-8 py-8">
        <div className="mb-8 text-center">
          <h1 className="macos-title text-2xl mb-2">Crear Cuenta</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Regístrate para acceder a Totem OS
          </p>
        </div>

        <SignUpForm callbackUrl={callbackUrl} />
        
        <p className="text-sm text-gray-400 mt-6 text-center">
          ¿Ya tienes una cuenta?{" "}
          <Link href="/sign-in" className="signin-link font-medium">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

