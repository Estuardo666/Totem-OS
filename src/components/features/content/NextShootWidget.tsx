"use client";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
      <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-6">
        <h2 className="text-lg font-bold mb-3">Próximos Rodajes</h2>
        <p className="text-sm text-muted-foreground">No hay rodajes programados</p>
      </div>
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
    <div className="rounded-3xl border border-blue-200 dark:border-border bg-gradient-to-br from-blue-50 via-white to-blue-50/50 dark:from-card dark:via-card dark:to-card shadow-sm hover:shadow-md transition-shadow p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasMultipleShoots && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              className="h-8 w-8 rounded-full hover:bg-blue-100 dark:hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <h2 className="text-lg font-bold">Próximos Rodajes</h2>
          {hasMultipleShoots && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="h-8 w-8 rounded-full hover:bg-blue-100 dark:hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
        {hasMultipleShoots && (
          <span className="text-xs font-medium text-muted-foreground">
            {currentIndex + 1} / {shoots.length}
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="font-semibold text-base mb-2">{shoot.title}</h3>
          <div className="flex items-center gap-3 text-sm font-medium text-blue-600 dark:text-blue-400">
            <span>{startTimeOnly}</span>
            <span className="text-muted-foreground">–</span>
            <span>{endTimeStr}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{format(new Date(shoot.startTime), "dd MMMM yyyy", { locale: es })}</p>
        </div>

        {shoot.address && (
          <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <MapPin className="w-4 h-4 mt-0.5 text-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{shoot.address}</p>
              {shoot.mapLink && (
                <a
                  href={shoot.mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1 mt-1.5"
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
              <div className="p-3 rounded-xl bg-muted/40 text-sm border border-border/50">{shoot.notes}</div>
            )}
          </div>
        )}

        {shoot.crew.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-sm font-medium">Equipo:</p>
            <div className="flex flex-wrap gap-2">
              {shoot.crew.map((member) => (
                <div key={member.id} className="flex items-center gap-2 px-3 py-2 rounded-full bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={member.image || undefined} />
                    <AvatarFallback className="text-xs">
                      {member.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium">{member.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {shoot.scriptUrl && (
          <Link href={shoot.scriptUrl} target="_blank" rel="noopener noreferrer">
            <Button className="w-full rounded-full h-10 bg-blue-500 hover:bg-blue-600 text-white font-medium">
              <FileText className="w-4 h-4 mr-2" />
              Ver Guiones
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

