import { Suspense } from "react";
import Link from "next/link";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicBrandSettings, getLoginBackground } from "@/actions/admin-actions";

const FALLBACK_LOGO = "https://utfs.io/f/NqZ6bO92fiLrsUO8ug8BUQnS2JwateHKzPxm4v83ydCfrjGT";
const FALLBACK_BACKGROUND =
  "https://totem-os.vercel.app/_next/image?url=https%3A%2F%2Futfs.io%2Ff%2FNqZ6bO92fiLrrxbgrqcxRmvHV7qsT39DXCwJcELoFK1k2MQi&w=1920&q=90";

/** Logo de marca configurado en Ajustes (versión clara), con el logo histórico de respaldo. */
async function BrandLogo() {
  const brand = await getPublicBrandSettings();
  const logo = (brand.success && brand.data?.logoLight) || FALLBACK_LOGO;
  return (
    <Link href="/" aria-label="Totem OS" className="inline-block">
      <img src={logo} alt="Totem Mass Media" className="h-10 w-auto object-contain" />
    </Link>
  );
}

/** Panel visual: fondo configurable del login o la imagen de marca por defecto. */
async function VisualPanel() {
  const background = await getLoginBackground();
  const url = (background.success && background.data?.backgroundUrl) || FALLBACK_BACKGROUND;
  return (
    <div
      className="absolute inset-0 bg-cover bg-center"
      style={{ backgroundImage: `url(${url})` }}
      aria-hidden
    />
  );
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = params?.callbackUrl || "/";

  return (
    <main className="grid min-h-dvh w-full self-stretch bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Formulario */}
      <section className="flex flex-col px-6 py-8 sm:px-10 lg:px-16">
        <Suspense fallback={<Skeleton className="h-10 w-36 rounded-full" />}>
          <BrandLogo />
        </Suspense>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <div className="auth-enter mb-8 space-y-2">
            <h1 className="text-3xl font-semibold">Iniciar sesión</h1>
            <p className="text-sm text-muted-foreground">Accede al sistema operativo interno de Totem.</p>
          </div>
          <div className="auth-enter [animation-delay:60ms]">
            <SignInForm callbackUrl={callbackUrl} />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground">Privacidad</Link>
          <span className="mx-2" aria-hidden>·</span>
          <Link href="/terms" className="hover:text-foreground">Términos</Link>
        </p>
      </section>

      {/* Visual: contenedor flotante con radio concéntrico respecto a la ventana */}
      <aside className="relative hidden p-3 lg:block">
        <div className="relative h-full overflow-hidden rounded-3xl bg-card">
          <Suspense fallback={null}>
            <VisualPanel />
          </Suspense>
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 p-10 text-white">
            <p className="max-w-md text-2xl font-semibold leading-snug">Co-creamos contigo.</p>
            <p className="mt-2 max-w-md text-sm text-white/80">Clientes, contenido y finanzas de la agencia en un solo lugar.</p>
          </div>
        </div>
      </aside>
    </main>
  );
}
