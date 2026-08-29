"use client";

import { useShellBootstrap } from "@/hooks/use-totem-api";
import { toApiErrorViewModel } from "@/lib/api-errors";

export default function ApiFoundationPage() {
  const bootstrap = useShellBootstrap();

  if (bootstrap.isPending) {
    return <main className="mx-auto max-w-xl p-8">Cargando datos de la API…</main>;
  }
  if (bootstrap.isError) {
    const error = toApiErrorViewModel(bootstrap.error);
    return (
      <main className="mx-auto max-w-xl space-y-2 p-8">
        <h1 className="text-xl font-semibold">API foundation</h1>
        <p role="alert">{error.message}</p>
        <small>{error.code}</small>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl space-y-2 p-8">
      <h1 className="text-xl font-semibold">API foundation</h1>
      <p>Sesión validada mediante /api/v1/shell/bootstrap.</p>
      <p>Usuario: {bootstrap.data.data.user.name}</p>
    </main>
  );
}
