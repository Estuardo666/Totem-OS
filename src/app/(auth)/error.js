'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AuthError({ error, reset }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 w-full">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-red-600">Error de Autenticación</CardTitle>
          <CardDescription>
            Ha ocurrido un error en el proceso de autenticación.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {error?.message || 'Error desconocido. Por favor, intenta nuevamente.'}
          </p>
          <div className="flex gap-2">
            <Button onClick={reset} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
              Reintentar
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/sign-in'}
              className="flex-1"
            >
              Volver al Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
