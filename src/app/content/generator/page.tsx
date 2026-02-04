import { redirect } from "next/navigation";

export default async function GeneratorPage() {
  // Este módulo fue desactivado. Redirigimos al dashboard de contenido.
  redirect("/content/dashboard");
}

