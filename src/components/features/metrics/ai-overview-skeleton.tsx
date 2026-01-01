import { Card, CardContent } from "@/components/ui/card";

export function AiOverviewSkeleton() {
  return (
    <Card className="border-2 border-dashed border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 animate-pulse">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Título */}
          <div className="h-6 bg-muted rounded w-1/3"></div>
          
          {/* Líneas de texto */}
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-5/6"></div>
          </div>
          
          {/* Párrafo */}
          <div className="space-y-2 pt-2">
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-4/5"></div>
          </div>
          
          {/* Lista */}
          <div className="space-y-2 pt-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
            <div className="h-4 bg-muted rounded w-4/5"></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

