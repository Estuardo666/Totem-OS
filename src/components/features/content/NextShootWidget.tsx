"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MapPin, ExternalLink, FileText, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

interface NextShootWidgetProps {
  shoots: Array<{
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
    address?: string | null;
    mapLink?: string | null;
    scriptUrl?: string | null;
    notes?: string | null;
    client: {
      id: string;
      name: string;
    };
    crew: Array<{
      id: string;
      name: string;
      image: string | null;
    }>;
  }>;
}

export function NextShootWidget({ shoots }: NextShootWidgetProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(false);

  if (shoots.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Próximos Rodajes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No hay rodajes programados</p>
        </CardContent>
      </Card>
    );
  }

  const shoot = shoots[currentIndex];
  const hasMultipleShoots = shoots.length > 1;

  const startTimeStr = format(new Date(shoot.startTime), "dd/MM/yyyy HH:mm", { locale: es });
  const endTimeStr = format(new Date(shoot.endTime), "HH:mm", { locale: es });
  const startTimeOnly = format(new Date(shoot.startTime), "HH:mm", { locale: es });

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? shoots.length - 1 : prev - 1));
    setShowNotes(false);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === shoots.length - 1 ? 0 : prev + 1));
    setShowNotes(false);
  };

  return (
    <Card className="border-primary">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {hasMultipleShoots && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevious}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <span>Próximos Rodajes</span>
            {hasMultipleShoots && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasMultipleShoots && (
              <span className="text-xs text-muted-foreground">
                {currentIndex + 1} / {shoots.length}
              </span>
            )}
            <Badge variant="outline" className="bg-primary/10">
              {startTimeStr}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold text-lg mb-2">{shoot.title}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium">{startTimeOnly}</span>
            <span>-</span>
            <span>{endTimeStr}</span>
          </div>
        </div>

        {shoot.address && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm">{shoot.address}</p>
              {shoot.mapLink && (
                <a
                  href={shoot.mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Abrir en Maps
                </a>
              )}
            </div>
          </div>
        )}

        {shoot.notes && (
          <div className="space-y-2">
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {showNotes ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              Notas
            </button>
            {showNotes && (
              <div className="p-3 rounded-md bg-muted text-sm">{shoot.notes}</div>
            )}
          </div>
        )}

        {shoot.crew.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Equipo:</p>
            <div className="flex flex-wrap gap-2">
              {shoot.crew.map((member) => (
                <div key={member.id} className="flex items-center gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={member.image || undefined} />
                    <AvatarFallback>
                      {member.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{member.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {shoot.scriptUrl && (
          <Link href={shoot.scriptUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="w-full">
              <FileText className="w-4 h-4 mr-2" />
              Ver Guiones
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

