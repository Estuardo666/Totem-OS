"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PublishedContentListProps {
  tasks: Array<{
    id: string;
    title: string;
    type: string;
    publishedAt: Date | null;
  }>;
  month: string;
  year: number;
}

function getTypeLabel(type: string): string {
  switch (type) {
    case "REEL":
      return "Reel";
    case "FLYER":
      return "Flyer";
    case "STORY":
      return "Story";
    default:
      return type;
  }
}

export function PublishedContentList({
  tasks,
  month,
  year,
}: PublishedContentListProps) {
  return (
    <Card className="bg-white shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          Contenido Publicado - {month} {year}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-xs">
                  {getTypeLabel(task.type)}
                </Badge>
                <span className="font-medium text-gray-900">{task.title}</span>
              </div>
              {task.publishedAt && (
                <span className="text-xs text-muted-foreground">
                  {new Date(task.publishedAt).toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

