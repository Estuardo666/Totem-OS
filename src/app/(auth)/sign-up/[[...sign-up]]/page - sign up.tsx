import { Suspense } from "react";
import { SignUpForm } from "@/components/auth/sign-up-form";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicBrandSettings } from "@/actions/admin-actions";

/**
 * Componente asíncrono para el branding
 * Se ejecuta en Suspense, no bloquea el renderizado de la página
 */
async function BrandingHeader() {
  const brandSettings = await getPublicBrandSettings();

  return (
    <div className="mb-8 text-center">
      <Link href="/" className="inline-block">
        {brandSettings.success && brandSettings.data && (brandSettings.data.logoLight || brandSettings.data.logoDark) ? (
          <div className="flex flex-col items-center gap-2">
            {/* Logo Modo Claro */}
            {brandSettings.data.logoLight && (
              <Image
                src={brandSettings.data.logoLight}
                alt="Totem OS"
                width={300}
                height={80}
                className="h-20 w-auto block dark:hidden"
                priority
              />
            )}
            {/* Logo Modo Oscuro */}
            {brandSettings.data.logoDark && (
              <Image
                src={brandSettings.data.logoDark}
                alt="Totem OS"
                width={300}
                height={80}
                className="h-20 w-auto hidden dark:block"
                priority
              />
            )}
            <p className="text-muted-foreground mt-2 text-sm">
              Sistema Operativo Interno
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight">Totem OS</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Sistema Operativo Interno
            </p>
          </>
        )}
      </Link>
    </div>
  );
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = params?.callbackUrl || "/";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 w-full">
      {/* Suspense para el branding - página renderiza inmediatamente */}
      <Suspense fallback={<Skeleton className="h-20 w-48 mb-8 rounded-lg" />}>
        <BrandingHeader />
      </Suspense>
      
      {/* Card con formulario se renderiza INMEDIATAMENTE */}
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Crear Cuenta</CardTitle>
          <CardDescription>
            Regístrate usando correo y contraseña o Google
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm callbackUrl={callbackUrl} />
          <p className="text-sm text-muted-foreground mt-4 text-center">
            ¿Ya tienes una cuenta?{" "}
            <Link href="/sign-in" className="text-primary hover:underline">
              Inicia sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

