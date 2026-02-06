'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-4 max-w-md mx-auto p-6">
            <h2 className="text-2xl font-bold text-foreground">Ha ocurrido un error</h2>
            <p className="text-muted-foreground">
              Lo sentimos, algo salió mal. Por favor, intenta recargar la página.
            </p>
            <Button 
              onClick={reset}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Reintentar
            </Button>
            <Button 
              variant="outline"
              onClick={() => window.location.reload()}
              className="ml-2"
            >
              Recargar página
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}

export function ErrorBoundary({ error, reset }) {
  return <GlobalError error={error} reset={reset} />;
}
